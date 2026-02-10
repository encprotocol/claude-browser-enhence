import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock stores
vi.mock('@/stores/correctionStore', () => ({
  useCorrectionStore: vi.fn((sel: any) => {
    const state = {
      enabled: false,
      panelVisible: false,
      llmConfigured: null,
      setEnabled: vi.fn(),
      setPanelVisible: vi.fn(),
    };
    return sel ? sel(state) : state;
  }),
}));
vi.mock('@/stores/todoStore', () => ({
  useTodoStore: vi.fn((sel: any) => {
    const state = { toggle: vi.fn() };
    return sel ? sel(state) : state;
  }),
}));
vi.mock('@/stores/notesStore', () => ({
  useNotesStore: vi.fn((sel: any) => {
    const state = { toggle: vi.fn() };
    return sel ? sel(state) : state;
  }),
}));
vi.mock('@/stores/fileBrowserStore', () => {
  const store: any = vi.fn((sel: any) => {
    const state = { visible: false, toggle: vi.fn(), setVisible: vi.fn() };
    return sel ? sel(state) : state;
  });
  store.getState = () => ({ visible: false, setVisible: vi.fn() });
  return { useFileBrowserStore: store };
});
vi.mock('@/stores/recordingStore', () => ({
  useRecordingStore: vi.fn((sel: any) => {
    const state = { toggle: vi.fn() };
    return sel ? sel(state) : state;
  }),
}));
vi.mock('@/stores/playerStore', () => {
  const store: any = vi.fn((sel: any) => {
    const state = {
      playing: false,
      panelOpen: false,
      tracks: [],
      currentTrackId: null,
      togglePanel: vi.fn(),
      setPanelOpen: vi.fn(),
    };
    return sel ? sel(state) : state;
  });
  store.getState = () => ({
    panelOpen: false,
    setPanelOpen: vi.fn(),
  });
  return { usePlayerStore: store };
});
vi.mock('@/stores/uiStore', () => ({
  useUIStore: vi.fn((sel: any) => {
    const state = {};
    return sel ? sel(state) : state;
  }),
}));

describe('FunctionMenu', () => {
  let FunctionMenu: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/components/Header/FunctionMenu');
    FunctionMenu = mod.default;
  });

  it('renders menu button', () => {
    render(<FunctionMenu onOpenSettings={vi.fn()} />);
    expect(screen.getByRole('button', { name: /menu/i })).toBeDefined();
  });

  it('click opens dropdown with all 7 items', () => {
    render(<FunctionMenu onOpenSettings={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /menu/i });
    fireEvent.click(btn);

    expect(screen.getByText('English Correction')).toBeDefined();
    expect(screen.getByText('Todos')).toBeDefined();
    expect(screen.getByText('Notes')).toBeDefined();
    expect(screen.getByText('Recordings')).toBeDefined();
    expect(screen.getByText('File Browser')).toBeDefined();
    expect(screen.getByText('Music')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();
  });

  it('shows shortcut badges next to items', () => {
    render(<FunctionMenu onOpenSettings={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));

    expect(screen.getByText('⌘X')).toBeDefined();
    expect(screen.getByText('⌘J')).toBeDefined();
    expect(screen.getByText('⌘K')).toBeDefined();
    expect(screen.getByText('⌘H')).toBeDefined();
    expect(screen.getByText('⌘B')).toBeDefined();
    expect(screen.getByText('⌘M')).toBeDefined();
  });

  it('click on item calls handler and closes menu', () => {
    const onOpenSettings = vi.fn();
    render(<FunctionMenu onOpenSettings={onOpenSettings} />);
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    fireEvent.click(screen.getByText('Settings'));

    expect(onOpenSettings).toHaveBeenCalledOnce();
    // Menu should close — dropdown should not be in DOM
    expect(screen.queryByText('English Correction')).toBeNull();
  });

  it('Escape closes menu', () => {
    render(<FunctionMenu onOpenSettings={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.getByText('English Correction')).toBeDefined();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('English Correction')).toBeNull();
  });

  it('shows active indicator for enabled correction', async () => {
    // Re-mock correctionStore to return enabled = true
    const { useCorrectionStore } = await import('@/stores/correctionStore');
    (useCorrectionStore as any).mockImplementation((sel: any) => {
      const state = {
        enabled: true,
        panelVisible: true,
        llmConfigured: true,
        setEnabled: vi.fn(),
        setPanelVisible: vi.fn(),
      };
      return sel ? sel(state) : state;
    });

    const { container } = render(<FunctionMenu onOpenSettings={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /menu/i }));

    const correctionItem = container.querySelector('.function-menu-item.active');
    expect(correctionItem).not.toBeNull();
  });
});
