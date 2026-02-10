import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRecordingStore } from '@/stores/recordingStore';
import { routeMessage } from '@/stores/messageRouter';

// Mock dependencies used by routeMessage
vi.mock('@/terminal/terminalInstance', () => ({
  getTerminalInstance: () => null,
}));
vi.mock('@/lib/highlighter', () => ({
  highlight: (s: string) => s,
}));
vi.mock('@/lib/api', () => ({
  fetchRecordings: vi.fn().mockResolvedValue([]),
  fetchRecording: vi.fn().mockResolvedValue(null),
  deleteRecording: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  useRecordingStore.setState({ activeRecordings: new Map() });
});

describe('messageRouter recording events', () => {
  it('recording-started sets active recording in store', () => {
    routeMessage({ type: 'recording-started', sessionId: 'session-1', recordingId: 'rec-abc' });
    expect(useRecordingStore.getState().activeRecordings.get('session-1')).toBe('rec-abc');
  });

  it('recording-stopped clears active recording from store', () => {
    useRecordingStore.getState().setActiveRecording('session-1', 'rec-abc');
    routeMessage({ type: 'recording-stopped', sessionId: 'session-1', recordingId: 'rec-abc' });
    expect(useRecordingStore.getState().activeRecordings.has('session-1')).toBe(false);
  });
});
