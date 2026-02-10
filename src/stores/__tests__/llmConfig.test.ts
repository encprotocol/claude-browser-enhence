/**
 * Tests for LLM config state management.
 *
 * - llmConfigured defaults to null
 * - llm-config-status sets llmConfigured and llmProvider (does NOT auto-enable panel)
 * - claude-running-status no longer auto-enables correction
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCorrectionStore } from '@/stores/correctionStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useSessionStore } from '@/stores/sessionStore';
import { routeMessage } from '@/stores/messageRouter';

// Mock terminal instance
vi.mock('@/terminal/terminalInstance', () => ({
  getTerminalInstance: () => ({
    write: vi.fn(),
    clear: vi.fn(),
    focus: vi.fn(),
    scrollToBottom: vi.fn(),
  }),
  setTerminalInstance: vi.fn(),
}));

beforeEach(() => {
  useCorrectionStore.setState({
    enabled: false,
    panelVisible: false,
    inputBuffer: '',
    pendingCorrection: null,
    waitingForCorrection: false,
    textValue: '',
    showingResult: false,
    diffHtml: '',
    claudeRunning: null,
    llmConfigured: null,
    llmProvider: null,
  });

  useSessionStore.setState({
    activeSessionId: 'session-1',
    sessions: new Map([['session-1', { id: 'session-1', name: 'Main' }]]),
  });

  useConnectionStore.setState({
    ws: { readyState: WebSocket.OPEN } as WebSocket,
    connected: true,
    sendMessage: vi.fn(),
  });
});

describe('LLM config state', () => {
  it('llmConfigured defaults to null', () => {
    expect(useCorrectionStore.getState().llmConfigured).toBeNull();
  });

  it('llmProvider defaults to null', () => {
    expect(useCorrectionStore.getState().llmProvider).toBeNull();
  });

  it('llm-config-status sets llmConfigured and llmProvider', () => {
    routeMessage({ type: 'llm-config-status', configured: true, activeProvider: 'gemini' });
    const state = useCorrectionStore.getState();
    expect(state.llmConfigured).toBe(true);
    expect(state.llmProvider).toBe('gemini');
  });

  it('llm-config-status does NOT auto-enable correction panel', () => {
    routeMessage({ type: 'llm-config-status', configured: true, activeProvider: 'gemini' });
    const state = useCorrectionStore.getState();
    expect(state.enabled).toBe(false);
    expect(state.panelVisible).toBe(false);
  });

  it('llm-config-status with configured=false sets llmConfigured to false', () => {
    routeMessage({ type: 'llm-config-status', configured: false, activeProvider: '' });
    const state = useCorrectionStore.getState();
    expect(state.llmConfigured).toBe(false);
    expect(state.llmProvider).toBe('');
  });

  it('claude-running-status only sets claudeRunning, does NOT auto-enable correction', () => {
    routeMessage({ type: 'claude-running-status', running: true });
    const state = useCorrectionStore.getState();
    expect(state.claudeRunning).toBe(true);
    // Should NOT auto-enable
    expect(state.enabled).toBe(false);
    expect(state.panelVisible).toBe(false);
  });

  it('claude-running-status false sets claudeRunning false', () => {
    routeMessage({ type: 'claude-running-status', running: false });
    expect(useCorrectionStore.getState().claudeRunning).toBe(false);
  });
});
