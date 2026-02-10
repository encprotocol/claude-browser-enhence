const express = require('express');
const { WebSocketServer } = require('ws');
const { spawn, execSync } = require('child_process');
const pty = require('node-pty');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
const clientDir = process.env.NODE_ENV === 'production'
  ? path.join(__dirname, 'dist')
  : path.join(__dirname, 'public');
app.use(express.static(clientDir));

// --- Persistent JSON store ---
const DATA_DIR = path.join(__dirname, 'data');
const RECORDINGS_DIR = path.join(DATA_DIR, 'recordings');
fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
  } catch { return fallback; }
}

function writeJSON(file, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

app.get('/api/todos', (req, res) => res.json(readJSON('todos.json', [])));
app.put('/api/todos', (req, res) => {
  writeJSON('todos.json', req.body);
  res.json({ ok: true });
});

app.get('/api/notes', (req, res) => res.json(readJSON('notes.json', [])));
app.put('/api/notes', (req, res) => {
  writeJSON('notes.json', req.body);
  res.json({ ok: true });
});

app.delete('/api/notes/:id', (req, res) => {
  var notes = readJSON('notes.json', []);
  var note = notes.find(n => n.id === req.params.id);
  if (note) {
    // Clean up uploaded images referenced in the note
    var re = /!\[[^\]]*\]\(([^)]+)\)/g;
    var m;
    while ((m = re.exec(note.content || '')) !== null) {
      var imgPath = path.join(__dirname, 'public', m[1]);
      try { fs.unlinkSync(imgPath); } catch {}
    }
    notes = notes.filter(n => n.id !== req.params.id);
    writeJSON('notes.json', notes);
  }
  res.json({ ok: true });
});

