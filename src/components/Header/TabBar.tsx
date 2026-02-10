import { useSessionStore } from '@/stores/sessionStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useUIStore } from '@/stores/uiStore';
import { useThemeStore } from '@/stores/themeStore';

export default function TabBar() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const sendMessage = useConnectionStore((s) => s.sendMessage);
  const showPrompt = useUIStore((s) => s.showPrompt);
  const showConfirm = useUIStore((s) => s.showConfirm);
  const theme = useThemeStore((s) => s.theme);

  const switchSession = (id: string) => {
    if (id === activeSessionId) return;
    sendMessage('switch-session', { sessionId: id });
  };

  const createNewSession = async () => {
    const defaultName = `Shell ${sessions.size + 1}`;
    const name = await showPrompt('New tab name:', defaultName);
    if (name === null) return;
    sendMessage('create-session', { name: (name as string).trim() || defaultName });
  };

  const closeSession = async (id: string, name: string) => {
    const ok = await showConfirm(`Close "${name}"?`);
    if (ok) sendMessage('close-session', { sessionId: id });
  };

  const renameSession = async (id: string, currentName: string) => {
    const newName = await showPrompt('Rename tab:', currentName);
    if (newName !== null && (newName as string).trim()) {
      sendMessage('rename-session', { sessionId: id, name: (newName as string).trim() });
    }
  };

  return (
    <div className="tab-bar">
      {Array.from(sessions.values()).map((session) => {
        const isActive = session.id === activeSessionId;
        return (
          <button
            key={session.id}
            className={`tab${isActive ? ' active' : ''}`}
            style={isActive ? { background: theme.activeTab || theme.background } : undefined}
            onClick={() => switchSession(session.id)}
          >
            <span
              className="tab-name"
              onDoubleClick={(e) => {
                e.stopPropagation();
                renameSession(session.id, session.name);
              }}
            >
              {session.name}
            </span>
            <span
              role="button"
              className="close-btn"
              onClick={(e) => {
                e.stopPropagation();
                closeSession(session.id, session.name);
              }}
            >
              &times;
            </span>
          </button>
        );
      })}
      <button className="new-tab-btn" title="New session (Ctrl+Shift+T)" onClick={createNewSession}>
        +
      </button>
    </div>
  );
}
