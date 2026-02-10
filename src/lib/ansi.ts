import type { RecordingEvent } from '@/types';

/**
 * Clean a raw terminal input buffer: strip ANSI escape sequences,
 * simulate backspace editing, and remove control characters.
 */
export function cleanInputBuffer(raw: string): string {
  // 1. Strip ANSI escape sequences before removing control chars
  let s = raw
    // CSI sequences: ESC [ (optional ?) params final byte (including ~)
    .replace(/\x1b\[[?>=!]?[0-9;]*[A-Za-z~]/g, '')
    // SS3 sequences: ESC O <char>
    .replace(/\x1bO./g, '')
    // OSC sequences
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    // Any remaining two-byte ESC sequences
    .replace(/\x1b./g, '');

  // 2. Simulate backspace editing (\x7f and \x08)
  const chars: string[] = [];
  for (const ch of s) {
    if (ch === '\x7f' || ch === '\x08') {
      chars.pop();
    } else if (ch.charCodeAt(0) >= 0x20) {
      // Only keep printable characters
      chars.push(ch);
    }
  }
  return chars.join('');
}

export function stripAnsi(str: string): string {
  return str
    // Strip OSC sequences: ESC ] ... BEL or ESC ] ... ST
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    // Strip CSI sequences: ESC [ (optional private marker ?>=!) params final byte
    .replace(/\x1b\[[?>=!]?[0-9;]*[A-Za-z]/g, '')
    // Strip remaining ESC sequences (two-char like ESC(B, ESC=, etc.)
    .replace(/\x1b[^[\]].?/g, '')
    // Strip carriage returns
    .replace(/\r/g, '');
}

/**
 * Transcript-optimized ANSI stripping: replaces cursor-forward codes with
 * spaces to preserve word spacing, then strips remaining ANSI.
 */
function stripAnsiForTranscript(str: string): string {
  return str
    // Replace cursor-forward (ESC[nC) with a space to preserve word spacing
    .replace(/\x1b\[\d*C/g, ' ')
    // Strip OSC sequences
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    // Strip remaining CSI sequences
    .replace(/\x1b\[[?>=!]?[0-9;]*[A-Za-z]/g, '')
    // Strip remaining ESC sequences
    .replace(/\x1b[^[\]].?/g, '')
    // Strip carriage returns
    .replace(/\r/g, '');
}

// === Types ===

export type SegmentKind = 'input' | 'response' | 'ascii-art' | 'tool-use' | 'sources';

export interface TranscriptSegment {
  type: SegmentKind;
  text: string;
}

// === Noise detection (used by noise block processing) ===

const SPINNER_CHARS_SET = new Set([...'✢✳✶✻✽⏺·']);
const NON_RECORD_SPINNERS = new Set([...'✢✳✶✻✽·']);

const NOISE_KEYWORDS = [
  'transmuting',
  'percolating',
  'perambulating',
  'moseying',
  'symbioting',
  '(thinking)',
  '(thought for',
  'esc to interrupt',
  'esctointerrupt',
  '? for shortcuts',
  'forshortcuts',
  'claude code has switched',
  'claude install',
  'claudeinstall',
  'getting-started',
  'claude wants to fetch',
  'do you want to allow claude',
  "yes, and don't ask again",
  "no, and tell claude",
  'try "refactor',
  'try "review',
  'welcome back',
  'tips for getting started',
  'recent activity',
  'no recent activity',
  'run /init to create',
  'claude max',
  'claude pro',
  'claude code v',
  'opus 4',
  'sonnet 4',
  '/ide for',
  'incubating',
];

/**
 * Clean a single line for noise block processing: strip leading spinner
 * decorators, │...│ wrappers, and trailing noise.
 */
function cleanLine(raw: string): string {
  let t = raw.trim();
  // Lines wrapped in │...│ — strip outer │ for cleaner display
  if (t.startsWith('│') && t.endsWith('│')) {
    t = t.slice(1, -1).trim();
    // After stripping, remove any remaining trailing │ (from multi-column boxes)
    t = t.replace(/\s*│\s*$/, '').trim();
  }
  // Strip leading ⏺ decorator (used for tool use labels and response blocks)
  t = t.replace(/^⏺\s*/, '');
  // Strip the ⎿ sub-result decorator
  t = t.replace(/^⎿\s*/, '');
  return t.trim();
}

// Regex-based noise patterns
const NOISE_PATTERNS = [
  /^did \d+ search(es)? in \d+s/i,           // "Did 1 search in 12s"
  /\d+\.?\d*k? tokens?\)/,                  // "(36s · ↑ 659 tokens)" or "1.0k tokens)"
  /^fetching…$/i,                            // "Fetching…"
  /^received \d+.*\(\d+ \w+\)/i,            // "Received 400.9KB (200 OK)"
  /^[─━═╌╍┄┅┈┉╭╮╰╯├┤┬┴┼│┌┐└┘╔╗╚╝║╠╣╦╩╬ ▗▖▘▝]+$/, // Lines made entirely of box/block chars
  /^~\/\S+$/, // Bare home-relative path (TUI CWD display)
  /^Fetch\(https?:\/\//,  // Fetch tool use indicators
  /^https?:\/\/\S+$/, // Bare URLs (Fetch display lines)
];

function isNoiseLine(trimmed: string): boolean {
  // Lines starting with non-⏺ spinner characters are animation frames
  if (trimmed.length > 0 && NON_RECORD_SPINNERS.has(trimmed[0])) return true;
  // Lines made entirely of spinner chars and whitespace
  if (trimmed.length > 0 && [...trimmed].every((c) => SPINNER_CHARS_SET.has(c) || c === ' ')) return true;
  // Separator lines (all box-drawing/dash chars)
  if (/^[─━═╌╍┄┅┈┉]+$/.test(trimmed)) return true;
  // All lines starting with ❯ are TUI prompt redraws (input captured separately)
  if (trimmed.startsWith('❯')) return true;
  // IDE indicator lines
  if (/^◯/.test(trimmed)) return true;
  // Very short lines — keystroke echoes or TUI fragments
  if (trimmed.length <= 5) return true;
  // Short lines ending in … are truncated TUI fragments
  if (trimmed.length <= 8 && trimmed.endsWith('…')) return true;
  // Lines that are mostly whitespace with scattered chars (cursor-positioned fragments)
  { const noSpaces = trimmed.replace(/\s+/g, '');
    if (noSpaces.length <= 6 && trimmed.length >= noSpaces.length + 2) return true;
  }
  // Check noise keywords (case-insensitive)
  const lower = trimmed.toLowerCase();
  for (const keyword of NOISE_KEYWORDS) {
    if (lower.includes(keyword)) return true;
  }
  // Check regex noise patterns
  for (const pattern of NOISE_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  return false;
}

// === Content block processing ===

const SPINNER_WORDS = ['transmuting', 'percolating', 'perambulating', 'moseying', 'symbioting'];

const CONTENT_FILTER_KEYWORDS = [
  ...SPINNER_WORDS,
  '(thinking)',
  '(thought for',
  'incubating',
];

const BOX_DRAWING_CHARS = new Set([...'│─┌┐└┘═╔╗╚╝├┤┬┴┼╭╮╰╯▼▲+|║╠╣╦╩╬']);

const TOOL_USE_PREFIXES = [
  /^Web Search\(/,
  /^Fetch\(/,
  /^Read\(/,
  /^Write\(/,
  /^Edit\(/,
  /^Bash\(/,
  /^Glob\(/,
  /^Grep\(/,
  /^Task\(/,
  /^WebFetch\(/,
  /^WebSearch\(/,
];

/**
 * Minimal filtering for content blocks. Strips decorators and leaked noise
 * but preserves all box-drawing, short lines, and ASCII art.
 */
function cleanContentBlock(raw: string): string[] {
  const stripped = stripAnsiForTranscript(raw);
  const lines = stripped.split('\n');
  const clean: string[] = [];

  for (const line of lines) {
    let t = line.trimEnd();
    // Strip ⏺ and ⎿ decorators (with optional leading whitespace)
    t = t.replace(/^\s*⏺\s?/, '');
    t = t.replace(/^\s*⎿\s?/, '');

    const trimmed = t.trim();

    // Filter ◯ IDE indicator lines
    if (/^◯/.test(trimmed)) continue;

    // Filter pure TUI separator lines (e.g., ──────────── ≥20 repeated chars)
    if (/^([─━═╌╍┄┅┈┉])\1{19,}$/.test(trimmed)) continue;

    // Skip prompt/interrupt noise
    if (trimmed.startsWith('❯')) continue;
    const lower = trimmed.toLowerCase();
    if (lower.includes('esc to interrupt') || lower.includes('esctointerrupt')) continue;
    if (lower.includes('? for shortcuts') || lower.includes('forshortcuts')) continue;

    // Skip spinner noise that leaked into content
    if (trimmed.length > 0 && NON_RECORD_SPINNERS.has(trimmed[0])) continue;
    if (trimmed.length > 0 && [...trimmed].every(c => SPINNER_CHARS_SET.has(c) || c === ' ')) continue;
    if (CONTENT_FILTER_KEYWORDS.some(kw => lower.includes(kw))) continue;

    // Blank lines — keep at most one consecutive
    if (!trimmed) {
      if (clean.length > 0 && clean[clean.length - 1] !== '') clean.push('');
      continue;
    }

    clean.push(t);
  }

  // Remove trailing blank lines
  while (clean.length > 0 && clean[clean.length - 1] === '') clean.pop();

  // Strip common leading whitespace to normalize indentation
  const minIndent = clean.filter(l => l.length > 0)
    .reduce((min, l) => {
      const indent = l.match(/^(\s*)/)?.[1].length ?? 0;
      return Math.min(min, indent);
    }, Infinity);
  if (minIndent > 0 && minIndent < Infinity) {
    return clean.map(l => l.length > 0 ? l.slice(minIndent) : l);
  }

  return clean;
}

function classifyLine(line: string): SegmentKind {
  // tool-use
  for (const pat of TOOL_USE_PREFIXES) {
    if (pat.test(line)) return 'tool-use';
  }

  // sources
  if (/^Sources:/i.test(line) || /^- https?:\/\//.test(line)) return 'sources';

  // ascii-art: >50% of non-space chars are box-drawing
  // OR: line is bounded by box-drawing chars (e.g., ║ text ║)
  const nonSpace = [...line].filter(c => c !== ' ');
  if (nonSpace.length > 0) {
    const boxCount = nonSpace.filter(c => BOX_DRAWING_CHARS.has(c)).length;
    if (boxCount / nonSpace.length > 0.5) return 'ascii-art';
    if (boxCount >= 2
      && BOX_DRAWING_CHARS.has(nonSpace[0])
      && BOX_DRAWING_CHARS.has(nonSpace[nonSpace.length - 1])) {
      return 'ascii-art';
    }
  }

  // Tree/arrow diagram patterns
  if (/^\s*[|│]/.test(line)) return 'ascii-art';
  if (/\+--/.test(line)) return 'ascii-art';
  if (/--+>|<--+|==+>/.test(line)) return 'ascii-art';

  return 'response';
}

type LineMark = SegmentKind | 'blank';

function detectDiagramRegions(lines: string[]): SegmentKind[] {
  // First pass: mark each line
  const marks: LineMark[] = lines.map(line => line === '' ? 'blank' : classifyLine(line));

  // Second pass: bridge gaps ≤ 2 between ascii-art lines
  for (let i = 0; i < marks.length; i++) {
    if (marks[i] !== 'ascii-art') continue;
    for (let j = i + 1; j <= Math.min(i + 3, marks.length - 1); j++) {
      if (marks[j] === 'ascii-art') {
        for (let k = i + 1; k < j; k++) marks[k] = 'ascii-art';
        i = j - 1;
        break;
      }
    }
  }

  // Resolve blanks: inherit from surrounding context
  for (let i = 0; i < marks.length; i++) {
    if (marks[i] === 'blank') {
      marks[i] = i > 0 ? marks[i - 1] as SegmentKind : 'response';
    }
  }

  return marks as SegmentKind[];
}

function classifyContentLines(lines: string[]): TranscriptSegment[] {
  const kinds = detectDiagramRegions(lines);
  const segments: TranscriptSegment[] = [];
  let currentKind: SegmentKind | null = null;
  let currentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const kind = kinds[i];

    if (kind !== currentKind && currentLines.length > 0) {
      const text = currentLines.join('\n').trim();
      if (text) segments.push({ type: currentKind!, text });
      currentLines = [];
    }

    currentKind = kind;
    currentLines.push(lines[i]);
  }

  if (currentLines.length > 0 && currentKind) {
    const text = currentLines.join('\n').trim();
    if (text) segments.push({ type: currentKind, text });
  }

  return segments;
}

// === Block grouping (temporal event classification) ===

interface OutputBlock {
  kind: 'content' | 'noise';
  events: Array<{ t: number; data: string }>;
}

function classifyRun(events: Array<{ t: number; data: string }>): OutputBlock {
  const totalSize = events.reduce((sum, e) => sum + e.data.length, 0);
  const combined = events.map(e => e.data).join('');
  const stripped = stripAnsiForTranscript(combined);
  const trimmed = stripped.trim();

  // Check for ⏺ + word char (not spinner word) prefix → always content
  if (/^⏺\s*\w/.test(trimmed)) {
    const afterDot = trimmed.replace(/^⏺\s*/, '');
    const lower = afterDot.toLowerCase();
    const isSpinner = SPINNER_WORDS.some(w => lower.startsWith(w));
    if (!isSpinner) return { kind: 'content', events };
  }

  // Large payload → content, unless it smells like TUI chrome
  if (totalSize >= 200) {
    const lower = trimmed.toLowerCase();
    const noiseHits = NOISE_KEYWORDS.filter(kw => lower.includes(kw)).length;
    if (noiseHits <= 1) return { kind: 'content', events };
    // Multiple noise keyword matches → TUI chrome (welcome box, etc.)
  }

  return { kind: 'noise', events };
}

function groupOutputBlocks(events: Array<{ t: number; data: string }>): OutputBlock[] {
  if (events.length === 0) return [];

  const blocks: OutputBlock[] = [];
  let currentRun: Array<{ t: number; data: string }> = [events[0]];

  for (let i = 1; i < events.length; i++) {
    const dt = events[i].t - events[i - 1].t;
    if (dt > 5) {
      blocks.push(classifyRun(currentRun));
      currentRun = [events[i]];
    } else {
      currentRun.push(events[i]);
    }
  }
  blocks.push(classifyRun(currentRun));

  return blocks;
}

// === Main transcript builder ===

/**
 * Process raw recording events into a clean, readable transcript.
 *
 * Two-phase processing:
 * 1. Group output events into content vs noise blocks (temporal signals)
 * 2. Apply different filters per block type:
 *    - Noise blocks: aggressive filtering (strip TUI chrome, spinners, short lines)
 *    - Content blocks: minimal filtering, preserve ASCII art, classify segments
 */
export function buildCleanTranscript(events: RecordingEvent[]): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let inputBuf = '';
  let outputEvents: Array<{ t: number; data: string }> = [];

  function processNoiseBlock(raw: string) {
    const stripped = stripAnsiForTranscript(raw);
    const lines = stripped.split('\n');
    const clean: string[] = [];
    let prev = '';
    for (const line of lines) {
      const cleaned = cleanLine(line);
      if (!cleaned) {
        if (clean.length > 0 && clean[clean.length - 1] !== '') clean.push('');
        continue;
      }
      if (isNoiseLine(cleaned)) continue;
      if (cleaned === prev) continue; // deduplicate consecutive identical
      clean.push(cleaned);
      prev = cleaned;
    }
    while (clean.length > 0 && clean[clean.length - 1] === '') clean.pop();
    const text = clean.join('\n').trim();
    if (text) segments.push({ type: 'response', text });
  }

  function processContentBlock(raw: string) {
    const lines = cleanContentBlock(raw);
    if (lines.length === 0) return;
    const classified = classifyContentLines(lines);
    segments.push(...classified);
  }

  function flushOutput() {
    if (outputEvents.length === 0) return;
    const blocks = groupOutputBlocks(outputEvents);
    outputEvents = [];

    for (const block of blocks) {
      const raw = block.events.map(e => e.data).join('');
      if (block.kind === 'noise') {
        processNoiseBlock(raw);
      } else {
        processContentBlock(raw);
      }
    }
  }

  function flushInput() {
    // Strip ANSI escape sequences first
    const stripped = stripAnsi(inputBuf);
    // Simulate backspace: process \x7f and \x08 by removing previous character
    const chars: string[] = [];
    for (const ch of stripped) {
      if (ch === '\x7f' || ch === '\x08') {
        chars.pop();
      } else if (ch.charCodeAt(0) >= 0x20 || ch === '\n') {
        // Keep printable chars and newlines, skip other control chars
        chars.push(ch);
      }
    }
    const text = chars.join('').trim();
    inputBuf = '';
    if (text) segments.push({ type: 'input', text });
  }

  for (const ev of events) {
    if (ev.type === 'i') {
      inputBuf += ev.data;
      // Enter key pressed — flush accumulated output then input
      if (ev.data.includes('\r') || ev.data.includes('\n')) {
        flushOutput();
        flushInput();
      }
    } else {
      outputEvents.push({ t: ev.t, data: ev.data });
    }
  }

  // Flush remaining
  flushOutput();
  if (inputBuf.trim()) flushInput();

  return segments;
}
