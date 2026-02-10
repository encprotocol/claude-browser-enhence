import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

// Mock autoType
const scheduleAutoTypeMock = vi.fn();
vi.mock('@/lib/autoType', () => ({
  scheduleAutoType: (...args: unknown[]) => scheduleAutoTypeMock(...args),
  cancelAutoType: vi.fn(),
}));

// Mock api
vi.mock('@/lib/api', () => ({
  fetchRecordings: vi.fn().mockResolvedValue([]),
  fetchRecording: vi.fn().mockResolvedValue(null),
  deleteRecording: vi.fn().mockResolvedValue(undefined),
  fetchRecordingSummary: vi.fn().mockRejectedValue(new Error('not found')),
  generateRecordingSummary: vi.fn().mockResolvedValue({}),
}));

// Mock connectionStore
const sendMessageMock = vi.fn();
vi.mock('@/stores/connectionStore', () => ({
  useConnectionStore: {
    getState: () => ({
      sendMessage: sendMessageMock,
    }),
  },
}));

// Mock popupManager
vi.mock('@/lib/popupManager', () => ({
  closeAllPopups: vi.fn(),
}));

// Mock ansi
vi.mock('@/lib/ansi', () => ({
  buildCleanTranscript: vi.fn((events: unknown[]) => [
    { type: 'input', text: 'hello' },
    { type: 'response', text: 'world' },
  ]),
  formatTranscriptForPrompt: vi.fn((segments: unknown[]) => '[input] hello\n[response] world'),
}));

import { useRecordingStore } from '@/stores/recordingStore';
import { buildCleanTranscript, formatTranscriptForPrompt } from '@/lib/ansi';
import type { Recording, RecordingSummary } from '@/types';

function makeRecording(overrides: Partial<Recording> = {}): Recording {
  return {
    id: 'rec-1',
    sessionId: 's1',
    sessionName: 'Main',
    cwd: '/Users/test/project',
    startedAt: '2025-01-01T00:00:00.000Z',
    endedAt: '2025-01-01T01:00:00.000Z',
    eventCount: 10,
    events: [
      { t: 0, type: 'o', data: 'hello' },
      { t: 100, type: 'i', data: 'world\r' },
    ],
    ...overrides,
  };
}

describe('recordingStore.bringBackSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRecordingStore.setState({
      recordings: [],
      visible: true,
      loading: false,
      viewingRecording: makeRecording(),
      viewingLoading: false,
      lastViewedId: null,
      activeRecordings: new Map(),
      summary: null,
      summaryLoading: false,
      summaryError: null,
      bringBackLoading: false,
    });
  });

  it('bringBackSession("transcript") calls buildCleanTranscript and sends create-session with cwd', () => {
    useRecordingStore.getState().bringBackSession('transcript');

    expect(buildCleanTranscript).toHaveBeenCalledWith(
      useRecordingStore.getState().viewingRecording?.events ?? expect.any(Array)
    );
    expect(formatTranscriptForPrompt).toHaveBeenCalled();

    expect(sendMessageMock).toHaveBeenCalledWith('create-session', {
      name: expect.stringContaining('Resume'),
      cwd: '/Users/test/project',
    });

    expect(scheduleAutoTypeMock).toHaveBeenCalledWith(
      expect.stringContaining('[input] hello')
    );
  });

  it('bringBackSession("summary") uses stored summary', () => {
    const summary: RecordingSummary = {
      abstract: 'Fixed a bug in auth',
      detail: 'The user reported an authentication issue...',
      generatedAt: '2025-01-01T02:00:00.000Z',
      eventCount: 10,
    };
    useRecordingStore.setState({ summary });

    useRecordingStore.getState().bringBackSession('summary');

    expect(sendMessageMock).toHaveBeenCalledWith('create-session', {
      name: expect.stringContaining('Resume'),
      cwd: '/Users/test/project',
    });

    // scheduleAutoType should receive the summary text, not transcript
    const autoTypeArg = scheduleAutoTypeMock.mock.calls[0][0] as string;
    expect(autoTypeArg).toContain('Fixed a bug in auth');
    expect(autoTypeArg).toContain('The user reported an authentication issue');

    // Should NOT call buildCleanTranscript
    expect(buildCleanTranscript).not.toHaveBeenCalled();
  });

  it('truncates transcript >50K chars at line boundary with prefix marker', () => {
    // Make formatTranscriptForPrompt return a huge string
    (formatTranscriptForPrompt as Mock).mockReturnValueOnce(
      Array(600).fill('A'.repeat(100)).join('\n') // 600 lines * 101 chars = ~60600 chars
    );

    useRecordingStore.getState().bringBackSession('transcript');

    const autoTypeArg = scheduleAutoTypeMock.mock.calls[0][0] as string;
    expect(autoTypeArg.length).toBeLessThanOrEqual(50100); // 50K + small prefix
    expect(autoTypeArg).toContain('... (truncated)');
  });

  it('closes viewer and modal', () => {
    useRecordingStore.getState().bringBackSession('transcript');

    const state = useRecordingStore.getState();
    expect(state.viewingRecording).toBeNull();
    expect(state.visible).toBe(false);
  });

  it('does nothing if no recording is being viewed', () => {
    useRecordingStore.setState({ viewingRecording: null });

    useRecordingStore.getState().bringBackSession('transcript');

    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(scheduleAutoTypeMock).not.toHaveBeenCalled();
  });
});
