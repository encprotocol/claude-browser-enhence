import { create } from 'zustand';
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

  saveSessionState: (sessionId: string) => void;
  restoreSessionState: (sessionId: string) => boolean;
  clearSessionState: (sessionId: string) => void;
}

export const useFileBrowserStore = create<FileBrowserState>((set, get) => ({
  visible: false,
  showHidden: false,
  linked: localStorage.getItem('synesthesia-fb-linked') !== 'false',
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
  watchedFile: null,
  liveActive: false,
  viewerWidth: parseInt(localStorage.getItem('synesthesia-fv-width') || '400', 10),

  sessionStates: new Map(),

  setVisible: (visible) => set({ visible }),
  toggle: () => set((s) => ({ visible: !s.visible })),
  setShowHidden: (showHidden) => set({ showHidden }),
  setLinked: (linked) => {
    localStorage.setItem('synesthesia-fb-linked', String(linked));
    set({ linked });
  },
  setHome: (home) => set({ home }),
  setViewerWidth: (viewerWidth) => {
    set({ viewerWidth });
    localStorage.setItem('synesthesia-fv-width', String(viewerWidth));
  },
  setViewerRendered: (viewerRendered) => set({ viewerRendered }),
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
    const isMarkdown = /\.(md|markdown)$/i.test(name);
    set({
      viewerVisible: true,
      viewerMode: 'text',
      viewerFileName: name,
      viewerFilePath: filePath,
      viewerContent: content,
      viewerRawContent: isError ? '' : content,
      viewerIsError: isError,
      viewerRendered: false,
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
}));
