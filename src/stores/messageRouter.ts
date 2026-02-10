import type { ServerMessage } from '@/types';
import { useSessionStore } from '@/stores/sessionStore';
import { useCorrectionStore } from '@/stores/correctionStore';
import { useFileBrowserStore } from '@/stores/fileBrowserStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useRecordingStore } from '@/stores/recordingStore';
import { getTerminalInstance } from '@/terminal/terminalInstance';
import { highlight } from '@/lib/highlighter';
import { computeWordDiff } from '@/lib/diff';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sendInput(text: string) {
  const sessionId = useSessionStore.getState().activeSessionId;
  if (sessionId && text.trim()) {
    useConnectionStore.getState().sendMessage('input', { sessionId, data: text });
  }
}

export function routeMessage(msg: ServerMessage) {
  const sessionStore = useSessionStore.getState();
  const correctionStore = useCorrectionStore.getState();
  const fileBrowserStore = useFileBrowserStore.getState();
  const term = getTerminalInstance();

  switch (msg.type) {
    case 'session-created':
      sessionStore.addSession(msg.id, msg.name);
      break;

    case 'session-switched': {
      const prevId = sessionStore.activeSessionId;
      if (prevId) correctionStore.saveSessionState(prevId);
      sessionStore.setActiveSession(msg.id);
      if (term) term.clear();
      correctionStore.restoreSessionState(msg.id);
      if (term) term.focus();
      if (prevId) fileBrowserStore.saveSessionState(prevId);
      const fbState = useFileBrowserStore.getState();
      if (fbState.visible) {
        if (fbState.linked) {
          useConnectionStore.getState().sendMessage('get-cwd', { sessionId: msg.id });
        } else if (!fileBrowserStore.restoreSessionState(msg.id)) {
          useConnectionStore.getState().sendMessage('get-cwd', { sessionId: msg.id });
        }
      }
      if (term) setTimeout(() => term.scrollToBottom(), 150);
      break;
    }

    case 'session-closed':
      sessionStore.removeSession(msg.id);
      correctionStore.clearSessionState(msg.id);
      fileBrowserStore.clearSessionState(msg.id);
      break;

    case 'session-renamed':
      sessionStore.renameSession(msg.id, msg.name);
      break;

    case 'clear':
      if (term) term.clear();
      break;

    case 'output':
      if (msg.sessionId === sessionStore.activeSessionId && term) {
        const output = highlight(msg.data);
        term.write(output);
      }
      break;

    case 'correction-result': {
      correctionStore.setWaitingForCorrection(false);
      if (msg.sessionId === sessionStore.activeSessionId) {
        if (msg.original.trim() === msg.corrected.trim()) {
          correctionStore.setPendingCorrection(null);
          correctionStore.setTextValue('');
          correctionStore.setInputBuffer('');
          correctionStore.setPanelVisible(false);
          sendInput(msg.original);
        } else {
          const diff = computeWordDiff(msg.original, msg.corrected);
          let html = '<div class="diff-inline">';
          for (const part of diff) {
            if (part.type === 'removed') {
              html += `<span class="removed">${escapeHtml(part.text)}</span>`;
            } else if (part.type === 'added') {
              html += `<span class="added">${escapeHtml(part.text)}</span>`;
            } else {
              html += escapeHtml(part.text);
            }
          }
          html += '</div>';
          html += `<div class="diff-corrected">${escapeHtml(msg.corrected)}</div>`;
          correctionStore.setPendingCorrection({ original: msg.original, corrected: msg.corrected });
          correctionStore.setDiffHtml(html);
          correctionStore.setShowingResult(true);
        }
      }
      break;
    }

    case 'correction-error': {
      correctionStore.setWaitingForCorrection(false);
      if (msg.sessionId === sessionStore.activeSessionId) {
        const buffer = correctionStore.inputBuffer;
        correctionStore.reset();
        if (buffer.trim()) sendInput(buffer);
      }
      break;
    }

    case 'claude-running-status':
      correctionStore.setClaudeRunning(msg.running);
      if (msg.running) {
        correctionStore.setEnabled(true);
        correctionStore.setPanelVisible(true);
      }
      break;

    case 'cwd-result':
      fileBrowserStore.handleCwdResult(msg.cwd, msg.home);
      // Request directory listing after CWD is set
      useConnectionStore.getState().sendMessage('list-directory', {
        path: msg.cwd,
        showHidden: useFileBrowserStore.getState().showHidden,
      });
      break;

    case 'directory-listing':
      fileBrowserStore.handleDirectoryListing(msg.path, msg.entries, msg.error);
      break;

    case 'file-content': {
      const name = msg.name || msg.path.split('/').pop() || 'File';
      if (msg.error) {
        fileBrowserStore.showTextViewer(name, msg.path, msg.error, true);
      } else if (msg.content !== undefined) {
        fileBrowserStore.showTextViewer(name, msg.path, msg.content, false);
        // Start watching the file
        useConnectionStore.getState().sendMessage('watch-file', { path: msg.path });
      }
      break;
    }

    case 'file-update':
      fileBrowserStore.handleFileUpdate(msg.path, msg.content, msg.error);
      break;

    case 'recording-started':
      useRecordingStore.getState().setActiveRecording(msg.sessionId, msg.recordingId);
      break;

    case 'recording-stopped':
      useRecordingStore.getState().clearActiveRecording(msg.sessionId);
      break;
  }
}
