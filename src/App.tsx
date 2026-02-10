import { useState, useEffect } from 'react';
import './styles/index.css';
import Header from '@/components/Header/Header';
import XTermRenderer from '@/components/Terminal/XTermRenderer';
import CorrectionPanel from '@/components/Terminal/CorrectionPanel';
import PromptDialog from '@/components/Modals/PromptDialog';
import SettingsModal from '@/components/Modals/SettingsModal';
import FileSidebar from '@/components/FileBrowser/FileSidebar';
import MusicPanel from '@/components/Header/MusicPanel';
import TodoModal from '@/components/Modals/TodoModal';
import NotesModal from '@/components/Modals/NotesModal';
import RecordingsModal from '@/components/Modals/RecordingsModal';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useUIStore } from '@/stores/uiStore';
import { usePlayerStore } from '@/stores/playerStore';

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const panelOpen = usePlayerStore((s) => s.panelOpen);
  const imageModalSrc = useUIStore((s) => s.imageModalSrc);
  const imageModalInfo = useUIStore((s) => s.imageModalInfo);
  const hideImageModal = useUIStore((s) => s.hideImageModal);

  useKeyboardShortcuts();
  useEffect(() => { usePlayerStore.getState().initEngine(); }, []);

  return (
    <div id="app">
      <Header onOpenSettings={() => setSettingsOpen(true)} />
      <div className="main-content">
        <div className="terminal-container">
          <XTermRenderer />
          <CorrectionPanel />
        </div>
        {panelOpen && <MusicPanel />}
        <FileSidebar />
      </div>
      <PromptDialog />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <TodoModal />
      <NotesModal />
      <RecordingsModal />

      {/* Image modal */}
      {imageModalSrc && (
        <div className="image-modal visible" onClick={hideImageModal}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <img src={imageModalSrc} alt="Cached image" />
            {imageModalInfo && <div className="image-modal-info">{imageModalInfo}</div>}
            <button className="image-modal-close" onClick={hideImageModal}>×</button>
          </div>
        </div>
      )}
    </div>
  );
}
