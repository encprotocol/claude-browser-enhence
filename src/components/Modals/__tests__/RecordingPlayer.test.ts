import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Recording } from '@/types';

const { mockWrite, mockOpen, mockDispose, mockScrollToTop, mockResize, terminalInstances, resizeObserverInstances } = vi.hoisted(() => {
  // write(data, callback?) — invoke callback synchronously if provided
  const mockWrite = vi.fn((_data: string, cb?: () => void) => { if (cb) cb(); });
  const mockOpen = vi.fn();
  const mockDispose = vi.fn();
  const mockScrollToTop = vi.fn();
  const mockResize = vi.fn();
  const terminalInstances: any[] = [];
  const resizeObserverInstances: any[] = [];
  return { mockWrite, mockOpen, mockDispose, mockScrollToTop, mockResize, terminalInstances, resizeObserverInstances };
});

vi.mock('@xterm/xterm', () => {
  class MockTerminal {
    options: any;
    constructor(opts: any) {
      this.options = opts;
      terminalInstances.push({ opts, instance: this });
    }
    write = mockWrite;
    open = mockOpen;
    dispose = mockDispose;
    scrollToTop = mockScrollToTop;
    resize = mockResize;
    buffer = { normal: { baseY: 0, cursorY: 15 } };
  }
  return { Terminal: MockTerminal };
});

vi.mock('@xterm/xterm/css/xterm.css', () => ({}));

vi.mock('@/stores/themeStore', () => {
  const theme = {
    background: '#000', foreground: '#fff', cursor: '#fff', selection: '#333',
    black: '#000', red: '#f00', green: '#0f0', yellow: '#ff0',
    blue: '#00f', magenta: '#f0f', cyan: '#0ff', white: '#fff',
    brightBlack: '#666', header: '#111', tabbar: '#111', activeTab: '#111',
    accent: '#f00', keyword: '#fff', string: '#fff', number: '#fff', command: '#fff',
  };
  return {
    useThemeStore: Object.assign(
      (sel: (s: any) => any) => sel({ theme }),
      {
        getState: () => ({ theme, fontSettings: { fontSize: 14, lineHeight: 1.2 } }),
        subscribe: vi.fn(() => vi.fn()),
      }
    ),
  };
});

import { mountRecordingPlayer } from '@/components/Modals/RecordingPlayer';

