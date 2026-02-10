import { create } from 'zustand';
import type { RecordingMeta, Recording, RecordingSummary } from '@/types';
import {
  fetchRecordings, fetchRecording, deleteRecording as apiDeleteRecording,
  fetchRecordingSummary, generateRecordingSummary as apiGenerateSummary,
} from '@/lib/api';
import { buildCleanTranscript, formatTranscriptForPrompt } from '@/lib/ansi';
import { closeAllPopups } from '@/lib/popupManager';

interface RecordingState {
  recordings: RecordingMeta[];
  visible: boolean;
  loading: boolean;
  viewingRecording: Recording | null;
  viewingLoading: boolean;
  lastViewedId: string | null;
  activeRecordings: Map<string, string>;
  summary: RecordingSummary | null;
  summaryLoading: boolean;
  summaryError: string | null;

  load: () => Promise<void>;
  viewRecording: (id: string) => Promise<void>;
  closeViewer: () => void;
  deleteRecording: (id: string) => Promise<void>;
  toggle: () => void;
  setVisible: (visible: boolean) => void;
  setActiveRecording: (sessionId: string, recordingId: string) => void;
  clearActiveRecording: (sessionId: string) => void;
  loadSummary: (id: string) => Promise<void>;
  generateSummary: (id: string) => Promise<void>;
  clearSummary: () => void;
}

export const useRecordingStore = create<RecordingState>((set, get) => ({
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

  load: async () => {
    set({ loading: true });
    const recordings = await fetchRecordings();
    set({ recordings, loading: false });
  },

  viewRecording: async (id) => {
    set({ viewingLoading: true, summary: null, summaryLoading: false, summaryError: null });
    const recording = await fetchRecording(id);
    set({ viewingRecording: recording, viewingLoading: false, lastViewedId: id });
    // Auto-load cached summary
    fetchRecordingSummary(id).then(summary => {
      if (get().viewingRecording?.id === id) {
        set({ summary });
      }
    }).catch(() => {});
  },

  closeViewer: () => set({ viewingRecording: null, summary: null, summaryLoading: false, summaryError: null }),

  deleteRecording: async (id) => {
    await apiDeleteRecording(id);
    const recordings = get().recordings.filter((r) => r.id !== id);
    set({ recordings });
    if (get().viewingRecording?.id === id) {
      set({ viewingRecording: null });
    }
  },

  toggle: () => {
    const willOpen = !get().visible;
    if (willOpen) closeAllPopups();
    set({ visible: willOpen });
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

  loadSummary: async (id) => {
    set({ summaryLoading: true, summaryError: null });
    try {
      const summary = await fetchRecordingSummary(id);
      set({ summary, summaryLoading: false });
    } catch {
      set({ summary: null, summaryLoading: false });
    }
  },

  generateSummary: async (id) => {
    const recording = get().viewingRecording;
    if (!recording || !recording.events.length) return;

    set({ summaryLoading: true, summaryError: null });
    try {
      const segments = buildCleanTranscript(recording.events);
      const transcript = formatTranscriptForPrompt(segments);
      const summary = await apiGenerateSummary(id, transcript);
      set({ summary, summaryLoading: false });
    } catch (err: any) {
      set({ summaryError: err.message || 'Summary generation failed', summaryLoading: false });
    }
  },

  clearSummary: () => set({ summary: null, summaryLoading: false, summaryError: null }),
}));
