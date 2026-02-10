import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Recording } from '@/types';

const { mockWrite, mockOpen, mockDispose, mockScrollToTop, mockResize, terminalInstances } = vi.hoisted(() => {
  // write(data, callback?) — invoke callback synchronously if provided
  const mockWrite = vi.fn((_data: string, cb?: () => void) => { if (cb) cb(); });
  const mockOpen = vi.fn();
  const mockDispose = vi.fn();
  const mockScrollToTop = vi.fn();
  const mockResize = vi.fn();
  const terminalInstances: any[] = [];
  return { mockWrite, mockOpen, mockDispose, mockScrollToTop, mockResize, terminalInstances };
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
  });

  const testRecording: Recording = {
    id: 'rec-test',
    sessionId: 's1',
    sessionName: 'Main',
    cwd: '/home/user',
    startedAt: '2025-01-01T00:00:00Z',
    endedAt: '2025-01-01T00:01:00Z',
    eventCount: 3,
    cols: 120,
    rows: 40,
    events: [
      { t: 0, type: 'o', data: 'Hello ' },
      { t: 100, type: 'i', data: 'input\r' },
      { t: 200, type: 'o', data: 'World\r\n' },
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
});
