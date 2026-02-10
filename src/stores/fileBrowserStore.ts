import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useConnectionStore } from '@/stores/connectionStore';
import { useSessionStore } from '@/stores/sessionStore';
import type { FileEntry } from '@/types';

interface SessionFBState {
  currentRoot: string;
  expandedDirs: Set<string>;
  dirCache: Map<string, FileEntry[]>;
  scrollTop: number;
}

type ViewerMode = 'text' | 'image' | 'pdf' | 'none';

interface FileBrowserState {
  visible: boolean;
  showHidden: boolean;
  linked: boolean;
  currentRoot: string;
  home: string;
  expandedDirs: Set<string>;
  dirCache: Map<string, FileEntry[]>;
  previousRoot: string;

  // Viewer state
  viewerVisible: boolean;
  viewerMode: ViewerMode;
  viewerFileName: string;
  viewerFilePath: string;
  viewerContent: string;
  viewerIsError: boolean;
  viewerRendered: boolean;
  viewerRawContent: string;
  viewerScrollTop: number;
  watchedFile: string | null;
  liveActive: boolean;
  viewerWidth: number;

  // Per-session state
  sessionStates: Map<string, SessionFBState>;

  // Actions
  setVisible: (visible: boolean) => void;
  toggle: () => void;
  setShowHidden: (show: boolean) => void;
  setLinked: (linked: boolean) => void;
  setHome: (home: string) => void;
  setViewerWidth: (width: number) => void;
  setViewerRendered: (rendered: boolean) => void;
  setViewerScrollTop: (scrollTop: number) => void;
  setLiveActive: (active: boolean) => void;

  navigateToDir: (dirPath: string) => void;
  handleCwdResult: (cwd: string, home: string) => void;
  handleDirectoryListing: (path: string, entries?: FileEntry[], error?: string) => void;
  toggleExpand: (dirPath: string) => void;

  showTextViewer: (name: string, filePath: string, content: string, isError: boolean) => void;
  showImageViewer: (name: string, filePath: string) => void;
  showPdfViewer: (name: string, filePath: string) => void;
  closeViewer: () => void;
  handleFileUpdate: (path: string, content?: string, error?: string) => void;

  requestInitialData: () => void;
  reestablishFileWatch: () => void;
  saveSessionState: (sessionId: string) => void;
  restoreSessionState: (sessionId: string) => boolean;
  clearSessionState: (sessionId: string) => void;
}

const MAX_PERSISTED_CONTENT = 500 * 1024; // 500KB

