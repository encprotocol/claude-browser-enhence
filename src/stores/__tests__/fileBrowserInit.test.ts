import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFileBrowserStore } from '@/stores/fileBrowserStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useSessionStore } from '@/stores/sessionStore';

describe('fileBrowser initial data request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fileBrowserStore
    useFileBrowserStore.setState({
      visible: false,
      currentRoot: '',
      dirCache: new Map(),
      expandedDirs: new Set(),
      home: '',
    });
  });

  it('requestInitialData sends get-cwd when currentRoot is empty', () => {
    const mockSend = vi.fn();
    useConnectionStore.setState({ connected: true, sendMessage: mockSend });
    useSessionStore.setState({ activeSessionId: 'session-1' });

    useFileBrowserStore.getState().requestInitialData();

    expect(mockSend).toHaveBeenCalledWith('get-cwd', { sessionId: 'session-1' });
  });

  it('requestInitialData does nothing when currentRoot has data', () => {
    const mockSend = vi.fn();
    useConnectionStore.setState({ connected: true, sendMessage: mockSend });
    useSessionStore.setState({ activeSessionId: 'session-1' });

    const cache = new Map();
    cache.set('/home/user', [{ name: 'file.txt', type: 'file', path: '/home/user/file.txt' }]);
    useFileBrowserStore.setState({
      currentRoot: '/home/user',
      dirCache: cache,
    });

    useFileBrowserStore.getState().requestInitialData();

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('requestInitialData does nothing without active session', () => {
    const mockSend = vi.fn();
    useConnectionStore.setState({ connected: true, sendMessage: mockSend });
    useSessionStore.setState({ activeSessionId: null });

    useFileBrowserStore.getState().requestInitialData();

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('requestInitialData sends list-directory when rehydrated (currentRoot set, dirCache empty)', () => {
    const mockSend = vi.fn();
    useConnectionStore.setState({ connected: true, sendMessage: mockSend });
    useSessionStore.setState({ activeSessionId: 'session-1' });

    useFileBrowserStore.setState({
      currentRoot: '/home/user/project',
      expandedDirs: new Set(['/home/user/project', '/home/user/project/src']),
      dirCache: new Map(),
      showHidden: true,
    });

    useFileBrowserStore.getState().requestInitialData();

    expect(mockSend).toHaveBeenCalledWith('list-directory', {
      sessionId: 'session-1',
      path: '/home/user/project',
      showHidden: true,
    });
    expect(mockSend).toHaveBeenCalledWith('list-directory', {
      sessionId: 'session-1',
      path: '/home/user/project/src',
      showHidden: true,
    });
    expect(mockSend).not.toHaveBeenCalledWith('get-cwd', expect.anything());
  });
});
