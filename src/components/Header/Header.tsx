import TabBar from './TabBar';
import PlayerButton from './PlayerButton';
import { useConnectionStore } from '@/stores/connectionStore';
import { useCorrectionStore } from '@/stores/correctionStore';
import { useTodoStore } from '@/stores/todoStore';
import { useNotesStore } from '@/stores/notesStore';
import { useFileBrowserStore } from '@/stores/fileBrowserStore';
import { useRecordingStore } from '@/stores/recordingStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useUIStore } from '@/stores/uiStore';

interface HeaderProps {
  onOpenSettings: () => void;
}

export default function Header({ onOpenSettings }: HeaderProps) {
  const connected = useConnectionStore((s) => s.connected);
  const sendMessage = useConnectionStore((s) => s.sendMessage);
  const correctionEnabled = useCorrectionStore((s) => s.enabled);
  const setCorrectionEnabled = useCorrectionStore((s) => s.setEnabled);
  const setCorrectionPanelVisible = useCorrectionStore((s) => s.setPanelVisible);
  const correctionPanelVisible = useCorrectionStore((s) => s.panelVisible);
  const toggleTodos = useTodoStore((s) => s.toggle);
  const toggleNotes = useNotesStore((s) => s.toggle);
  const toggleRecordings = useRecordingStore((s) => s.toggle);
  const toggleFileBrowser = useFileBrowserStore((s) => s.toggle);

  const handleFileBrowserToggle = () => {
    usePlayerStore.getState().setPanelOpen(false);
    toggleFileBrowser();
  };

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

  return (
    <header>
      <h1>Synesthesia</h1>
      <TabBar />
      <div className="header-right">
        <button
          className={`correction-toggle${correctionEnabled ? ' active' : ''}`}
          title="Toggle English Correction (Cmd+X)"
          onClick={handleCorrectionToggle}
        >
          <span className="toggle-icon">Aa</span>
          <span className="toggle-label">Correction</span>
        </button>
        <button className="settings-btn" title="Todos (⌘J)" onClick={toggleTodos}>☑</button>
        <button className="settings-btn" title="Notes (⌘K)" onClick={toggleNotes}>📝</button>
        <button className="settings-btn" title="Recordings (⌘H)" onClick={toggleRecordings}>⏺</button>
        <button className="settings-btn" title="File Browser (Cmd+B)" onClick={handleFileBrowserToggle}>📁</button>
        <PlayerButton />
        <button className="settings-btn" title="Theme Settings" onClick={onOpenSettings}>⚙</button>
        <div className="status">
          <div className={`status-dot${connected ? ' connected' : ''}`} />
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
    </header>
  );
}