describe('RecordingPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    terminalInstances.length = 0;
    resizeObserverInstances.length = 0;
    // Stub rAF to execute synchronously (jsdom doesn't provide it)
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    // Mock ResizeObserver (jsdom doesn't have it)
    vi.stubGlobal('ResizeObserver', class {
      callback: ResizeObserverCallback;
      disconnect = vi.fn();
      observe = vi.fn();
      unobserve = vi.fn();
      constructor(cb: ResizeObserverCallback) {
        this.callback = cb;
        resizeObserverInstances.push(this);
      }
    });
  });

  const testRecording: Recording = {
    id: 'rec-test',
    sessionId: 's1',
    sessionName: 'Main',
    cwd: '/home/user',
    startedAt: '2025-01-01T00:00:00Z',
    endedAt: '2025-01-01T00:01:00Z',
    eventCount: 4,
    cols: 120,
    rows: 40,
    events: [
      { t: 0, type: 'i', data: 'input\r' },
      { t: 50, type: 'o', data: 'Hello ' },
      { t: 100, type: 'o', data: 'World\r\n' },
    ],
  };

  it('creates Terminal with recorded cols and disableStdin', () => {
    const container = document.createElement('div');
    mountRecordingPlayer(container, testRecording);

    expect(terminalInstances).toHaveLength(1);
    const opts = terminalInstances[0].opts;
    expect(opts.cols).toBe(120);
    expect(opts.disableStdin).toBe(true);
  });

  it('writes only output events to terminal', () => {
    const container = document.createElement('div');
    mountRecordingPlayer(container, testRecording);

    expect(mockWrite).toHaveBeenCalledTimes(2);
    expect(mockWrite.mock.calls[0][0]).toBe('Hello ');
    expect(mockWrite.mock.calls[1][0]).toBe('World\r\n');
  });

  it('scrolls to top after writing events', () => {
    const container = document.createElement('div');
    mountRecordingPlayer(container, testRecording);

    // In mock env clientWidth/clientHeight are 0, so no resize happens
    // but scrollToTop should still be called after writing
    expect(mockScrollToTop).toHaveBeenCalled();
  });

  it('uses scrollback 10000 for scrollable content', () => {
    const container = document.createElement('div');
    mountRecordingPlayer(container, testRecording);

    const opts = terminalInstances[0].opts;
    expect(opts.scrollback).toBe(10000);
  });

  it('uses font settings from theme store', () => {
    const container = document.createElement('div');
    mountRecordingPlayer(container, testRecording);

    const opts = terminalInstances[0].opts;
    expect(opts.fontSize).toBe(14);
    expect(opts.lineHeight).toBe(1.2);
  });

  it('falls back to 80 cols when cols not in recording', () => {
    const container = document.createElement('div');
    const noSize: Recording = { ...testRecording, cols: undefined, rows: undefined };
    mountRecordingPlayer(container, noSize);

    const opts = terminalInstances[0].opts;
    expect(opts.cols).toBe(80);
  });

  it('returns a dispose function that cleans up the terminal', () => {
    const container = document.createElement('div');
    const dispose = mountRecordingPlayer(container, testRecording);
    dispose();

    expect(mockDispose).toHaveBeenCalled();
  });

  it('applies resize events during playback', () => {
    const container = document.createElement('div');
    const rec: Recording = {
      ...testRecording,
      events: [
        { t: 0, type: 'r', cols: 150, rows: 50 },
        { t: 10, type: 'o', data: 'after resize' },
      ],
      eventCount: 2,
    };
    mountRecordingPlayer(container, rec);

    // resize called: once for the 'r' event, possibly again for container fit
    expect(mockResize).toHaveBeenCalledWith(150, 50);
    expect(mockWrite).toHaveBeenCalledWith('after resize', expect.any(Function));
  });

  it('initializes terminal at first resize cols/rows', () => {
    const container = document.createElement('div');
    const rec: Recording = {
      ...testRecording,
      cols: 80,
      rows: 24,
      events: [
        { t: 0, type: 'r', cols: 160, rows: 48 },
        { t: 50, type: 'i', data: 'hi' },
        { t: 100, type: 'o', data: 'output' },
      ],
      eventCount: 3,
    };
    mountRecordingPlayer(container, rec);

    const opts = terminalInstances[0].opts;
    expect(opts.cols).toBe(160);
  });

  it('skips events before first input (trims header)', () => {
    const container = document.createElement('div');
    const rec: Recording = {
      ...testRecording,
      events: [
        { t: 0, type: 'o', data: 'Welcome banner\r\n' },
        { t: 50, type: 'o', data: 'ASCII art\r\n' },
        { t: 100, type: 'i', data: 'user input' },
        { t: 200, type: 'o', data: 'real output\r\n' },
      ],
      eventCount: 4,
    };
    mountRecordingPlayer(container, rec);

    // Only the output after first input should be written
    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(mockWrite.mock.calls[0][0]).toBe('real output\r\n');
  });

  it('plays everything if no input events exist', () => {
    const container = document.createElement('div');
    const rec: Recording = {
      ...testRecording,
      events: [
        { t: 0, type: 'o', data: 'line1' },
        { t: 100, type: 'o', data: 'line2' },
      ],
      eventCount: 2,
    };
    mountRecordingPlayer(container, rec);

    expect(mockWrite).toHaveBeenCalledTimes(2);
  });

  it('keeps resize events that occur after first input', () => {
    const container = document.createElement('div');
    const rec: Recording = {
      ...testRecording,
      events: [
        { t: 0, type: 'o', data: 'header\r\n' },
        { t: 100, type: 'i', data: 'go' },
        { t: 200, type: 'r', cols: 200, rows: 60 },
        { t: 300, type: 'o', data: 'wide output' },
      ],
      eventCount: 4,
    };
    mountRecordingPlayer(container, rec);

    expect(mockResize).toHaveBeenCalledWith(200, 60);
    expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(mockWrite.mock.calls[0][0]).toBe('wide output');
  });

  it('observes container with ResizeObserver and resizes terminal on callback', () => {
    const container = document.createElement('div');
    mountRecordingPlayer(container, testRecording);

    // ResizeObserver should have been created and called observe on the container
    expect(resizeObserverInstances).toHaveLength(1);
    const ro = resizeObserverInstances[0];
    expect(ro.observe).toHaveBeenCalledWith(container);

    // Simulate a resize: give the container a height and trigger the callback
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true });
    mockResize.mockClear();

    // Fire the ResizeObserver callback
    ro.callback([{ contentRect: { width: 800, height: 600 } }], ro);

    // term.resize should be called with recalculated rows
    expect(mockResize).toHaveBeenCalled();
  });

  it('disconnects ResizeObserver on dispose', () => {
    const container = document.createElement('div');
    const dispose = mountRecordingPlayer(container, testRecording);

    expect(resizeObserverInstances).toHaveLength(1);
    const ro = resizeObserverInstances[0];

    dispose();

    expect(ro.disconnect).toHaveBeenCalled();
  });
});
