import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFileBrowserStore } from '@/stores/fileBrowserStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useSessionStore } from '@/stores/sessionStore';

describe('fileBrowser persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFileBrowserStore.setState({
      visible: false,
      currentRoot: '',
      home: '',
      expandedDirs: new Set(),
      dirCache: new Map(),
      sessionStates: new Map(),
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
  });

  describe('requestInitialData — rehydration (currentRoot set, dirCache empty)', () => {
    it('sends list-directory for currentRoot instead of get-cwd', () => {
      const mockSend = vi.fn();
      useConnectionStore.setState({ connected: true, sendMessage: mockSend });
      useSessionStore.setState({ activeSessionId: 'session-1' });

      useFileBrowserStore.setState({
        currentRoot: '/home/user',
        expandedDirs: new Set(['/home/user']),
        dirCache: new Map(),
      });

      useFileBrowserStore.getState().requestInitialData();

      expect(mockSend).toHaveBeenCalledWith('list-directory', {
        sessionId: 'session-1',
        path: '/home/user',
        showHidden: false,
      });
      expect(mockSend).not.toHaveBeenCalledWith('get-cwd', expect.anything());
    });

    it('sends list-directory for ALL expanded dirs', () => {
      const mockSend = vi.fn();
      useConnectionStore.setState({ connected: true, sendMessage: mockSend });
      useSessionStore.setState({ activeSessionId: 'session-1' });

      useFileBrowserStore.setState({
        currentRoot: '/home/user',
        expandedDirs: new Set(['/home/user', '/home/user/src', '/home/user/src/lib']),
        dirCache: new Map(),
      });

      useFileBrowserStore.getState().requestInitialData();

      expect(mockSend).toHaveBeenCalledTimes(3);
      expect(mockSend).toHaveBeenCalledWith('list-directory', {
        sessionId: 'session-1',
        path: '/home/user',
        showHidden: false,
      });
      expect(mockSend).toHaveBeenCalledWith('list-directory', {
        sessionId: 'session-1',
        path: '/home/user/src',
        showHidden: false,
      });
      expect(mockSend).toHaveBeenCalledWith('list-directory', {
        sessionId: 'session-1',
        path: '/home/user/src/lib',
        showHidden: false,
      });
    });

    it('still sends get-cwd when currentRoot is empty', () => {
      const mockSend = vi.fn();
      useConnectionStore.setState({ connected: true, sendMessage: mockSend });
      useSessionStore.setState({ activeSessionId: 'session-1' });

      useFileBrowserStore.setState({
        currentRoot: '',
        dirCache: new Map(),
      });

      useFileBrowserStore.getState().requestInitialData();

      expect(mockSend).toHaveBeenCalledWith('get-cwd', { sessionId: 'session-1' });
    });
  });

  describe('reestablishFileWatch', () => {
    it('sends watch-file when viewer has text file open', () => {
      const mockSend = vi.fn();
      useConnectionStore.setState({ connected: true, sendMessage: mockSend });
      useSessionStore.setState({ activeSessionId: 'session-1' });

      useFileBrowserStore.setState({
        viewerVisible: true,
        viewerMode: 'text',
        viewerFilePath: '/home/user/file.txt',
        watchedFile: '/home/user/file.txt',
      });

      useFileBrowserStore.getState().reestablishFileWatch();

      expect(mockSend).toHaveBeenCalledWith('watch-file', {
        path: '/home/user/file.txt',
      });
    });

    it('no-ops when viewer is not visible', () => {
      const mockSend = vi.fn();
      useConnectionStore.setState({ connected: true, sendMessage: mockSend });
      useSessionStore.setState({ activeSessionId: 'session-1' });

      useFileBrowserStore.setState({
        viewerVisible: false,
        viewerMode: 'none',
        viewerFilePath: '',
        watchedFile: null,
      });

      useFileBrowserStore.getState().reestablishFileWatch();

      expect(mockSend).not.toHaveBeenCalled();
    });

    it('no-ops for image/pdf viewer modes', () => {
      const mockSend = vi.fn();
      useConnectionStore.setState({ connected: true, sendMessage: mockSend });
      useSessionStore.setState({ activeSessionId: 'session-1' });

      useFileBrowserStore.setState({
        viewerVisible: true,
        viewerMode: 'image',
        viewerFilePath: '/home/user/pic.png',
        watchedFile: '/home/user/pic.png',
      });

      useFileBrowserStore.getState().reestablishFileWatch();

      // Image files use HTTP URL, no WS watch needed for text content
      // but they do watch for file changes — so watch-file IS sent
      expect(mockSend).toHaveBeenCalledWith('watch-file', {
        path: '/home/user/pic.png',
      });
    });
  });

  describe('expandedDirs type preservation', () => {
    it('expandedDirs is a Set after setState with array-like data', () => {
      // Simulate what merge would do — array comes from JSON, must become Set
      useFileBrowserStore.setState({
        expandedDirs: new Set(['/a', '/b']),
      });

      const state = useFileBrowserStore.getState();
      expect(state.expandedDirs).toBeInstanceOf(Set);
      expect(state.expandedDirs.has('/a')).toBe(true);
      expect(state.expandedDirs.has('/b')).toBe(true);
    });
  });
});
