import { useState, useEffect, useCallback } from 'react';
import TabBar from './TabBar';
import FunctionMenu from './FunctionMenu';
import { useConnectionStore } from '@/stores/connectionStore';

interface HeaderProps {
  onOpenSettings: () => void;
}

export default function Header({ onOpenSettings }: HeaderProps) {
  const connected = useConnectionStore((s) => s.connected);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }, []);

  return (
    <header>
      <h1>Synesthesia</h1>
      <TabBar />
      <div className="header-right">
        <FunctionMenu onOpenSettings={onOpenSettings} />
        <button
          className="settings-btn"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          ⛶
        </button>
        <div className="status">
          <div className={`status-dot${connected ? ' connected' : ''}`} />
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
    </header>
  );
}
