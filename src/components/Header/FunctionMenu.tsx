import { useState, useRef, useEffect } from 'react';
import { useConnectionStore } from '@/stores/connectionStore';
import { useCorrectionStore } from '@/stores/correctionStore';
import { useTodoStore } from '@/stores/todoStore';
import { useNotesStore } from '@/stores/notesStore';
import { useFileBrowserStore } from '@/stores/fileBrowserStore';
import { useRecordingStore } from '@/stores/recordingStore';
import { usePlayerStore } from '@/stores/playerStore';

interface FunctionMenuProps {
  onOpenSettings: () => void;
}

interface MenuItem {
  icon: string;
  label: string;
  shortcut?: string;
  action: () => void;
  active?: boolean;
  statusColor?: string;
  dividerAfter?: boolean;
}

export default function FunctionMenu({ onOpenSettings }: FunctionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const sendMessage = useConnectionStore((s) => s.sendMessage);
  const correctionEnabled = useCorrectionStore((s) => s.enabled);
  const setCorrectionEnabled = useCorrectionStore((s) => s.setEnabled);
  const setCorrectionPanelVisible = useCorrectionStore((s) => s.setPanelVisible);
  const correctionPanelVisible = useCorrectionStore((s) => s.panelVisible);
  const claudeRunning = useCorrectionStore((s) => s.claudeRunning);
  const toggleTodos = useTodoStore((s) => s.toggle);
  const toggleNotes = useNotesStore((s) => s.toggle);
  const toggleRecordings = useRecordingStore((s) => s.toggle);
  const toggleFileBrowser = useFileBrowserStore((s) => s.toggle);
  const fileBrowserVisible = useFileBrowserStore((s) => s.visible);
  const playing = usePlayerStore((s) => s.playing);
  const togglePanel = usePlayerStore((s) => s.togglePanel);

  const handleCorrectionToggle = () => {
    if (correctionEnabled && !correctionPanelVisible) {
      setCorrectionPanelVisible(true);
      return;
    }
    if (correctionEnabled) {
      setCorrectionEnabled(false);
      setCorrectionPanelVisible(false);
    } else {
      sendMessage('check-claude-running');
    }
  };

  const handleFileBrowserToggle = () => {
    usePlayerStore.getState().setPanelOpen(false);
    toggleFileBrowser();
  };

  const handleMusicToggle = () => {
    const willOpen = !usePlayerStore.getState().panelOpen;
    if (willOpen) {
      useFileBrowserStore.getState().setVisible(false);
    }
    togglePanel();
  };

  const items: MenuItem[] = [
    { icon: 'Aa', label: 'English Correction', shortcut: '⌘X', action: handleCorrectionToggle, active: correctionEnabled, statusColor: claudeRunning === true ? '#22c55e' : claudeRunning === false ? '#ef4444' : undefined },
    { icon: '☑', label: 'Todos', shortcut: '⌘J', action: toggleTodos },
    { icon: '📝', label: 'Notes', shortcut: '⌘K', action: toggleNotes },
    { icon: '⏺', label: 'Recordings', shortcut: '⌘H', action: toggleRecordings, dividerAfter: true },
    { icon: '📁', label: 'File Browser', shortcut: '⌘B', action: handleFileBrowserToggle, active: fileBrowserVisible },
    { icon: '♪', label: 'Music', shortcut: '⌘M', action: handleMusicToggle, active: playing, dividerAfter: true },
    { icon: '⚙', label: 'Settings', action: onOpenSettings },
  ];

  const handleItemClick = (item: MenuItem) => {
    item.action();
    setOpen(false);
  };

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  return (
    <div className="function-menu" ref={menuRef}>
      <button
        className="function-menu-btn settings-btn"
        aria-label="menu"
        onClick={() => setOpen((v) => !v)}
      >
        ☰
      </button>
      {open && (
        <div className="function-menu-dropdown">
          {items.map((item, i) => (
            <div key={item.label}>
              <button
                className={`function-menu-item${item.active ? ' active' : ''}`}
                onClick={() => handleItemClick(item)}
              >
                <span className="function-menu-icon">{item.icon}</span>
                <span className="function-menu-label">{item.label}</span>
                {item.active && <span className="active-dot" />}
                {!item.active && item.statusColor && <span className="status-dot" style={{ background: item.statusColor }} />}
                {item.shortcut && <span className="function-menu-shortcut">{item.shortcut}</span>}
              </button>
              {item.dividerAfter && i < items.length - 1 && <div className="function-menu-divider" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
