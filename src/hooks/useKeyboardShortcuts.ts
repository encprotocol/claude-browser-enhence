import { useEffect } from 'react';
import { useConnectionStore } from '@/stores/connectionStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useCorrectionStore } from '@/stores/correctionStore';
import { useTodoStore } from '@/stores/todoStore';
import { useNotesStore } from '@/stores/notesStore';
import { useFileBrowserStore } from '@/stores/fileBrowserStore';
import { useUIStore } from '@/stores/uiStore';

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+B: Toggle file browser
      if (e.metaKey && e.key === 'b') {
        e.preventDefault();
        useFileBrowserStore.getState().toggle();
        return;
      }
      // Cmd+X: Toggle correction mode
      if (e.metaKey && e.key === 'x') {
        e.preventDefault();
        const corrState = useCorrectionStore.getState();
        if (corrState.enabled && !corrState.panelVisible) {
          corrState.setPanelVisible(true);
        } else if (corrState.enabled) {
          corrState.setEnabled(false);
          corrState.setPanelVisible(false);
        } else {
          useConnectionStore.getState().sendMessage('check-claude-running');
        }
        return;
      }
      // Cmd+J: Toggle todos
      if (e.metaKey && e.key === 'j') {
        e.preventDefault();
        useTodoStore.getState().toggle();
        return;
      }
      // Cmd+K: Toggle notes
      if (e.metaKey && e.key === 'k') {
        e.preventDefault();
        useNotesStore.getState().toggle();
        return;
      }
      // Ctrl+Shift+T: New tab
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        const sessions = useSessionStore.getState().sessions;
        const defaultName = `Shell ${sessions.size + 1}`;
        useUIStore.getState().showPrompt('New tab name:', defaultName).then((name) => {
          if (name === null) return;
          useConnectionStore.getState().sendMessage('create-session', {
            name: (name as string).trim() || defaultName,
          });
        });
      }
      // Ctrl+Shift+W: Close tab
      if (e.ctrlKey && e.shiftKey && e.key === 'W') {
        e.preventDefault();
        const activeId = useSessionStore.getState().activeSessionId;
        if (!activeId) return;
        const session = useSessionStore.getState().sessions.get(activeId);
        const name = session ? session.name : 'this tab';
        useUIStore.getState().showConfirm(`Close "${name}"?`).then((ok) => {
          if (ok) useConnectionStore.getState().sendMessage('close-session', { sessionId: activeId });
        });
      }
      // Ctrl+Tab: Next tab, Ctrl+Shift+Tab: Previous tab
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        const { sessions, activeSessionId } = useSessionStore.getState();
        const ids = Array.from(sessions.keys());
        const idx = ids.indexOf(activeSessionId || '');
        const nextIdx = e.shiftKey
          ? (idx - 1 + ids.length) % ids.length
          : (idx + 1) % ids.length;
        useConnectionStore.getState().sendMessage('switch-session', { sessionId: ids[nextIdx] });
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
}
