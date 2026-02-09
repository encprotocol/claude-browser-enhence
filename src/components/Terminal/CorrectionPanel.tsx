import { useRef, useEffect } from 'react';
import { useCorrectionStore } from '@/stores/correctionStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useSessionStore } from '@/stores/sessionStore';
import { getTerminalInstance } from '@/terminal/terminalInstance';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default function CorrectionPanel() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelVisible = useCorrectionStore((s) => s.panelVisible);
  const showingResult = useCorrectionStore((s) => s.showingResult);
  const diffHtml = useCorrectionStore((s) => s.diffHtml);
  const waitingForCorrection = useCorrectionStore((s) => s.waitingForCorrection);
  const pendingCorrection = useCorrectionStore((s) => s.pendingCorrection);
  const textValue = useCorrectionStore((s) => s.textValue);

  const mode = useCorrectionStore((s) => s.mode);
  const sendMessage = useConnectionStore((s) => s.sendMessage);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);

  // Focus textarea when switching to input state
  useEffect(() => {
    if (panelVisible && !showingResult && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [panelVisible, showingResult]);

  // Global keyboard handler for result state (like the original uses document listener)
  useEffect(() => {
    if (!panelVisible || !showingResult) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'c' && e.metaKey) {
        const state = useCorrectionStore.getState();
        if (state.pendingCorrection && !state.waitingForCorrection) {
          e.preventDefault();
          navigator.clipboard.writeText(state.pendingCorrection.corrected);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const state = useCorrectionStore.getState();
        if (state.pendingCorrection && !state.waitingForCorrection) {
          sendToTerminal(state.pendingCorrection.corrected);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        const state = useCorrectionStore.getState();
        if (state.waitingForCorrection) {
          // Cancel checking — return to input state with text preserved
          state.setWaitingForCorrection(false);
          state.setShowingResult(false);
          state.setPendingCorrection(null);
        } else if (state.pendingCorrection) {
          // Send original text
          sendToTerminal(state.pendingCorrection.original);
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [panelVisible, showingResult]);

  if (!panelVisible) return null;

  const sendToTerminal = (text: string) => {
    if (text.trim() && activeSessionId) {
      sendMessage('input', { sessionId: activeSessionId, data: text });
    }
    const store = useCorrectionStore.getState();
    store.setTextValue('');
    store.setInputBuffer('');
    store.setPendingCorrection(null);
    store.setShowingResult(false);
    store.setWaitingForCorrection(false);
    store.setDiffHtml('');
    store.setPanelVisible(false);
    // Defer focus so React unmounts the panel first
    setTimeout(() => getTerminalInstance()?.focus(), 0);
  };

  const hideCorrectionPanel = () => {
    const store = useCorrectionStore.getState();
    store.setTextValue('');
    store.setInputBuffer('');
    store.setPendingCorrection(null);
    store.setShowingResult(false);
    store.setWaitingForCorrection(false);
    store.setDiffHtml('');
    store.setPanelVisible(false);
    setTimeout(() => getTerminalInstance()?.focus(), 0);
  };

  const requestCorrection = (text: string) => {
    if (!text.trim()) return;
    useCorrectionStore.getState().setInputBuffer(text);
    useCorrectionStore.getState().setWaitingForCorrection(true);

    const checkingHtml = `<div style="margin-bottom: 8px;">${escapeHtml(text)}</div><div class="correction-checking"><div class="spinner"></div>Checking... (Esc to cancel)</div>`;
    useCorrectionStore.getState().setDiffHtml(checkingHtml);
    useCorrectionStore.getState().setShowingResult(true);

    const mode = useCorrectionStore.getState().mode;
    sendMessage('correct-english', { sessionId: activeSessionId, text, mode });
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      const text = textareaRef.current?.value || '';
      if (text.trim()) sendToTerminal(text);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = textareaRef.current?.value || '';
      if (text.trim()) requestCorrection(text);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hideCorrectionPanel();
    }
  };

  return (
    <div className="correction-panel visible">
      {!showingResult ? (
        <div className="correction-state">
          <textarea
            ref={textareaRef}
            className="correction-input-text"
            placeholder={mode === 'polish' ? 'Type and press Enter to polish... (Esc to close)' : 'Type and press Enter to check... (Esc to close)'}
            rows={3}
            defaultValue={textValue}
            onKeyDown={handleTextareaKeyDown}
            onChange={(e) => useCorrectionStore.getState().setTextValue(e.target.value)}
          />
        </div>
      ) : (
        <div className="correction-state">
          <div className="correction-diff" dangerouslySetInnerHTML={{ __html: diffHtml }} />
          <div className="correction-result-actions">
            <span className="correction-result-hint">Enter = accept corrected · Esc = send original</span>
            <button className="correction-copy-btn" onClick={() => {
              if (pendingCorrection) navigator.clipboard.writeText(pendingCorrection.corrected);
            }}>Copy (⌘C)</button>
          </div>
        </div>
      )}
    </div>
  );
}
