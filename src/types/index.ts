export type CorrectionMode = 'grammar' | 'polish';

export type TrackType = 'youtube' | 'audio';
export interface Track { id: string; title: string; url: string; type: TrackType; }
export type RepeatMode = 'none' | 'all' | 'one';

export interface Theme {
  background: string;
  foreground: string;
  cursor: string;
  selection: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  header: string;
  tabbar: string;
  activeTab: string;
  accent: string;
  keyword: string;
  string: string;
  number: string;
  command: string;
}

export interface Session {
  id: string;
  name: string;
}

export interface CorrectionState {
  inputBuffer: string;
  pendingCorrection: { original: string; corrected: string } | null;
  waitingForCorrection: boolean;
  textValue: string;
  showingResult: boolean;
  diffHtml: string;
  panelVisible: boolean;
}

export interface Todo {
  id: string;
  text: string;
  done: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
}

export interface DiffPart {
  type: 'same' | 'added' | 'removed';
  text: string;
}

export interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  path: string;
}

export interface RecordingEvent {
  t: number;
  type: 'i' | 'o';
  data: string;
}

export interface RecordingSummary {
  abstract: string;
  detail: string;
  /** @deprecated kept for backward compat with old sidecar files */
  summary?: string;
  generatedAt: string;
  eventCount: number;
}

export interface RecordingMeta {
  id: string;
  sessionId: string;
  sessionName: string;
  cwd: string;
  startedAt: string;
  endedAt: string | null;
  eventCount: number;
  cols?: number;
  rows?: number;
  firstInput?: string | null;
  hasSummary?: boolean;
  summaryEventCount?: number;
}

export interface Recording extends RecordingMeta {
  events: RecordingEvent[];
}

export interface ImageCacheEntry {
  id: number;
  data: string;
  timestamp: number;
}

/** WebSocket message types sent from server */
export type ServerMessage =
  | { type: 'session-created'; id: string; name: string }
  | { type: 'session-switched'; id: string }
  | { type: 'session-closed'; id: string }
  | { type: 'session-renamed'; id: string; name: string }
  | { type: 'clear'; sessionId: string }
  | { type: 'output'; sessionId: string; data: string }
  | { type: 'correction-result'; sessionId: string; original: string; corrected: string }
  | { type: 'correction-error'; sessionId: string; original: string; error: string }
  | { type: 'claude-running-status'; running: boolean }
  | { type: 'llm-config-status'; configured: boolean; activeProvider: string }
  | { type: 'cwd-result'; cwd: string; home: string }
  | { type: 'directory-listing'; path: string; entries?: FileEntry[]; error?: string }
  | { type: 'file-content'; path: string; content?: string; name?: string; error?: string }
  | { type: 'file-update'; path: string; content?: string; error?: string }
  | { type: 'recording-started'; sessionId: string; recordingId: string }
  | { type: 'recording-stopped'; sessionId: string; recordingId: string };

/** WebSocket message types sent to server */
export type ClientMessage =
  | { type: 'create-session'; name: string }
  | { type: 'switch-session'; sessionId: string }
  | { type: 'close-session'; sessionId: string }
  | { type: 'rename-session'; sessionId: string; name: string }
  | { type: 'check-claude-running' }
  | { type: 'correct-english'; sessionId: string; text: string; mode?: CorrectionMode }
  | { type: 'input'; sessionId: string; data: string }
  | { type: 'resize'; sessionId: string; cols: number; rows: number }
  | { type: 'get-cwd'; sessionId: string }
  | { type: 'list-directory'; path: string; showHidden?: boolean }
  | { type: 'read-file'; path: string }
  | { type: 'watch-file'; path: string }
  | { type: 'unwatch-file'; path: string };
