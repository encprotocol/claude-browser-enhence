import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/stores/connectionStore', () => ({
  useConnectionStore: {
    getState: () => ({
      sendMessage: vi.fn(),
    }),
  },
}));

vi.mock('@/stores/sessionStore', () => ({
  useSessionStore: {
    getState: () => ({
      activeSessionId: 'session-1',
    }),
  },
}));

import { useFileBrowserStore } from '@/stores/fileBrowserStore';

beforeEach(() => {
  useFileBrowserStore.setState({
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
    sessionStates: new Map(),
  });
});

describe('fileViewer scroll position', () => {
  it('setViewerScrollTop updates stored scroll ratio', () => {
    useFileBrowserStore.getState().setViewerScrollTop(0.5);
    expect(useFileBrowserStore.getState().viewerScrollTop).toBe(0.5);
  });

  it('showTextViewer resets scroll to 0 for a new file', () => {
    useFileBrowserStore.getState().setViewerScrollTop(0.75);
    useFileBrowserStore.getState().showTextViewer('b.ts', '/b.ts', 'content B', false);
    expect(useFileBrowserStore.getState().viewerScrollTop).toBe(0);
  });

  it('handleFileUpdate preserves scroll ratio', () => {
    useFileBrowserStore.getState().showTextViewer('a.ts', '/a.ts', 'v1', false);
    useFileBrowserStore.getState().setViewerScrollTop(0.6);
    useFileBrowserStore.getState().handleFileUpdate('/a.ts', 'v2');
    expect(useFileBrowserStore.getState().viewerScrollTop).toBe(0.6);
  });

  it('closeViewer resets scroll to 0', () => {
    useFileBrowserStore.getState().setViewerScrollTop(0.3);
    useFileBrowserStore.getState().closeViewer();
    expect(useFileBrowserStore.getState().viewerScrollTop).toBe(0);
  });
});
