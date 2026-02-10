import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRecordingStore } from '@/stores/recordingStore';

vi.mock('@/lib/api', () => ({
  fetchRecordings: vi.fn().mockResolvedValue([]),
  fetchRecording: vi.fn().mockResolvedValue(null),
  deleteRecording: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  useRecordingStore.setState({
    recordings: [],
    visible: false,
    loading: false,
    viewingRecording: null,
    viewingLoading: false,
    activeRecordings: new Map(),
  });
});

describe('recordingStore', () => {
  it('setActiveRecording tracks per-session recording', () => {
    useRecordingStore.getState().setActiveRecording('session-1', 'rec-abc');
    const map = useRecordingStore.getState().activeRecordings;
    expect(map.get('session-1')).toBe('rec-abc');
  });

  it('clearActiveRecording removes session entry', () => {
    useRecordingStore.getState().setActiveRecording('session-1', 'rec-abc');
    useRecordingStore.getState().clearActiveRecording('session-1');
    expect(useRecordingStore.getState().activeRecordings.has('session-1')).toBe(false);
  });

  it('toggle shows/hides modal', () => {
    expect(useRecordingStore.getState().visible).toBe(false);
    useRecordingStore.getState().toggle();
    expect(useRecordingStore.getState().visible).toBe(true);
    useRecordingStore.getState().toggle();
    expect(useRecordingStore.getState().visible).toBe(false);
  });

  it('toggle preserves viewingRecording when hiding modal', () => {
    const rec = { id: 'x' } as any;
    useRecordingStore.setState({ visible: true, viewingRecording: rec });
    useRecordingStore.getState().toggle();
    expect(useRecordingStore.getState().viewingRecording).toBe(rec);
    expect(useRecordingStore.getState().visible).toBe(false);
  });

  it('toggle reopens with same viewingRecording', () => {
    const rec = { id: 'x' } as any;
    useRecordingStore.setState({ visible: false, viewingRecording: rec });
    useRecordingStore.getState().toggle();
    expect(useRecordingStore.getState().viewingRecording).toBe(rec);
    expect(useRecordingStore.getState().visible).toBe(true);
  });

  it('deleteRecording removes from list and closes viewer if viewing deleted', async () => {
    const rec = { id: 'rec-1', sessionId: 's1', sessionName: 'Main', cwd: '/', startedAt: '', endedAt: '', eventCount: 0 };
    useRecordingStore.setState({
      recordings: [rec as any],
      viewingRecording: { ...rec, events: [] } as any,
    });
    await useRecordingStore.getState().deleteRecording('rec-1');
    expect(useRecordingStore.getState().recordings).toHaveLength(0);
    expect(useRecordingStore.getState().viewingRecording).toBeNull();
  });
});
