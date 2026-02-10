import { useConnectionStore } from '@/stores/connectionStore';
import { useSessionStore } from '@/stores/sessionStore';
import { getTerminalInstance } from '@/terminal/terminalInstance';

const CHUNK_SIZE = 4096;
const CHUNK_DELAY = 50;
const INITIAL_DELAY = 800;
const POLL_INTERVAL = 300;
const SAFETY_TIMEOUT = 15000;

let abortController: AbortController | null = null;

function sendInput(data: string) {
  const sessionId = useSessionStore.getState().activeSessionId;
  if (!sessionId) return;
  useConnectionStore.getState().sendMessage('input', { sessionId, data });
}

/** Keywords in Claude's interactive prompts that need an Enter to dismiss */
const INTERMEDIATE_PROMPT_KEYWORDS = [
  'trust this folder',
  'enter to confirm',
  'do you want to allow',
];

function readRecentLines(count: number): string[] {
  const term = getTerminalInstance();
  if (!term) return [];
  const buffer = term.buffer.active;
  const lines: string[] = [];
  for (let i = buffer.cursorY; i >= Math.max(0, buffer.cursorY - count); i--) {
    lines.push(buffer.getLine(i)?.translateToString(true) ?? '');
  }
  return lines;
}

type ScreenState = 'prompt' | 'intermediate' | 'waiting';

function detectScreenState(): ScreenState {
  const lines = readRecentLines(12);
  const blob = lines.join('\n').toLowerCase();

  // Check for the actual Claude input prompt
  for (const line of lines.slice(0, 4)) {
    if (line.includes('❯') || />\s*$/.test(line)) return 'prompt';
  }

  // Check for intermediate permission / trust prompts that need Enter
  for (const keyword of INTERMEDIATE_PROMPT_KEYWORDS) {
    if (blob.includes(keyword)) return 'intermediate';
  }

  return 'waiting';
}

async function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

async function sendChunked(text: string, signal: AbortSignal) {
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    if (signal.aborted) return;
    const chunk = text.slice(i, i + CHUNK_SIZE);
    sendInput(chunk);
    if (i + CHUNK_SIZE < text.length) {
      await sleep(CHUNK_DELAY, signal);
    }
  }
  // Final enter to submit
  await sleep(CHUNK_DELAY, signal);
  sendInput('\r');
}

async function waitForPrompt(signal: AbortSignal): Promise<void> {
  const deadline = Date.now() + SAFETY_TIMEOUT;
  while (Date.now() < deadline) {
    if (signal.aborted) return;
    const state = detectScreenState();
    if (state === 'prompt') return;
    if (state === 'intermediate') {
      // Auto-confirm the permission/trust dialog
      sendInput('\r');
      // Brief pause then keep polling for the real prompt
      await sleep(500, signal);
      // Re-focus terminal in case the dialog stole focus
      const t = getTerminalInstance();
      if (t) t.focus();
      continue;
    }
    await sleep(POLL_INTERVAL, signal);
  }
  // Safety timeout — proceed anyway
}

export function scheduleAutoType(contextText: string) {
  // Cancel any in-progress job
  cancelAutoType();

  const controller = new AbortController();
  abortController = controller;

  (async () => {
    try {
      // Wait for shell init + modal DOM teardown
      await sleep(INITIAL_DELAY, controller.signal);

      // Ensure terminal has focus (modal may have just closed)
      const term = getTerminalInstance();
      if (term) term.focus();

      // Send `claude\r` to start Claude
      sendInput('claude\r');

      // Wait for Claude's prompt
      await waitForPrompt(controller.signal);

      // Send context text in chunks
      await sendChunked(contextText, controller.signal);
    } catch {
      // AbortError or other — silently stop
    }
  })();
}

export function cancelAutoType() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}
