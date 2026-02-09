import { create } from 'zustand';
import type { Session } from '@/types';

interface SessionState {
  sessions: Map<string, Session>;
  activeSessionId: string | null;
  addSession: (id: string, name: string) => void;
  removeSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  setActiveSession: (id: string) => void;
  clearSessions: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: new Map(),
  activeSessionId: null,

  addSession: (id, name) =>
    set((state) => {
      const sessions = new Map(state.sessions);
      sessions.set(id, { id, name });
      return { sessions };
    }),

  removeSession: (id) =>
    set((state) => {
      const sessions = new Map(state.sessions);
      sessions.delete(id);
      return { sessions };
    }),

  renameSession: (id, name) =>
    set((state) => {
      const sessions = new Map(state.sessions);
      const session = sessions.get(id);
      if (session) sessions.set(id, { ...session, name });
      return { sessions };
    }),

  setActiveSession: (id) => set({ activeSessionId: id }),

  clearSessions: () => set({ sessions: new Map(), activeSessionId: null }),
}));
