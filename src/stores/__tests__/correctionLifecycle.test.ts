/**
 * Tests for the correction panel lifecycle.
 *
 * Full lifecycle:
 *   1. User enables correction (Cmd+X) → panel shows textarea (input state)
 *   2. User types text, presses Enter → sends correct-english to server, shows "Checking..." (waiting state)
 *   3. Server responds with correction-result:
 *      a. If original === corrected → auto-sends to terminal, closes panel
 *      b. If different → shows diff (result state)
 *   4. In result state:
 *      - Enter → sends corrected text to terminal, closes panel, resets all state
 *      - Esc → sends original text to terminal, closes panel, resets all state
 *   5. In waiting state:
 *      - Esc → cancels, returns to input state with text restored
 *   6. In input state:
 *      - Esc → closes panel without sending anything
 *      - Cmd+Enter → sends text directly to terminal (no correction)
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

// Track what sendMessage was called with
let sentMessages: Array<{ type: string; [key: string]: unknown }> = [];

beforeEach(() => {
  sentMessages = [];

  // Reset stores
  useCorrectionStore.setState({
    enabled: false,
    panelVisible: false,
    inputBuffer: '',
    pendingCorrection: null,
    waitingForCorrection: false,
    textValue: '',
    showingResult: false,
    diffHtml: '',
  });

  useSessionStore.setState({
    activeSessionId: 'session-1',
    sessions: new Map([['session-1', { id: 'session-1', name: 'Main' }]]),
  });

  // Mock WS sendMessage
  useConnectionStore.setState({
    ws: { readyState: WebSocket.OPEN } as WebSocket,
    connected: true,
    sendMessage: (type: string, data: Record<string, unknown> = {}) => {
      sentMessages.push({ type, ...data });
    },
  });
});

/**
 * Simulates CorrectionPanel's sendToTerminal — this MUST match the component code.
 * If you change CorrectionPanel.sendToTerminal, update this too.
 */
function componentSendToTerminal(text: string) {
  const sessionId = useSessionStore.getState().activeSessionId;
  if (text.trim() && sessionId) {
    useConnectionStore.getState().sendMessage('input', { sessionId, data: text });
  }
  const store = useCorrectionStore.getState();
  store.setTextValue('');
  store.setInputBuffer('');
  store.setPendingCorrection(null);
  store.setShowingResult(false);
  store.setWaitingForCorrection(false);
  store.setDiffHtml('');
  store.setPanelVisible(false);
}

/**
 * Simulates CorrectionPanel's hideCorrectionPanel — MUST match the component code.
 */
function componentHideCorrectionPanel() {
  const store = useCorrectionStore.getState();
  store.setTextValue('');
  store.setInputBuffer('');
  store.setPendingCorrection(null);
  store.setShowingResult(false);
  store.setWaitingForCorrection(false);
  store.setDiffHtml('');
  store.setPanelVisible(false);
}

