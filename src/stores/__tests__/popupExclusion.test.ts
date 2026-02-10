import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTodoStore } from '@/stores/todoStore';
import { useNotesStore } from '@/stores/notesStore';
import { useRecordingStore } from '@/stores/recordingStore';

// Mock API calls
vi.mock('@/lib/api', () => ({
  fetchTodos: vi.fn().mockResolvedValue([]),
  saveTodos: vi.fn(),
  fetchNotes: vi.fn().mockResolvedValue([]),
  saveNotes: vi.fn(),
  deleteNote: vi.fn(),
  uploadFile: vi.fn(),
  fetchRecordings: vi.fn().mockResolvedValue([]),
  fetchRecording: vi.fn(),
  deleteRecording: vi.fn(),
}));

beforeEach(() => {
  useTodoStore.setState({ visible: false });
  useNotesStore.setState({ visible: false, editingNoteId: null });
  useRecordingStore.setState({ visible: false });
});

describe('Popup mutual exclusion', () => {
  it('opening Todos closes Notes and Recordings', () => {
    useNotesStore.setState({ visible: true });
    useRecordingStore.setState({ visible: true });

    useTodoStore.getState().toggle();

    expect(useTodoStore.getState().visible).toBe(true);
    expect(useNotesStore.getState().visible).toBe(false);
    expect(useRecordingStore.getState().visible).toBe(false);
  });

  it('opening Notes closes Todos and Recordings', () => {
    useTodoStore.setState({ visible: true });
    useRecordingStore.setState({ visible: true });

    useNotesStore.getState().toggle();

    expect(useNotesStore.getState().visible).toBe(true);
    expect(useTodoStore.getState().visible).toBe(false);
    expect(useRecordingStore.getState().visible).toBe(false);
  });

  it('opening Recordings closes Todos and Notes', () => {
    useTodoStore.setState({ visible: true });
    useNotesStore.setState({ visible: true });

    useRecordingStore.getState().toggle();

    expect(useRecordingStore.getState().visible).toBe(true);
    expect(useTodoStore.getState().visible).toBe(false);
    expect(useNotesStore.getState().visible).toBe(false);
  });

  it('closing a popup does NOT affect other popups', () => {
    useTodoStore.setState({ visible: true });
    useNotesStore.setState({ visible: true });

    // Toggle Todos off
    useTodoStore.getState().toggle();

    expect(useTodoStore.getState().visible).toBe(false);
    // Notes should still be open
    expect(useNotesStore.getState().visible).toBe(true);
  });
});