app.post('/api/upload', (req, res) => {
  try {
    const { name, data } = req.body;
    if (!name || !data) return res.status(400).json({ error: 'Missing name or data' });
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = Date.now() + '-' + safeName;
    const dir = path.join(__dirname, 'public', 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), Buffer.from(data, 'base64'));
    res.json({ url: '/uploads/' + filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Recordings ---
function generateRecordingId() {
  return 'rec-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}

function flushRecording(recording) {
  try {
    fs.writeFileSync(
      path.join(RECORDINGS_DIR, recording.id + '.json'),
      JSON.stringify(recording)
    );
  } catch (err) {
    console.error('Failed to flush recording:', err.message);
  }
}

function getCwdForPid(pid) {
  try {
    const result = execSync(
      `lsof -p ${pid} -a -d cwd -Fn | grep ^n | cut -c2-`,
      { timeout: 3000, encoding: 'utf8' }
    ).trim();
    return result || (process.env.HOME || '/tmp');
  } catch {
    return process.env.HOME || '/tmp';
  }
}

function getClaudeStatusPerSession(sessions) {
  const result = new Map();
  for (const [id, session] of sessions) {
    if (!session.pty || !session.pty.pid) {
      result.set(id, false);
      continue;
    }
    try {
      execSync(`pgrep -f -P ${session.pty.pid} claude`, { stdio: 'ignore' });
      result.set(id, true);
    } catch {
      result.set(id, false);
    }
  }
  return result;
}

function startRecording(session, clientData) {
  const id = generateRecordingId();
  const cwd = session.pty ? getCwdForPid(session.pty.pid) : (process.env.HOME || '/tmp');
  const recording = {
    id,
    sessionId: session.id,
    sessionName: session.name,
    cwd,
    cols: session.pty ? session.pty.cols : 80,
    rows: session.pty ? session.pty.rows : 24,
    startedAt: new Date().toISOString(),
    endedAt: null,
    events: [],
  };
  session.recording = recording;
  session.claudeRunning = true;
  flushRecording(recording);
  if (clientData.sendMessage) {
    clientData.sendMessage('recording-started', { sessionId: session.id, recordingId: id });
  }
  console.log(`Recording started: ${id} for session ${session.id}`);
}

function stopRecording(session, clientData) {
  const recording = session.recording;
  if (!recording) return;
  recording.endedAt = new Date().toISOString();
  flushRecording(recording);
  const recordingId = recording.id;
  session.recording = null;
  session.claudeRunning = false;
  if (clientData.sendMessage) {
    clientData.sendMessage('recording-stopped', { sessionId: session.id, recordingId });
  }
  console.log(`Recording stopped: ${recordingId} for session ${session.id}`);
}

app.get('/api/recordings', (req, res) => {
  try {
    const files = fs.readdirSync(RECORDINGS_DIR).filter(f => f.endsWith('.json'));
    const metas = [];
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(RECORDINGS_DIR, file), 'utf8'));
        // Extract first input line from events
        let firstInput = '';
        if (data.events) {
          // The first typed character may land in an output event (echoed)
          // before the recording captures it as input. Grab it.
          let prefix = '';
          for (const ev of data.events) {
            if (ev.type === 'i') break;
            if (ev.type === 'o' && !prefix) {
              const plain = ev.data
                .replace(/\x1b\[[^a-zA-Z]*[a-zA-Z]/g, '')
                .replace(/\x1b\[\?[0-9]*[a-z]/g, '')
                .replace(/[\x00-\x1f\x7f]/g, '')
                .trim();
              if (plain.length > 0) prefix = plain[0];
            }
          }
          let buf = '';
          for (const ev of data.events) {
            if (ev.type === 'i') {
              buf += ev.data;
              const nlIdx = buf.search(/[\r\n]/);
              if (nlIdx !== -1) {
                buf = buf.slice(0, nlIdx);
                break;
              }
            }
          }
          buf = buf.replace(/[\x00-\x1f\x7f]/g, '').trim();
          firstInput = (prefix + buf).trim();
        }
        metas.push({
          id: data.id,
          sessionId: data.sessionId,
          sessionName: data.sessionName,
          cwd: data.cwd,
          cols: data.cols,
          rows: data.rows,
          startedAt: data.startedAt,
          endedAt: data.endedAt,
          eventCount: data.events ? data.events.length : 0,
          firstInput: firstInput || null,
        });
      } catch {}
    }
    metas.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
    res.json(metas);
  } catch {
    res.json([]);
  }
});

app.get('/api/recordings/:id', (req, res) => {
  const filePath = path.join(RECORDINGS_DIR, req.params.id + '.json');
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json(data);
  } catch {
    res.status(404).json({ error: 'Recording not found' });
  }
});

app.delete('/api/recordings/:id', (req, res) => {
  const filePath = path.join(RECORDINGS_DIR, req.params.id + '.json');
  try { fs.unlinkSync(filePath); } catch {}
  res.json({ ok: true });
});

app.get('/api/file', (req, res) => {
  const homeDir = process.env.HOME || '/tmp';
  const filePath = path.resolve(req.query.path || '');
  if (!filePath || !filePath.startsWith(homeDir))
    return res.status(403).json({ error: 'Access denied' });
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > 10 * 1024 * 1024)
      return res.status(413).json({ error: 'File too large' });
    res.sendFile(filePath);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });

// Persistent session storage by client ID
const clientSessions = new Map();
const clientConnections = new Map();
const clientFileWatchers = new Map(); // clientId → Map<filePath, FSWatcher>


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

// Check if any PTY session has a claude child process
function isClaudeRunningInSessions(sessions) {
  const pids = [];
  for (const session of sessions.values()) {
    if (session.pty && session.pty.pid) {
      pids.push(session.pty.pid);
    }
  }
  if (pids.length === 0) return false;
  try {
    execSync(`pgrep -f -P ${pids.join(',')} claude`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Clean up old client data periodically
setInterval(() => {
  const now = Date.now();
  for (const [clientId, data] of clientSessions) {
    if (!clientConnections.has(clientId) && now - data.lastSeen > SESSION_TIMEOUT) {
      // Finalize any active recordings and kill PTY processes
      for (const session of data.sessions.values()) {
        if (session.recording) {
          stopRecording(session, data);
        }
        if (session.pty) {
          session.pty.kill();
        }
      }
      cleanupClientWatchers(clientId);
      clientSessions.delete(clientId);
      console.log(`Cleaned up stale client: ${clientId}`);
    }
  }
}, 60000);

// Poll Claude status per session every 3s — detect start/stop transitions
setInterval(() => {
  for (const [clientId, data] of clientSessions) {
    if (!clientConnections.has(clientId)) continue;
    const sessions = data.sessions;
    const statusMap = getClaudeStatusPerSession(sessions);
    for (const [sessionId, running] of statusMap) {
      const session = sessions.get(sessionId);
      if (!session) continue;
      const wasRunning = session.claudeRunning || false;
      if (running && !wasRunning) {
        startRecording(session, data);
      } else if (!running && wasRunning) {
        stopRecording(session, data);
      }
    }
  }
}, 3000);

// Flush active recordings to disk every 30s
setInterval(() => {
  for (const [, data] of clientSessions) {
    for (const session of data.sessions.values()) {
      if (session.recording) {
        flushRecording(session.recording);
      }
    }
  }
}, 30000);

function cleanupClientWatchers(clientId) {
  const watchers = clientFileWatchers.get(clientId);
  if (!watchers) return;
  for (const [, watcher] of watchers) {
    try { watcher.close(); } catch {}
  }
  clientFileWatchers.delete(clientId);
}

function unwatchFile(clientId, filePath) {
  const watchers = clientFileWatchers.get(clientId);
  if (!watchers) return;
  const watcher = watchers.get(filePath);
  if (watcher) {
    try { watcher.close(); } catch {}
    watchers.delete(filePath);
  }
  if (watchers.size === 0) clientFileWatchers.delete(clientId);
}

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
      history: [],
      recording: null,
      claudeRunning: false,
    };
    sessions.set(id, session);

    // Handle PTY data events - use clientData.sendToSession for current connection
    ptyProcess.onData((data) => {
      const sess = sessions.get(id);
      if (sess && sess.recording) {
        sess.recording.events.push({
          t: Date.now() - new Date(sess.recording.startedAt).getTime(),
          type: 'o',
          data,
        });
      }
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
            if (session.recording) {
              stopRecording(session, clientData);
            }
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

        case 'check-claude-running': {
          const running = isClaudeRunningInSessions(sessions);
          sendMessage('claude-running-status', { running });
          break;
        }

        case 'correct-english': {
          const { text, sessionId, mode } = msg;
          const prompt = mode === 'polish'
            ? `Improve this English text to sound more natural and polished while keeping the same meaning. Fix any grammar or spelling errors too. Rules: Do NOT capitalize the first letter if the original doesn't. Do NOT add trailing punctuation if the original doesn't have it. Return ONLY the improved text, nothing else:\n\n${text}`
            : `Fix grammar and improve this English text. Rules: Do NOT capitalize the first letter if the original doesn't. Do NOT add trailing punctuation (period, comma, etc.) if the original doesn't have it. Only fix actual grammar and spelling errors. Return ONLY the corrected text, nothing else:\n\n${text}`;

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

          if (session.recording) {
            session.recording.events.push({
              t: Date.now() - new Date(session.recording.startedAt).getTime(),
              type: 'i',
              data: msg.data,
            });
          }

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

        case 'get-cwd': {
          const session = sessions.get(msg.sessionId);
          if (!session || !session.pty) break;
          let cwd = process.env.HOME || '/tmp';
          try {
            const result = execSync(
              `lsof -p ${session.pty.pid} -a -d cwd -Fn | grep ^n | cut -c2-`,
              { timeout: 3000, encoding: 'utf8' }
            ).trim();
            if (result) cwd = result;
          } catch {}
          sendMessage('cwd-result', { cwd, home: process.env.HOME || '/tmp' });
          break;
        }

        case 'list-directory': {
          const homeDir = process.env.HOME || '/tmp';
          const requestedPath = path.resolve(msg.path || homeDir);
          if (!requestedPath.startsWith(homeDir)) {
            sendMessage('directory-listing', { error: 'Access denied', path: requestedPath });
            break;
          }
          try {
            const entries = fs.readdirSync(requestedPath, { withFileTypes: true });
            const items = [];
            for (const entry of entries) {
              if (!msg.showHidden && entry.name.startsWith('.')) continue;
              items.push({
                name: entry.name,
                type: entry.isDirectory() ? 'directory' : 'file',
                path: path.join(requestedPath, entry.name)
              });
            }
            items.sort((a, b) => {
              if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
              return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
            });
            sendMessage('directory-listing', { path: requestedPath, entries: items });
          } catch (err) {
            sendMessage('directory-listing', { error: err.message, path: requestedPath });
          }
          break;
        }

        case 'read-file': {
          if (!msg.path) break;
          const homeDir = process.env.HOME || '/tmp';
          const filePath = path.resolve(msg.path);
          if (!filePath.startsWith(homeDir)) {
            sendMessage('file-content', { error: 'Access denied', path: filePath });
            break;
          }
          try {
            const stat = fs.statSync(filePath);
            if (stat.size > 512 * 1024) {
              sendMessage('file-content', { error: 'File too large (max 512KB)', path: filePath });
              break;
            }
            const buffer = Buffer.alloc(Math.min(8192, stat.size));
            const fd = fs.openSync(filePath, 'r');
            fs.readSync(fd, buffer, 0, buffer.length, 0);
            fs.closeSync(fd);
            if (buffer.includes(0)) {
              sendMessage('file-content', { error: 'Binary file — cannot display', path: filePath });
              break;
            }
            const content = fs.readFileSync(filePath, 'utf8');
            sendMessage('file-content', { path: filePath, content, name: path.basename(filePath) });
          } catch (err) {
            sendMessage('file-content', { error: err.message, path: filePath });
          }
          break;
        }

        case 'watch-file': {
          if (!msg.path) break;
          const homeDir = process.env.HOME || '/tmp';
          const filePath = path.resolve(msg.path);
          if (!filePath.startsWith(homeDir)) break;

          // Get or create watchers map for this client
          if (!clientFileWatchers.has(clientId)) {
            clientFileWatchers.set(clientId, new Map());
          }
          const watchers = clientFileWatchers.get(clientId);

          // Already watching this file
          if (watchers.has(filePath)) break;

          try {
            let debounceTimer = null;
            const watcher = fs.watch(filePath, () => {
              // Debounce rapid changes (100ms)
              clearTimeout(debounceTimer);
              debounceTimer = setTimeout(() => {
                try {
                  const stat = fs.statSync(filePath);
                  if (stat.size > 512 * 1024) {
                    sendMessage('file-update', { error: 'File too large', path: filePath });
                    return;
                  }
                  const buf = Buffer.alloc(Math.min(8192, stat.size));
                  const fd = fs.openSync(filePath, 'r');
                  fs.readSync(fd, buf, 0, buf.length, 0);
                  fs.closeSync(fd);
                  if (buf.includes(0)) {
                    sendMessage('file-update', { error: 'Binary file', path: filePath });
                    return;
                  }
                  const content = fs.readFileSync(filePath, 'utf8');
                  sendMessage('file-update', { path: filePath, content });
                } catch (err) {
                  sendMessage('file-update', { error: err.message, path: filePath });
                  unwatchFile(clientId, filePath);
                }
              }, 100);
            });

            watcher.on('error', () => {
              unwatchFile(clientId, filePath);
            });

            watchers.set(filePath, watcher);
          } catch (err) {
            // Silently ignore watch failures (e.g. file doesn't exist)
          }
          break;
        }

        case 'unwatch-file': {
          if (!msg.path) break;
          const filePath = path.resolve(msg.path);
          unwatchFile(clientId, filePath);
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
    cleanupClientWatchers(clientId);
    // Sessions persist - don't delete them
  });
});
