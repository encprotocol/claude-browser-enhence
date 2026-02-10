import { useTodoStore } from '@/stores/todoStore';
import { useNotesStore } from '@/stores/notesStore';
import { useRecordingStore } from '@/stores/recordingStore';

/**
 * Closes all modal popups (Todos, Notes, Recordings).
 * Call before opening a new one to enforce mutual exclusion.
 */
export function closeAllPopups() {
  useTodoStore.getState().setVisible(false);
  useNotesStore.getState().setVisible(false);
  useRecordingStore.getState().setVisible(false);
}