describe('Correction panel lifecycle', () => {
  // --- Enable / Disable ---

  it('enables correction when claude-running-status is true', () => {
    routeMessage({ type: 'claude-running-status', running: true });
    const state = useCorrectionStore.getState();
    expect(state.enabled).toBe(true);
    expect(state.panelVisible).toBe(true);
  });

  // --- Input state ---

  it('starts in input state (not showing result)', () => {
    useCorrectionStore.getState().setEnabled(true);
    useCorrectionStore.getState().setPanelVisible(true);
    const state = useCorrectionStore.getState();
    expect(state.showingResult).toBe(false);
    expect(state.panelVisible).toBe(true);
  });

  // --- Correction result: no changes ---

  it('auto-sends to terminal and closes when no correction needed', () => {
    const store = useCorrectionStore.getState();
    store.setEnabled(true);
    store.setPanelVisible(true);
    store.setInputBuffer('hello world');
    store.setWaitingForCorrection(true);
    store.setShowingResult(true);

    routeMessage({
      type: 'correction-result',
      sessionId: 'session-1',
      original: 'hello world',
      corrected: 'hello world',
    });

    const state = useCorrectionStore.getState();
    expect(state.panelVisible).toBe(false);
    expect(state.pendingCorrection).toBeNull();
    expect(state.waitingForCorrection).toBe(false);
    expect(sentMessages).toContainEqual(
      expect.objectContaining({ type: 'input', data: 'hello world' })
    );
  });

  // --- Correction result: has changes → shows diff ---

  it('shows diff when correction differs from original', () => {
    const store = useCorrectionStore.getState();
    store.setEnabled(true);
    store.setPanelVisible(true);
    store.setInputBuffer('can I use english correction');
    store.setWaitingForCorrection(true);
    store.setShowingResult(true);

    routeMessage({
      type: 'correction-result',
      sessionId: 'session-1',
      original: 'can I use english correction',
      corrected: 'can I use English correction',
    });

    const state = useCorrectionStore.getState();
    expect(state.showingResult).toBe(true);
    expect(state.waitingForCorrection).toBe(false);
    expect(state.pendingCorrection).toEqual({
      original: 'can I use english correction',
      corrected: 'can I use English correction',
    });
    expect(state.diffHtml).toContain('English');
  });

  // --- Result state: Enter accepts corrected ---

  it('Enter on result sends corrected text and fully resets state', () => {
    useCorrectionStore.setState({
      enabled: true,
      panelVisible: true,
      showingResult: true,
      waitingForCorrection: false,
      pendingCorrection: {
        original: 'can I use english correction',
        corrected: 'can I use English correction',
      },
      inputBuffer: 'can I use english correction',
      textValue: 'can I use english correction',
      diffHtml: '<div>diff</div>',
    });

    // Simulate Enter → accept corrected
    const pending = useCorrectionStore.getState().pendingCorrection!;
    componentSendToTerminal(pending.corrected);

    const after = useCorrectionStore.getState();
    expect(after.panelVisible).toBe(false);
    expect(after.showingResult).toBe(false);
    expect(after.waitingForCorrection).toBe(false);
    expect(after.pendingCorrection).toBeNull();
    expect(after.textValue).toBe('');
    expect(after.inputBuffer).toBe('');
    expect(after.diffHtml).toBe('');

    expect(sentMessages).toContainEqual(
      expect.objectContaining({ type: 'input', data: 'can I use English correction' })
    );
  });

  // --- Result state: Esc sends original ---

  it('Esc on result sends original text and fully resets state', () => {
    useCorrectionStore.setState({
      enabled: true,
      panelVisible: true,
      showingResult: true,
      waitingForCorrection: false,
      pendingCorrection: {
        original: 'can I use english correction',
        corrected: 'can I use English correction',
      },
      inputBuffer: 'can I use english correction',
      textValue: 'can I use english correction',
      diffHtml: '<div>diff</div>',
    });

    // Simulate Esc → send original
    const pending = useCorrectionStore.getState().pendingCorrection!;
    componentSendToTerminal(pending.original);

    const after = useCorrectionStore.getState();
    expect(after.panelVisible).toBe(false);
    expect(after.showingResult).toBe(false);
    expect(after.pendingCorrection).toBeNull();
    expect(sentMessages).toContainEqual(
      expect.objectContaining({ type: 'input', data: 'can I use english correction' })
    );
  });

  // --- Waiting state: Esc cancels and returns to input ---

  it('Esc while waiting cancels and returns to input state', () => {
    useCorrectionStore.setState({
      enabled: true,
      panelVisible: true,
      showingResult: true,
      waitingForCorrection: true,
      pendingCorrection: null,
      inputBuffer: 'my input text',
      textValue: 'my input text',
    });

    // Simulate Esc while waiting: cancel, go back to input
    useCorrectionStore.getState().setWaitingForCorrection(false);
    useCorrectionStore.getState().setShowingResult(false);
    useCorrectionStore.getState().setPendingCorrection(null);

    const after = useCorrectionStore.getState();
    expect(after.panelVisible).toBe(true); // panel stays open
    expect(after.showingResult).toBe(false); // back to input state
    expect(after.waitingForCorrection).toBe(false);
    expect(after.textValue).toBe('my input text'); // text preserved
    expect(sentMessages).toHaveLength(0);
  });

  // --- Input state: Esc closes panel without sending ---

  it('Esc in input state closes panel without sending', () => {
    useCorrectionStore.setState({
      enabled: true,
      panelVisible: true,
      showingResult: false,
      waitingForCorrection: false,
      pendingCorrection: null,
      inputBuffer: '',
      textValue: 'some text',
    });

    componentHideCorrectionPanel();

    const after = useCorrectionStore.getState();
    expect(after.panelVisible).toBe(false);
    expect(after.showingResult).toBe(false);
    expect(after.textValue).toBe('');
    expect(sentMessages).toHaveLength(0);
  });

  // --- Re-opening panel should show clean input state ---

  it('reopening panel after accept shows clean input state', () => {
    useCorrectionStore.setState({
      enabled: true,
      panelVisible: true,
      showingResult: true,
      waitingForCorrection: false,
      pendingCorrection: { original: 'a', corrected: 'b' },
      inputBuffer: 'a',
      textValue: 'a',
      diffHtml: '<div>diff</div>',
    });

    // Accept (Enter) → full cleanup
    componentSendToTerminal('b');

    // Now reopen
    useCorrectionStore.getState().setPanelVisible(true);

    const state = useCorrectionStore.getState();
    expect(state.panelVisible).toBe(true);
    expect(state.showingResult).toBe(false);
    expect(state.waitingForCorrection).toBe(false);
    expect(state.pendingCorrection).toBeNull();
    expect(state.textValue).toBe('');
    expect(state.diffHtml).toBe('');
  });

  // --- Correction error sends original and resets ---

  it('correction-error sends original input and resets', () => {
    useCorrectionStore.setState({
      enabled: true,
      panelVisible: true,
      showingResult: true,
      waitingForCorrection: true,
      inputBuffer: 'my text',
    });

    routeMessage({
      type: 'correction-error',
      sessionId: 'session-1',
      original: 'my text',
      error: 'API error',
    });

    const state = useCorrectionStore.getState();
    expect(state.panelVisible).toBe(false);
    expect(state.showingResult).toBe(false);
    expect(state.waitingForCorrection).toBe(false);
    expect(sentMessages).toContainEqual(
      expect.objectContaining({ type: 'input', data: 'my text' })
    );
  });
});
