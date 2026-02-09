import type { Terminal } from '@xterm/xterm';

/** Module-level singleton so stores and WS handler can access the xterm instance */
let terminalInstance: Terminal | null = null;

export function setTerminalInstance(term: Terminal) {
  terminalInstance = term;
}

export function getTerminalInstance(): Terminal | null {
  return terminalInstance;
}
