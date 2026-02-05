const WebSocket = require('ws');
const { spawn, execSync } = require('child_process');
const path = require('path');

describe('Integration tests', () => {
  let server;
  const PORT = 3099; // Use unlikely port for tests

  beforeAll((done) => {
    const serverPath = path.join(__dirname, '..', 'server.js');

    // Start actual server with test port
    server = spawn('node', [serverPath], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: String(PORT) }
    });

    server.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('Server:', output);
      if (output.includes('localhost:' + PORT) || output.includes('Server running')) {
        setTimeout(done, 500); // Give server time to fully start
      }
    });

    server.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });
  }, 15000);

  afterAll(() => {
    if (server) {
      server.kill('SIGTERM');
    }
  });

  test('WebSocket connection works', (done) => {
    const ws = new WebSocket(`ws://localhost:${PORT}?clientId=test-client-1`);

    ws.on('open', () => {
      ws.close();
      done();
    });

    ws.on('error', (err) => {
      done(err);
    });
  }, 10000);

  test('correction request receives response', (done) => {
    const ws = new WebSocket(`ws://localhost:${PORT}?clientId=test-client-2`);

    let sessionId = null;

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      console.log('Received message:', JSON.stringify(msg).substring(0, 100));

      // Server auto-creates a session on connect
      if (msg.type === 'session-created') {
        sessionId = msg.id;
        console.log('Got session:', sessionId);
      }

      // Wait for initial session to be created, then send correction
      if (msg.type === 'session-switched' && sessionId) {
        console.log('Session ready, sending correction request');
        ws.send(JSON.stringify({
          type: 'correct-english',
          text: 'me happy',
          sessionId: sessionId
        }));
      }

      if (msg.type === 'correction-result' || msg.type === 'correction-error') {
        console.log('Correction response:', msg);
        expect(msg.sessionId).toBe(sessionId);
        expect(msg.original).toBe('me happy');

        if (msg.type === 'correction-result') {
          expect(msg.corrected).toBeDefined();
          expect(msg.corrected.length).toBeGreaterThan(0);
        } else {
          expect(msg.error).toBeDefined();
        }

        ws.close();
        done();
      }
    });

    ws.on('error', (err) => {
      done(err);
    });
  }, 60000); // Allow 60s for claude CLI
});
