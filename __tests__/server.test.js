const { spawn } = require('child_process');
const EventEmitter = require('events');

// Mock child_process.spawn
jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

describe('correct-english handler', () => {
  let mockProcess;
  let closeCallback;
  let errorCallback;

  beforeEach(() => {
    jest.useFakeTimers();

    mockProcess = {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      on: jest.fn((event, cb) => {
        if (event === 'close') closeCallback = cb;
        if (event === 'error') errorCallback = cb;
      }),
      kill: jest.fn()
    };

    spawn.mockReturnValue(mockProcess);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  // Helper to simulate the handler logic (mirrors server.js implementation)
  function simulateHandler(text, sessionId, sendMessage) {
    const prompt = `Fix grammar and improve this English text. Return ONLY the corrected text, nothing else:\n\n${text}`;

    const claude = spawn('claude', ['-p', prompt], {
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
  }

  test('spawns claude with correct arguments', () => {
    const sendMessage = jest.fn();
    simulateHandler('hello world', 'session-1', sendMessage);

    expect(spawn).toHaveBeenCalledWith(
      'claude',
      ['-p', expect.stringContaining('hello world')],
      expect.objectContaining({ stdio: ['ignore', 'pipe', 'pipe'] })
    );
  });

  test('sends correction-result on successful response', () => {
    const sendMessage = jest.fn();
    simulateHandler('I want to making', 'session-1', sendMessage);

    mockProcess.stdout.emit('data', Buffer.from('I want to make'));
    closeCallback(0);

    expect(sendMessage).toHaveBeenCalledWith('correction-result', {
      sessionId: 'session-1',
      original: 'I want to making',
      corrected: 'I want to make'
    });
  });

  test('sends correction-error on non-zero exit code', () => {
    const sendMessage = jest.fn();
    simulateHandler('test text', 'session-1', sendMessage);

    mockProcess.stderr.emit('data', Buffer.from('Command not found'));
    closeCallback(1);

    expect(sendMessage).toHaveBeenCalledWith('correction-error', {
      sessionId: 'session-1',
      original: 'test text',
      error: 'Command not found'
    });
  });

  test('sends default error message when no stderr', () => {
    const sendMessage = jest.fn();
    simulateHandler('test text', 'session-1', sendMessage);

    closeCallback(1);

    expect(sendMessage).toHaveBeenCalledWith('correction-error', {
      sessionId: 'session-1',
      original: 'test text',
      error: 'Correction failed'
    });
  });

  test('sends correction-error when empty result', () => {
    const sendMessage = jest.fn();
    simulateHandler('test text', 'session-1', sendMessage);

    mockProcess.stdout.emit('data', Buffer.from('   '));
    closeCallback(0);

    expect(sendMessage).toHaveBeenCalledWith('correction-error', {
      sessionId: 'session-1',
      original: 'test text',
      error: 'Correction failed'
    });
  });

  test('sends correction-error on spawn error', () => {
    const sendMessage = jest.fn();
    simulateHandler('test text', 'session-1', sendMessage);

    errorCallback(new Error('spawn ENOENT'));

    expect(sendMessage).toHaveBeenCalledWith('correction-error', {
      sessionId: 'session-1',
      original: 'test text',
      error: 'spawn ENOENT'
    });
  });

  test('trims whitespace from corrected result', () => {
    const sendMessage = jest.fn();
    simulateHandler('hello', 'session-1', sendMessage);

    mockProcess.stdout.emit('data', Buffer.from('\n  Hello.  \n'));
    closeCallback(0);

    expect(sendMessage).toHaveBeenCalledWith('correction-result', {
      sessionId: 'session-1',
      original: 'hello',
      corrected: 'Hello.'
    });
  });

  test('handles timeout', () => {
    const sendMessage = jest.fn();
    simulateHandler('test text', 'session-1', sendMessage);

    // Fast-forward past the timeout
    jest.advanceTimersByTime(30001);

    expect(mockProcess.kill).toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith('correction-error', {
      sessionId: 'session-1',
      original: 'test text',
      error: 'Correction timed out'
    });
  });
});
