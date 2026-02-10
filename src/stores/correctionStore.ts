import { create } from 'zustand';
import type { CorrectionState, CorrectionMode } from '@/types';

interface CorrectionStoreState {
  enabled: boolean;
  panelVisible: boolean;
  inputBuffer: string;
  pendingCorrection: { original: string; corrected: string } | null;
  waitingForCorrection: boolean;
  textValue: string;
  showingResult: boolean;
  diffHtml: string;
  mode: CorrectionMode;
  claudeRunning: boolean | null;

  /** Per-session saved states */
  sessionStates: Map<string, CorrectionState>;

  setEnabled: (enabled: boolean) => void;
  setPanelVisible: (visible: boolean) => void;
  setClaudeRunning: (running: boolean | null) => void;
  setInputBuffer: (buffer: string) => void;
  setPendingCorrection: (correction: { original: string; corrected: string } | null) => void;
  setWaitingForCorrection: (waiting: boolean) => void;
  setTextValue: (value: string) => void;
  setShowingResult: (showing: boolean) => void;
  setDiffHtml: (html: string) => void;
  setMode: (mode: CorrectionMode) => void;

  saveSessionState: (sessionId: string) => void;
  restoreSessionState: (sessionId: string) => void;
  clearSessionState: (sessionId: string) => void;
  reset: () => void;
}

export const useCorrectionStore = create<CorrectionStoreState>((set, get) => ({
  enabled: false,
  panelVisible: false,
  inputBuffer: '',
  pendingCorrection: null,
  waitingForCorrection: false,
  textValue: '',
  showingResult: false,
  diffHtml: '',
  mode: (localStorage.getItem('correction-mode') as CorrectionMode) || 'grammar',
  claudeRunning: null,
  sessionStates: new Map(),

  setEnabled: (enabled) => set({ enabled }),
  setPanelVisible: (panelVisible) => set({ panelVisible }),
  setClaudeRunning: (claudeRunning) => set({ claudeRunning }),
  setInputBuffer: (inputBuffer) => set({ inputBuffer }),
  setPendingCorrection: (pendingCorrection) => set({ pendingCorrection }),
  setWaitingForCorrection: (waitingForCorrection) => set({ waitingForCorrection }),
  setTextValue: (textValue) => set({ textValue }),
  setShowingResult: (showingResult) => set({ showingResult }),
  setDiffHtml: (diffHtml) => set({ diffHtml }),
  setMode: (mode) => {
    localStorage.setItem('correction-mode', mode);
    set({ mode });
  },

  saveSessionState: (sessionId) => {
    const state = get();
    const sessionStates = new Map(state.sessionStates);
    sessionStates.set(sessionId, {
      inputBuffer: state.inputBuffer,
      pendingCorrection: state.pendingCorrection,
      waitingForCorrection: state.waitingForCorrection,
      textValue: state.textValue,
      showingResult: state.showingResult,
      diffHtml: state.diffHtml,
      panelVisible: state.panelVisible,
    });
    set({ sessionStates });
  },

  restoreSessionState: (sessionId) => {
    const saved = get().sessionStates.get(sessionId);
    if (saved) {
      set({
        inputBuffer: saved.inputBuffer,
        pendingCorrection: saved.pendingCorrection,
        waitingForCorrection: saved.waitingForCorrection,
        textValue: saved.textValue,
        showingResult: saved.showingResult,
        diffHtml: saved.diffHtml,
        panelVisible: saved.panelVisible && get().enabled,
      });
    } else {
      set({
        inputBuffer: '',
        pendingCorrection: null,
        waitingForCorrection: false,
        textValue: '',
        showingResult: false,
        diffHtml: '',
        panelVisible: get().enabled,
      });
    }
  },

  clearSessionState: (sessionId) => {
    const sessionStates = new Map(get().sessionStates);
    sessionStates.delete(sessionId);
    set({ sessionStates });
  },

  reset: () =>
    set({
      inputBuffer: '',
      pendingCorrection: null,
      waitingForCorrection: false,
      textValue: '',
      showingResult: false,
      diffHtml: '',
      panelVisible: false,
    }),
}));
