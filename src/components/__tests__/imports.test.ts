/**
 * Import smoke tests — verify every component module can be imported
 * without throwing. This catches missing imports, circular deps, and
 * module-level errors that unit tests on pure logic would miss.
 */
import { describe, it, expect } from 'vitest';

describe('Component imports', () => {
  it('imports App', async () => {
    const mod = await import('@/App');
    expect(mod.default).toBeDefined();
  });

  it('imports Header', async () => {
    const mod = await import('@/components/Header/Header');
    expect(mod.default).toBeDefined();
  });

  it('imports TabBar', async () => {
    const mod = await import('@/components/Header/TabBar');
    expect(mod.default).toBeDefined();
  });

  it('imports XTermRenderer', async () => {
    const mod = await import('@/components/Terminal/XTermRenderer');
    expect(mod.default).toBeDefined();
  });

  it('imports CorrectionPanel', async () => {
    const mod = await import('@/components/Terminal/CorrectionPanel');
    expect(mod.default).toBeDefined();
  });

  it('imports PromptDialog', async () => {
    const mod = await import('@/components/Modals/PromptDialog');
    expect(mod.default).toBeDefined();
  });

  it('imports SettingsModal', async () => {
    const mod = await import('@/components/Modals/SettingsModal');
    expect(mod.default).toBeDefined();
  });

  it('imports TodoModal', async () => {
    const mod = await import('@/components/Modals/TodoModal');
    expect(mod.default).toBeDefined();
  });

  it('imports NotesModal', async () => {
    const mod = await import('@/components/Modals/NotesModal');
    expect(mod.default).toBeDefined();
  });

  it('imports FileSidebar', async () => {
    const mod = await import('@/components/FileBrowser/FileSidebar');
    expect(mod.default).toBeDefined();
  });

  it('imports FileBrowserPanel', async () => {
    const mod = await import('@/components/FileBrowser/FileBrowserPanel');
    expect(mod.default).toBeDefined();
  });

  it('imports FileViewerPanel', async () => {
    const mod = await import('@/components/FileBrowser/FileViewerPanel');
    expect(mod.default).toBeDefined();
  });

  it('imports PlayerButton', async () => {
    const mod = await import('@/components/Header/PlayerButton');
    expect(mod.default).toBeDefined();
  });

  it('imports MusicPanel', async () => {
    const mod = await import('@/components/Header/MusicPanel');
    expect(mod.default).toBeDefined();
  });
});

describe('Store imports', () => {
  it('imports connectionStore', async () => {
    const mod = await import('@/stores/connectionStore');
    expect(mod.useConnectionStore).toBeDefined();
  });

  it('imports sessionStore', async () => {
    const mod = await import('@/stores/sessionStore');
    expect(mod.useSessionStore).toBeDefined();
  });

  it('imports themeStore', async () => {
    const mod = await import('@/stores/themeStore');
    expect(mod.useThemeStore).toBeDefined();
  });

  it('imports correctionStore', async () => {
    const mod = await import('@/stores/correctionStore');
    expect(mod.useCorrectionStore).toBeDefined();
  });

  it('imports fileBrowserStore', async () => {
    const mod = await import('@/stores/fileBrowserStore');
    expect(mod.useFileBrowserStore).toBeDefined();
  });

  it('imports todoStore', async () => {
    const mod = await import('@/stores/todoStore');
    expect(mod.useTodoStore).toBeDefined();
  });

  it('imports notesStore', async () => {
    const mod = await import('@/stores/notesStore');
    expect(mod.useNotesStore).toBeDefined();
  });

  it('imports uiStore', async () => {
    const mod = await import('@/stores/uiStore');
    expect(mod.useUIStore).toBeDefined();
  });

  it('imports messageRouter', async () => {
    const mod = await import('@/stores/messageRouter');
    expect(mod.routeMessage).toBeDefined();
  });

  it('imports playerStore', async () => {
    const mod = await import('@/stores/playerStore');
    expect(mod.usePlayerStore).toBeDefined();
  });
});

describe('Terminal singleton', () => {
  it('imports and works', async () => {
    const mod = await import('@/terminal/terminalInstance');
    expect(mod.getTerminalInstance).toBeDefined();
    expect(mod.setTerminalInstance).toBeDefined();
    expect(mod.getTerminalInstance()).toBeNull();
  });
});

describe('Lib modules', () => {
  it('imports audioEngine', async () => {
    const mod = await import('@/lib/audioEngine');
    expect(mod.load).toBeDefined();
    expect(mod.play).toBeDefined();
    expect(mod.extractYouTubeId).toBeDefined();
  });
});

describe('Hooks', () => {
  it('imports useKeyboardShortcuts', async () => {
    const mod = await import('@/hooks/useKeyboardShortcuts');
    expect(mod.useKeyboardShortcuts).toBeDefined();
  });
});
