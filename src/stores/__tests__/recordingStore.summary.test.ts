import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRecordingStore } from '@/stores/recordingStore';

vi.mock('@/lib/api', () => ({
  fetchRecordings: vi.fn().mockResolvedValue([]),
  fetchRecording: vi.fn().mockResolvedValue(null),
  deleteRecording: vi.fn().mockResolvedValue(undefined),
  fetchRecordingSummary: vi.fn().mockResolvedValue(null),
  generateRecordingSummary: vi.fn().mockResolvedValue({
    abstract: 'Test abstract',
    detail: 'Test detailed summary',
    generatedAt: '2025-01-01T00:00:00Z',
    eventCount: 10,
  }),
}));

vi.mock('@/lib/ansi', () => ({
  buildCleanTranscript: vi.fn().mockReturnValue([
    { type: 'input', text: 'hello' },
    { type: 'response', text: 'world' },
  ]),
  formatTranscriptForPrompt: vi.fn().mockReturnValue('[input] hello\n[response] world'),
}));

beforeEach(() => {
  useRecordingStore.setState({
    recordings: [],
    visible: false,
    loading: false,
    viewingRecording: null,
    viewingLoading: false,
    lastViewedId: null,
    activeRecordings: new Map(),
    summary: null,
    summaryLoading: false,
    summaryError: null,
  });
});

describe('recordingStore summary', () => {
  it('has initial summary state as null/false', () => {
    const state = useRecordingStore.getState();
    expect(state.summary).toBeNull();
    expect(state.summaryLoading).toBe(false);
    expect(state.summaryError).toBeNull();
  });

  it('loadSummary fetches and sets summary', async () => {
    const { fetchRecordingSummary } = await import('@/lib/api');
    (fetchRecordingSummary as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      abstract: 'Loaded abstract',
      detail: 'Loaded detailed summary',
      generatedAt: '2025-01-01T00:00:00Z',
      eventCount: 5,
    });

    await useRecordingStore.getState().loadSummary('rec-1');
    const state = useRecordingStore.getState();
    expect(state.summary).toEqual({
      abstract: 'Loaded abstract',
      detail: 'Loaded detailed summary',
      generatedAt: '2025-01-01T00:00:00Z',
      eventCount: 5,
    });
    expect(state.summaryLoading).toBe(false);
  });

  it('loadSummary sets null when no summary exists', async () => {
    const { fetchRecordingSummary } = await import('@/lib/api');
    (fetchRecordingSummary as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    await useRecordingStore.getState().loadSummary('rec-1');
    expect(useRecordingStore.getState().summary).toBeNull();
  });

  it('generateSummary creates summary from viewing recording', async () => {
    useRecordingStore.setState({
      viewingRecording: {
        id: 'rec-1',
        sessionId: 's1',
        sessionName: 'Main',
        cwd: '/',
        startedAt: '',
        endedAt: '',
        eventCount: 10,
        events: [{ t: 0, type: 'i', data: 'hello' }],
      } as any,
    });

    await useRecordingStore.getState().generateSummary('rec-1');
    const state = useRecordingStore.getState();
    expect(state.summary).toEqual({
      abstract: 'Test abstract',
      detail: 'Test detailed summary',
      generatedAt: '2025-01-01T00:00:00Z',
      eventCount: 10,
    });
    expect(state.summaryLoading).toBe(false);
  });

  it('generateSummary sets error on failure', async () => {
    const { generateRecordingSummary } = await import('@/lib/api');
    (generateRecordingSummary as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Claude not available')
    );

    useRecordingStore.setState({
      viewingRecording: {
        id: 'rec-1',
        events: [{ t: 0, type: 'i', data: 'test' }],
      } as any,
    });

    await useRecordingStore.getState().generateSummary('rec-1');
    const state = useRecordingStore.getState();
    expect(state.summaryError).toBe('Claude not available');
    expect(state.summaryLoading).toBe(false);
  });

  it('clearSummary resets summary state', () => {
    useRecordingStore.setState({
      summary: { abstract: 'abs', detail: 'text', generatedAt: '', eventCount: 5 },
      summaryLoading: true,
      summaryError: 'some error',
    });

    useRecordingStore.getState().clearSummary();
    const state = useRecordingStore.getState();
    expect(state.summary).toBeNull();
    expect(state.summaryLoading).toBe(false);
    expect(state.summaryError).toBeNull();
  });

  it('closeViewer clears summary state', () => {
    useRecordingStore.setState({
      viewingRecording: { id: 'x' } as any,
      summary: { abstract: 'abs', detail: 'text', generatedAt: '', eventCount: 5 },
    });

    useRecordingStore.getState().closeViewer();
    expect(useRecordingStore.getState().summary).toBeNull();
    expect(useRecordingStore.getState().viewingRecording).toBeNull();
  });
});
