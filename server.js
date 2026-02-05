const express = require('express');
const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');
const pty = require('node-pty');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });

// Persistent session storage by client ID
const clientSessions = new Map();
const clientConnections = new Map();


// Session timeout (clean up after 1 hour of no connection)
const SESSION_TIMEOUT = 60 * 60 * 1000;

function getOrCreateClientData(clientId) {
  if (!clientSessions.has(clientId)) {
    clientSessions.set(clientId, {
      sessions: new Map(),
      sessionCounter: 0,
      activeSessionId: null,
      lastSeen: Date.now()
    });
  }
  const data = clientSessions.get(clientId);
  data.lastSeen = Date.now();
  return data;
}

// Clean up old client data periodically
setInterval(() => {
  const now = Date.now();
  for (const [clientId, data] of clientSessions) {
    if (!clientConnections.has(clientId) && now - data.lastSeen > SESSION_TIMEOUT) {
      // Kill any PTY processes
      for (const session of data.sessions.values()) {
        if (session.pty) {
          session.pty.kill();
        }
      }
      clientSessions.delete(clientId);
      console.log(`Cleaned up stale client: ${clientId}`);
    }
  }
}, 60000);

wss.on('connection', (ws, req) => {
  // Get client ID from query string
  const url = new URL(req.url, 'http://localhost');
  const clientId = url.searchParams.get('clientId');

  if (!clientId) {
    ws.close(4000, 'Client ID required');
    return;
  }

  console.log(`Client connected: ${clientId}`);

  // Store connection
  clientConnections.set(clientId, ws);

  const clientData = getOrCreateClientData(clientId);
  const sessions = clientData.sessions;

  // Store websocket in clientData so PTY handlers can use current connection
  clientData.ws = ws;

  const sendMessage = (type, data) => {
    const currentWs = clientData.ws;
    if (currentWs && currentWs.readyState === currentWs.OPEN) {
      currentWs.send(JSON.stringify({ type, ...data }));
    }
  };

  // Store sendMessage in clientData for PTY handlers
  clientData.sendMessage = sendMessage;

  const sendToSession = (sessionId, data) => {
    const session = sessions.get(sessionId);
    if (session) {
      session.history.push(data);
      if (session.history.length > 1000) {
        session.history = session.history.slice(-500);
      }
    }

    // Use clientData.sendMessage to ensure we use current websocket
    clientData.sendMessage('output', { sessionId, data });
  };

  // Store sendToSession in clientData
  clientData.sendToSession = sendToSession;

  const createSession = (name) => {
    const id = `session-${++clientData.sessionCounter}`;
    const sessionName = name || `Shell ${clientData.sessionCounter}`;

    // Spawn a persistent PTY shell for this session
    // Use the user's default shell or fall back to /bin/zsh (common on macOS)
    const shell = process.env.SHELL || '/bin/zsh';
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.env.HOME || '/tmp',
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        CLICOLOR: '1',           // Enable colors for ls on macOS
        CLICOLOR_FORCE: '1',     // Force colors even when not TTY
        COLORTERM: 'truecolor'   // Enable 24-bit color support
      }
    });

    const session = {
      id,
      name: sessionName,
      pty: ptyProcess,
      history: []
    };
    sessions.set(id, session);

    // Handle PTY data events - use clientData.sendToSession for current connection
    ptyProcess.onData((data) => {
      clientData.sendToSession(id, data);
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`PTY exited for session ${id}: code=${exitCode}, signal=${signal}`);
    });

    sendMessage('session-created', { id, name: session.name });

    return id;
  };

  // Restore existing sessions or create initial session
  if (sessions.size > 0) {
    console.log(`Restoring ${sessions.size} sessions for client: ${clientId}`);
    // Send existing sessions to client
    for (const session of sessions.values()) {
      sendMessage('session-created', { id: session.id, name: session.name });
    }
    // Switch to last active session
    const activeId = clientData.activeSessionId || sessions.keys().next().value;
    sendMessage('session-switched', { id: activeId });
    sendMessage('clear', { sessionId: activeId });
    const activeSession = sessions.get(activeId);
    if (activeSession) {
      for (const data of activeSession.history) {
        sendMessage('output', { sessionId: activeId, data });
      }
    }
  } else {
    const initialSessionId = createSession('Main');
    clientData.activeSessionId = initialSessionId;
    sendMessage('session-switched', { id: initialSessionId });
  }

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);

      switch (msg.type) {
        case 'create-session': {
          const id = createSession(msg.name);
          clientData.activeSessionId = id;
          sendMessage('session-switched', { id });
          break;
        }

        case 'switch-session': {
          const session = sessions.get(msg.sessionId);
          if (session) {
            clientData.activeSessionId = msg.sessionId;
            sendMessage('session-switched', { id: msg.sessionId });
            sendMessage('clear', { sessionId: msg.sessionId });
            for (const data of session.history) {
              sendMessage('output', { sessionId: msg.sessionId, data });
            }
          }
          break;
        }

        case 'close-session': {
          const session = sessions.get(msg.sessionId);
          if (session) {
            if (session.pty) {
              session.pty.kill();
            }
            sessions.delete(msg.sessionId);
            sendMessage('session-closed', { id: msg.sessionId });

            if (sessions.size === 0) {
              const newId = createSession('Main');
              clientData.activeSessionId = newId;
              sendMessage('session-switched', { id: newId });
            } else if (clientData.activeSessionId === msg.sessionId) {
              // Switch to another session and replay its history
              const nextId = sessions.keys().next().value;
              const nextSession = sessions.get(nextId);
              clientData.activeSessionId = nextId;
              sendMessage('session-switched', { id: nextId });
              if (nextSession) {
                for (const data of nextSession.history) {
                  sendMessage('output', { sessionId: nextId, data });
                }
              }
            }
          }
          break;
        }

        case 'rename-session': {
          const session = sessions.get(msg.sessionId);
          if (session) {
            session.name = msg.name;
            sendMessage('session-renamed', { id: msg.sessionId, name: msg.name });
          }
          break;
        }

        case 'correct-english': {
          const { text, sessionId } = msg;
          const prompt = `Fix grammar and improve this English text. Return ONLY the corrected text, nothing else:\n\n${text}`;

          // Use Haiku model for fast corrections
          const claude = spawn('claude', ['-p', prompt, '--model', 'haiku'], {
            stdio: ['ignore', 'pipe', 'pipe']
          });

          let stdout = '';
          let stderr = '';

          claude.stdout.on('data', (data) => {
            stdout += data.toString();
          });

          claude.stderr.on('data', (data) => {
            stderr += data.toString();
          });

          // Set timeout
          const timeout = setTimeout(() => {
            claude.kill();
            sendMessage('correction-error', {
              sessionId,
              original: text,
              error: 'Correction timed out'
            });
          }, 30000);

          claude.on('close', (code) => {
            clearTimeout(timeout);
            if (code === 0 && stdout.trim()) {
              sendMessage('correction-result', {
                sessionId,
                original: text,
                corrected: stdout.trim()
              });
            } else {
              sendMessage('correction-error', {
                sessionId,
                original: text,
                error: stderr || 'Correction failed'
              });
            }
          });

          claude.on('error', (err) => {
            clearTimeout(timeout);
            sendMessage('correction-error', {
              sessionId,
              original: text,
              error: err.message
            });
          });
          break;
        }

        case 'input': {
          const session = sessions.get(msg.sessionId);
          if (!session || !session.pty) break;

          // Send input directly to PTY
          session.pty.write(msg.data);
          break;
        }

        case 'resize': {
          const session = sessions.get(msg.sessionId);
          if (session && session.pty) {
            session.pty.resize(msg.cols, msg.rows);
          }
          break;
        }
      }
    } catch (e) {
      console.error('Message error:', e);
    }
  });

  ws.on('close', () => {
    console.log(`Client disconnected: ${clientId}`);
    clientConnections.delete(clientId);
    clientData.lastSeen = Date.now();
    // Sessions persist - don't delete them
  });
});
