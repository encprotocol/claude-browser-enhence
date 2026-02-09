const RESET = '\x1b[0m';

let highlightColors = {
  keyword: '\x1b[35m',
  string: '\x1b[32m',
  number: '\x1b[33m',
  command: '\x1b[36m',
};

export function hexToAnsi(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}

export function setColors(colors: Partial<Record<'keyword' | 'string' | 'number' | 'command', string>>): void {
  if (colors.keyword) highlightColors.keyword = hexToAnsi(colors.keyword);
  if (colors.string) highlightColors.string = hexToAnsi(colors.string);
  if (colors.number) highlightColors.number = hexToAnsi(colors.number);
  if (colors.command) highlightColors.command = hexToAnsi(colors.command);
}

interface HighlightPattern {
  regex: RegExp;
  color: string;
  group?: number;
}

export const patterns: HighlightPattern[] = [
  // Status - Success (green)
  {
    regex: /\b(success|succeeded|done|complete|completed|passed|ok|ready|active|enabled|connected|established)\b/gi,
    color: '\x1b[32m',
  },
  // Status - Error (red)
  {
    regex: /\b(error|errors|failed|failure|fatal|exception|crash|crashed|critical|denied|rejected|refused|timeout|timedout|aborted|panic)\b/gi,
    color: '\x1b[31m',
  },
  // Status - Warning (yellow)
  {
    regex: /\b(warning|warn|warnings|deprecated|caution|notice|attention|slow|skipped|skip|missing|invalid|outdated)\b/gi,
    color: '\x1b[33m',
  },
  // Status - Info (cyan)
  {
    regex: /\b(info|note|hint|tip|debug|verbose|pending|waiting|loading|processing|installing|downloading|uploading|building|compiling)\b/gi,
    color: '\x1b[36m',
  },
  // URLs (blue underline)
  {
    regex: /https?:\/\/[^\s\])"'>]+/g,
    color: '\x1b[34;4m',
  },
  // Email addresses (blue)
  {
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    color: '\x1b[34m',
  },
  // IP addresses and ports (blue)
  {
    regex: /\b(?:localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?\b/g,
    color: '\x1b[34m',
  },
  // File paths (magenta)
  {
    regex: /(?:^|[\s"'=])([.~]?\/[\w.-]+(?:\/[\w.-]+)*\/?)/gm,
    color: '\x1b[35m',
    group: 1,
  },
  // Percentages (yellow)
  {
    regex: /\b\d+(?:\.\d+)?%/g,
    color: '\x1b[33m',
  },
  // File sizes (yellow)
  {
    regex: /\b\d+(?:\.\d+)?\s*(?:KB|MB|GB|TB|PB|bytes)\b/gi,
    color: '\x1b[33m',
  },
  // Durations (yellow)
  {
    regex: /\b\d+(?:\.\d+)?\s*(?:ms|sec|seconds|min|minutes|hr|hours)\b/gi,
    color: '\x1b[33m',
  },
  // Counts with units (yellow)
  {
    regex: /\b\d+\s+(?:files?|lines?|items?|errors?|warnings?|tests?|passed|failed|packages?|modules?)\b/gi,
    color: '\x1b[33m',
  },
  // Function calls (cyan)
  {
    regex: /\b([a-zA-Z_]\w*)\(\)/g,
    color: '\x1b[36m',
  },
  // Backtick-wrapped code (cyan)
  {
    regex: /`([^`]+)`/g,
    color: '\x1b[36m',
  },
  // Timestamps - ISO format (dim)
  {
    regex: /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g,
    color: '\x1b[2m',
  },
  // Timestamps - time only (dim)
  {
    regex: /\b\d{2}:\d{2}:\d{2}(?:\.\d+)?\b/g,
    color: '\x1b[2m',
  },
  // Git hashes (dim cyan)
  {
    regex: /\b[a-f0-9]{7,40}\b/g,
    color: '\x1b[2;36m',
  },
  // Environment variables (magenta)
  {
    regex: /\$[A-Z_][A-Z0-9_]*/g,
    color: '\x1b[35m',
  },
  // Flags/options (dim)
  {
    regex: /\s(--?[a-zA-Z][\w-]*)/g,
    color: '\x1b[2m',
    group: 1,
  },
];

interface Match {
  start: number;
  end: number;
  color: string;
  text: string;
}

export function highlight(text: string): string {
  if (/\x1b\[/.test(text)) {
    return text;
  }

  const matches: Match[] = [];

  for (const pattern of patterns) {
    const { regex, color, group } = pattern;
    regex.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      let start: number, end: number, matchText: string;

      if (group !== undefined) {
        const fullMatch = match[0];
        const captured = match[group];
        const groupOffset = fullMatch.indexOf(captured);
        start = match.index + groupOffset;
        end = start + captured.length;
        matchText = captured;
      } else {
        start = match.index;
        end = start + match[0].length;
        matchText = match[0];
      }

      matches.push({ start, end, color, text: matchText });
    }
  }

  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  const filtered: Match[] = [];
  let lastEnd = -1;

  for (const m of matches) {
    if (m.start >= lastEnd) {
      filtered.push(m);
      lastEnd = m.end;
    }
  }

  let result = '';
  let pos = 0;

  for (const m of filtered) {
    result += text.slice(pos, m.start);
    result += m.color + m.text + RESET;
    pos = m.end;
  }

  result += text.slice(pos);
  return result;
}