export const useFileBrowserStore = create<FileBrowserState>()(
  persist(
    (set, get) => ({
      visible: false,
      showHidden: false,
      linked: true,
      currentRoot: '',
      home: '',
      expandedDirs: new Set(),
      dirCache: new Map(),
      previousRoot: '',

      viewerVisible: false,
      viewerMode: 'none',
      viewerFileName: '',
      viewerFilePath: '',
      viewerContent: '',
      viewerIsError: false,
      viewerRendered: false,
      viewerRawContent: '',
      viewerScrollTop: 0,
      watchedFile: null,
      liveActive: false,
      viewerWidth: 400,

      sessionStates: new Map(),

      setVisible: (visible) => set({ visible }),
      toggle: () => set((s) => ({ visible: !s.visible })),
      setShowHidden: (showHidden) => set({ showHidden }),
      setLinked: (linked) => set({ linked }),
      setHome: (home) => set({ home }),
      setViewerWidth: (viewerWidth) => set({ viewerWidth }),
      setViewerRendered: (viewerRendered) => set({ viewerRendered }),
      setViewerScrollTop: (viewerScrollTop) => set({ viewerScrollTop }),
      setLiveActive: (liveActive) => set({ liveActive }),

      navigateToDir: (dirPath) => {
        set({
          previousRoot: get().currentRoot,
          currentRoot: dirPath,
          expandedDirs: new Set([dirPath]),
          dirCache: new Map(),
        });
      },

      handleCwdResult: (cwd, home) => {
        const state = get();
        if (cwd === state.currentRoot && state.dirCache.size > 0) return;
        if (!state.home && home) set({ home });
        set({
          currentRoot: cwd,
          expandedDirs: new Set([cwd]),
          dirCache: new Map(),
        });
      },

      handleDirectoryListing: (path, entries, error) => {
        if (error) {
          const state = get();
          if (path === state.currentRoot && state.previousRoot && state.previousRoot !== state.currentRoot) {
            set({ currentRoot: state.previousRoot });
          } else if (path === state.currentRoot && !state.previousRoot) {
            // Persisted currentRoot no longer exists and no previousRoot — fall back to get-cwd
            const sessionId = useSessionStore.getState().activeSessionId;
            if (sessionId) {
              set({ currentRoot: '', expandedDirs: new Set(), dirCache: new Map() });
              useConnectionStore.getState().sendMessage('get-cwd', { sessionId });
            }
          }
          return;
        }
        if (entries) {
          const dirCache = new Map(get().dirCache);
          dirCache.set(path, entries);
          set({ dirCache });
        }
      },

      toggleExpand: (dirPath) => {
        const expanded = new Set(get().expandedDirs);
        if (expanded.has(dirPath)) {
          expanded.delete(dirPath);
        } else {
          expanded.add(dirPath);
        }
        set({ expandedDirs: expanded });
      },

      showTextViewer: (name, filePath, content, isError) => {
        set({
          viewerVisible: true,
          viewerMode: 'text',
          viewerFileName: name,
          viewerFilePath: filePath,
          viewerContent: content,
          viewerRawContent: isError ? '' : content,
          viewerIsError: isError,
          viewerRendered: false,
          viewerScrollTop: 0,
          watchedFile: isError ? null : filePath,
        });
      },

      showImageViewer: (name, filePath) => {
        set({
          viewerVisible: true,
          viewerMode: 'image',
          viewerFileName: name,
          viewerFilePath: filePath,
          viewerContent: '',
          viewerRawContent: '',
          viewerIsError: false,
          viewerRendered: false,
          watchedFile: filePath,
          liveActive: false,
        });
      },

      showPdfViewer: (name, filePath) => {
        set({
          viewerVisible: true,
          viewerMode: 'pdf',
          viewerFileName: name,
          viewerFilePath: filePath,
          viewerContent: '',
          viewerRawContent: '',
          viewerIsError: false,
          viewerRendered: false,
          watchedFile: filePath,
          liveActive: false,
        });
      },

      closeViewer: () => {
        set({
          viewerVisible: false,
          viewerMode: 'none',
          viewerFileName: '',
          viewerFilePath: '',
          viewerContent: '',
          viewerRawContent: '',
          viewerIsError: false,
          viewerRendered: false,
          viewerScrollTop: 0,
          watchedFile: null,
          liveActive: false,
        });
      },

      handleFileUpdate: (path, content, error) => {
        const state = get();
        if (!state.watchedFile || path !== state.watchedFile) return;
        if (state.viewerMode !== 'text') return;
        if (error) {
          set({ viewerContent: error, viewerIsError: true, liveActive: false });
          return;
        }
        if (content !== undefined) {
          set({
            viewerContent: content,
            viewerRawContent: content,
            viewerIsError: false,
            liveActive: true,
          });
        }
      },

      requestInitialData: () => {
        const { currentRoot, dirCache, expandedDirs, showHidden } = get();
        // Case 1: already populated — skip
        if (currentRoot && dirCache.size > 0) return;

        const sessionId = useSessionStore.getState().activeSessionId;
        if (!sessionId) return;
        const send = useConnectionStore.getState().sendMessage;

        // Case 2: rehydrated — currentRoot set but dirCache empty
        if (currentRoot) {
          for (const dir of expandedDirs) {
            send('list-directory', { sessionId, path: dir, showHidden });
          }
          return;
        }

        // Case 3: fresh start — no currentRoot
        send('get-cwd', { sessionId });
      },

      reestablishFileWatch: () => {
        const { viewerVisible, viewerFilePath, watchedFile } = get();
        if (!viewerVisible || !viewerFilePath) return;

        const sessionId = useSessionStore.getState().activeSessionId;
        if (!sessionId) return;

        const fileToWatch = watchedFile || viewerFilePath;
        useConnectionStore.getState().sendMessage('watch-file', {
          path: fileToWatch,
        });
      },

      saveSessionState: (sessionId) => {
        if (!sessionId) return;
        const state = get();
        const sessionStates = new Map(state.sessionStates);
        sessionStates.set(sessionId, {
          currentRoot: state.currentRoot,
          expandedDirs: new Set(state.expandedDirs),
          dirCache: new Map(state.dirCache),
          scrollTop: 0,
        });
        set({ sessionStates });
      },

      restoreSessionState: (sessionId) => {
        const saved = get().sessionStates.get(sessionId);
        if (!saved) return false;
        set({
          currentRoot: saved.currentRoot,
          expandedDirs: new Set(saved.expandedDirs),
          dirCache: new Map(saved.dirCache),
        });
        return true;
      },

      clearSessionState: (sessionId) => {
        const sessionStates = new Map(get().sessionStates);
        sessionStates.delete(sessionId);
        set({ sessionStates });
      },
    }),
    {
      name: 'synesthesia-file-browser',
      partialize: (state) => ({
        visible: state.visible,
        showHidden: state.showHidden,
        linked: state.linked,
        currentRoot: state.currentRoot,
        home: state.home,
        expandedDirs: [...state.expandedDirs],
        viewerVisible: state.viewerVisible,
        viewerMode: state.viewerMode,
        viewerFileName: state.viewerFileName,
        viewerFilePath: state.viewerFilePath,
        viewerRendered: state.viewerRendered,
        viewerWidth: state.viewerWidth,
        viewerContent: state.viewerContent.length <= MAX_PERSISTED_CONTENT ? state.viewerContent : '',
        viewerRawContent: state.viewerRawContent.length <= MAX_PERSISTED_CONTENT ? state.viewerRawContent : '',
      }),
      merge: (persisted, current) => {
        const p = persisted as Record<string, unknown> | undefined;
        if (!p) return current;
        return {
          ...current,
          ...p,
          // Restore Set from Array
          expandedDirs: new Set(Array.isArray(p.expandedDirs) ? p.expandedDirs as string[] : []),
          // Always fresh Maps
          dirCache: new Map(),
          sessionStates: new Map(),
          // Never persist these
          watchedFile: null,
          liveActive: false,
          viewerIsError: false,
          previousRoot: '',
        };
      },
      onRehydrate: () => {
        return (_state) => {
          // Migrate legacy localStorage keys
          try {
            const legacyLinked = localStorage.getItem('synesthesia-fb-linked');
            if (legacyLinked !== null) {
              const store = useFileBrowserStore.getState();
              // Only migrate if the persist store hasn't been written yet
              if (legacyLinked === 'false' && store.linked) {
                useFileBrowserStore.setState({ linked: false });
              }
              localStorage.removeItem('synesthesia-fb-linked');
            }
            const legacyWidth = localStorage.getItem('synesthesia-fv-width');
            if (legacyWidth !== null) {
              const width = parseInt(legacyWidth, 10);
              if (!isNaN(width)) {
                useFileBrowserStore.setState({ viewerWidth: width });
              }
              localStorage.removeItem('synesthesia-fv-width');
            }
          } catch {
            // localStorage may be unavailable
          }
        };
      },
    },
  ),
);
