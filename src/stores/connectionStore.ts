import { create } from 'zustand';
import type { ClientMessage } from '@/types';
import { routeMessage } from '@/stores/messageRouter';

interface ConnectionState {
  ws: WebSocket | null;
  connected: boolean;
  clientId: string;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (type: string, data?: Record<string, unknown>) => void;
}

function getClientId(): string {
  let id = localStorage.getItem('synesthesia-client-id');
  if (!id) {
    id = 'client-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    localStorage.setItem('synesthesia-client-id', id);
  }
  return id;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  ws: null,
  connected: false,
  clientId: getClientId(),

  connect: () => {
    const { clientId } = get();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // In dev (Vite on :5173), connect WS directly to the Express server on :3000
    const host = import.meta.env.DEV && window.location.port === '5173'
      ? window.location.hostname + ':3000'
      : window.location.host;
    const ws = new WebSocket(`${protocol}//${host}?clientId=${encodeURIComponent(clientId)}`);

    ws.onopen = () => {
      set({ connected: true });
      // Pre-fetch Claude availability status
      get().sendMessage('check-claude-running');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        routeMessage(msg);
      } catch (e) {
        console.error('Parse error:', e);
      }
    };

    ws.onclose = () => {
      set({ connected: false, ws: null });
      // Reconnect after 3s
      setTimeout(() => get().connect(), 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    set({ ws });
  },

  disconnect: () => {
    const { ws } = get();
    if (ws) ws.close();
    set({ ws: null, connected: false });
  },

  sendMessage: (type: string, data: Record<string, unknown> = {}) => {
    const { ws } = get();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, ...data }));
    }
  },
}));
