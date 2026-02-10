const express = require('express');
const { WebSocketServer } = require('ws');
const { execSync } = require('child_process');
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

// --- LLM Provider Support ---
const LLM_CONFIG_FILE = 'config.json';
const LLM_DEFAULT_CONFIG = { activeProvider: '', providers: {} };

function getLLMConfig() {
  return readJSON(LLM_CONFIG_FILE, LLM_DEFAULT_CONFIG);
}

function saveLLMConfigFile(config) {
  writeJSON(LLM_CONFIG_FILE, config);
}

async function callAnthropic(apiKey, prompt, opts = {}) {
  const { maxTokens = 1024, timeoutMs = 30000 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API ${res.status}: ${err}`);
    }
    const data = await res.json();
    return data.content[0].text;
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(apiKey, prompt, opts = {}) {
  const { maxTokens = 1024, timeoutMs = 30000 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API ${res.status}: ${err}`);
    }
    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAI(apiKey, prompt, opts = {}) {
  const { maxTokens = 1024, timeoutMs = 30000 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API ${res.status}: ${err}`);
    }
    const data = await res.json();
    return data.choices[0].message.content;
  } finally {
    clearTimeout(timer);
  }
}

async function callLLM(prompt, opts = {}) {
  const config = getLLMConfig();
  const provider = config.activeProvider || '';
  const providers = config.providers || {};
  const providerConfig = provider ? providers[provider] : undefined;
  if (!provider || !providerConfig || !providerConfig.apiKey) {
    throw new Error('No LLM provider configured');
  }
  const apiKey = providerConfig.apiKey;
  switch (provider) {
    case 'anthropic': return callAnthropic(apiKey, prompt, opts);
    case 'gemini': return callGemini(apiKey, prompt, opts);
    case 'openai': return callOpenAI(apiKey, prompt, opts);
    default: throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

function getLLMConfigStatus() {
  const config = getLLMConfig();
  const provider = config.activeProvider || '';
  const providers = config.providers || {};
  const providerConfig = provider ? providers[provider] : undefined;
  const configured = !!(provider && providerConfig && providerConfig.apiKey);
  return { configured, activeProvider: provider };
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

function extractFirstInput(events) {
  if (!events || events.length === 0) return '';
  // Grab possible leading character from output echo
  let prefix = '';
  for (const ev of events) {
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
  for (const ev of events) {
    if (ev.type === 'i') {
      buf += ev.data;
      const nlIdx = buf.search(/[\r\n]/);
      if (nlIdx !== -1) {
        buf = buf.slice(0, nlIdx);
        break;
      }
    }
  }
  buf = buf
    .replace(/\x1b\[[?>=!]?[0-9;]*[A-Za-z~]/g, '')
    .replace(/\x1bO./g, '')
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b./g, '');
  const chars = [];
  for (const ch of buf) {
    if (ch === '\x7f' || ch === '\x08') {
      chars.pop();
    } else if (ch.charCodeAt(0) >= 0x20) {
      chars.push(ch);
    }
  }
  buf = chars.join('').trim();
  return (prefix + buf).trim();
}

function stopRecording(session, clientData) {
  const recording = session.recording;
  if (!recording) return;
  recording.endedAt = new Date().toISOString();
  const recordingId = recording.id;
  session.recording = null;
  session.claudeRunning = false;

  // Discard recordings with no real user input
  const firstInput = extractFirstInput(recording.events);
  if (!firstInput) {
    try { fs.unlinkSync(path.join(RECORDINGS_DIR, recordingId + '.json')); } catch {}
    console.log(`Recording discarded (no input): ${recordingId}`);
  } else {
    flushRecording(recording);
    console.log(`Recording stopped: ${recordingId} for session ${session.id}`);
  }

  if (clientData.sendMessage) {
    clientData.sendMessage('recording-stopped', { sessionId: session.id, recordingId });
  }
}

app.get('/api/recordings', (req, res) => {
  try {
    const files = fs.readdirSync(RECORDINGS_DIR).filter(f => f.endsWith('.json') && !f.endsWith('.summary.json'));
    const metas = [];
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(RECORDINGS_DIR, file), 'utf8'));
        const firstInput = extractFirstInput(data.events);
        // Skip recordings with no real user input
        if (!firstInput) continue;
        // Check for sidecar summary file
        let hasSummary = false;
        let summaryEventCount;
        const summaryPath = path.join(RECORDINGS_DIR, data.id + '.summary.json');
        try {
          const summaryData = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
          hasSummary = true;
          summaryEventCount = summaryData.eventCount;
        } catch {}

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
          hasSummary,
          summaryEventCount,
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
  // Also delete sidecar summary
  const summaryPath = path.join(RECORDINGS_DIR, req.params.id + '.summary.json');
  try { fs.unlinkSync(summaryPath); } catch {}
  res.json({ ok: true });
});

app.get('/api/recordings/:id/summary', (req, res) => {
  const summaryPath = path.join(RECORDINGS_DIR, req.params.id + '.summary.json');
  try {
    const data = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    res.json(data);
  } catch {
    res.status(404).json({ error: 'No summary found' });
  }
});

app.post('/api/recordings/:id/summary', async (req, res) => {
  const { transcript } = req.body;
  if (!transcript) return res.status(400).json({ error: 'Missing transcript' });

  // Verify recording exists
  const recPath = path.join(RECORDINGS_DIR, req.params.id + '.json');
  let eventCount = 0;
  try {
    const recData = JSON.parse(fs.readFileSync(recPath, 'utf8'));
    eventCount = recData.events ? recData.events.length : 0;
  } catch {
    return res.status(404).json({ error: 'Recording not found' });
  }

  const prompt = `You are summarizing a terminal recording of a Claude Code session.

Write your response in EXACTLY this format (keep the ABSTRACT: and DETAIL: labels):

ABSTRACT: A single sentence (max 30 words) summarizing what was accomplished.

DETAIL:
A detailed summary of the session (3-8 paragraphs). Cover:
- What the user asked for or wanted to achieve
- Key actions taken and decisions made
- Files modified or created
- Problems encountered and how they were resolved
- Final outcome and what was accomplished

Write in past tense. Be specific about file names, functions, and technical details. Do not use bullet points in the detail section — write flowing paragraphs.

Transcript:
${transcript}`;

  try {
    const raw = await callLLM(prompt, { maxTokens: 2048, timeoutMs: 60000 });
    const trimmed = raw.trim();
    // Parse ABSTRACT: and DETAIL: sections
    let abstract = '';
    let detail = trimmed;
    const abstractMatch = trimmed.match(/^ABSTRACT:\s*(.+?)(?:\n|$)/i);
    if (abstractMatch) {
      abstract = abstractMatch[1].trim();
      const detailMatch = trimmed.match(/DETAIL:\s*\n?([\s\S]*)/i);
      detail = detailMatch ? detailMatch[1].trim() : trimmed.replace(abstractMatch[0], '').trim();
    }
    const summary = {
      abstract,
      detail,
      generatedAt: new Date().toISOString(),
      eventCount,
    };
    const summaryPath = path.join(RECORDINGS_DIR, req.params.id + '.summary.json');
    try {
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    } catch {}
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Summary generation failed' });
  }
});

// --- LLM Config API ---
app.get('/api/llm-config', (req, res) => {
  const config = getLLMConfig();
  const providers = config.providers || {};
  const result = {
    activeProvider: config.activeProvider || '',
    providers: {},
  };
  for (const name of ['anthropic', 'gemini', 'openai']) {
    result.providers[name] = {
      configured: !!(providers[name] && providers[name].apiKey),
    };
  }
  res.json(result);
});

app.put('/api/llm-config', (req, res) => {
  const config = getLLMConfig();
  if (req.body.activeProvider !== undefined) {
    config.activeProvider = req.body.activeProvider;
  }
  if (req.body.providers) {
    if (!config.providers) config.providers = {};
    for (const [name, data] of Object.entries(req.body.providers)) {
      if (data && data.apiKey !== undefined) {
        config.providers[name] = { apiKey: data.apiKey };
      }
    }
  }
  saveLLMConfigFile(config);
  // Return sanitized config (no keys exposed)
  const providers = config.providers || {};
  const result = {
    activeProvider: config.activeProvider || '',
    providers: {},
  };
  for (const name of ['anthropic', 'gemini', 'openai']) {
    result.providers[name] = {
      configured: !!(providers[name] && providers[name].apiKey),
    };
  }
  // Broadcast LLM config status to all connected clients
  const status = getLLMConfigStatus();
  for (const [, clientWs] of clientConnections) {
    if (clientWs.readyState === clientWs.OPEN) {
      clientWs.send(JSON.stringify({ type: 'llm-config-status', ...status }));
    }
  }
  res.json(result);
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

  const createSession = (name, cwd) => {
    const id = `session-${++clientData.sessionCounter}`;
    const sessionName = name || `Shell ${clientData.sessionCounter}`;

    // Spawn a persistent PTY shell for this session
    // Use the user's default shell or fall back to /bin/zsh (common on macOS)
    const shell = process.env.SHELL || '/bin/zsh';
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: (cwd && fs.existsSync(cwd)) ? cwd : (process.env.HOME || '/tmp'),
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

  // Send LLM config status on connection
  const llmStatus = getLLMConfigStatus();
  sendMessage('llm-config-status', llmStatus);

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
          const id = createSession(msg.name, msg.cwd);
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
          const llmCfgStatus = getLLMConfigStatus();
          sendMessage('llm-config-status', llmCfgStatus);
          break;
        }

        case 'correct-english': {
          const { text, sessionId, mode } = msg;
          const prompt = mode === 'polish'
            ? `Improve this English text to sound more natural and polished while keeping the same meaning. Fix any grammar or spelling errors too. Rules: Do NOT capitalize the first letter if the original doesn't. Do NOT add trailing punctuation if the original doesn't have it. Return ONLY the improved text, nothing else:\n\n${text}`
            : `Fix grammar and improve this English text. Rules: Do NOT capitalize the first letter if the original doesn't. Do NOT add trailing punctuation (period, comma, etc.) if the original doesn't have it. Only fix actual grammar and spelling errors. Return ONLY the corrected text, nothing else:\n\n${text}`;

          callLLM(prompt, { timeoutMs: 30000 })
            .then((result) => {
              sendMessage('correction-result', {
                sessionId,
                original: text,
                corrected: result.trim(),
              });
            })
            .catch((err) => {
              sendMessage('correction-error', {
                sessionId,
                original: text,
                error: err.message || 'Correction failed',
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
            if (session.recording) {
              session.recording.events.push({
                t: Date.now() - new Date(session.recording.startedAt).getTime(),
                type: 'r',
                cols: msg.cols,
                rows: msg.rows,
              });
              session.recording.cols = msg.cols;
              session.recording.rows = msg.rows;
            }
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
