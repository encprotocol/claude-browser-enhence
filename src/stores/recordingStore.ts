import { create } from 'zustand';
import type { RecordingMeta, Recording } from '@/types';
import { fetchRecordings, fetchRecording, deleteRecording as apiDeleteRecording } from '@/lib/api';

interface RecordingState {
  recordings: RecordingMeta[];
  visible: boolean;
  loading: boolean;
  viewingRecording: Recording | null;
  viewingLoading: boolean;
  activeRecordings: Map<string, string>;

  load: () => Promise<void>;
  viewRecording: (id: string) => Promise<void>;
  closeViewer: () => void;
  deleteRecording: (id: string) => Promise<void>;
  toggle: () => void;
  setVisible: (visible: boolean) => void;
  setActiveRecording: (sessionId: string, recordingId: string) => void;
  clearActiveRecording: (sessionId: string) => void;
}

export const useRecordingStore = create<RecordingState>((set, get) => ({
  recordings: [],
  visible: false,
  loading: false,
  viewingRecording: null,
  viewingLoading: false,
  activeRecordings: new Map(),

  load: async () => {
    set({ loading: true });
    const recordings = await fetchRecordings();
    set({ recordings, loading: false });
  },

  viewRecording: async (id) => {
    set({ viewingLoading: true });
    const recording = await fetchRecording(id);
    set({ viewingRecording: recording, viewingLoading: false });
  },

  closeViewer: () => set({ viewingRecording: null }),

  deleteRecording: async (id) => {
    await apiDeleteRecording(id);
    const recordings = get().recordings.filter((r) => r.id !== id);
    set({ recordings });
    if (get().viewingRecording?.id === id) {
      set({ viewingRecording: null });
    }
  },

  toggle: () => {
    set({ visible: !get().visible });
  },

  setVisible: (visible) => set({ visible }),

  setActiveRecording: (sessionId, recordingId) => {
    const map = new Map(get().activeRecordings);
    map.set(sessionId, recordingId);
    set({ activeRecordings: map });
  },

  clearActiveRecording: (sessionId) => {
    const map = new Map(get().activeRecordings);
    map.delete(sessionId);
    set({ activeRecordings: map });
  },
}));
