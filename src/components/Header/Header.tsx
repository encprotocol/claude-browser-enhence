import TabBar from './TabBar';
import FunctionMenu from './FunctionMenu';
import { useConnectionStore } from '@/stores/connectionStore';

interface HeaderProps {
  onOpenSettings: () => void;
}

export default function Header({ onOpenSettings }: HeaderProps) {
  const connected = useConnectionStore((s) => s.connected);

  return (
    <header>
      <h1>Synesthesia</h1>
      <TabBar />
      <div className="header-right">
        <FunctionMenu onOpenSettings={onOpenSettings} />
        <div className="status">
          <div className={`status-dot${connected ? ' connected' : ''}`} />
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
    </header>
  );
}
