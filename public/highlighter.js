/**
 * Auto-detecting keyword highlighter for terminal output
 * Detects and colorizes patterns using ANSI escape codes
 */

const RESET = '\x1b[0m';

// Configurable colors (can be changed via setColors)
let highlightColors = {
  keyword: '\x1b[35m',   // magenta
  string: '\x1b[32m',    // green
  number: '\x1b[33m',    // yellow
  command: '\x1b[36m'    // cyan
};

/**
 * Convert hex color to ANSI 24-bit true color escape code
 * @param {string} hex - Hex color like '#ff5555'
 * @returns {string} - ANSI escape code
 */
function hexToAnsi(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}

/**
 * Set custom highlight colors
 * @param {Object} colors - { keyword, string, number, command } as hex values
 */
function setColors(colors) {
  if (colors.keyword) highlightColors.keyword = hexToAnsi(colors.keyword);
  if (colors.string) highlightColors.string = hexToAnsi(colors.string);
  if (colors.number) highlightColors.number = hexToAnsi(colors.number);
  if (colors.command) highlightColors.command = hexToAnsi(colors.command);
}

const patterns = [
  // Status - Success (green)
  {
    regex: /\b(success|succeeded|done|complete|completed|passed|ok|ready|active|enabled|connected|established)\b/gi,
    color: '\x1b[32m'
  },
  // Status - Error (red)
  {
    regex: /\b(error|errors|failed|failure|fatal|exception|crash|crashed|critical|denied|rejected|refused|timeout|timedout|aborted|panic)\b/gi,
    color: '\x1b[31m'
  },
  // Status - Warning (yellow)
  {
    regex: /\b(warning|warn|warnings|deprecated|caution|notice|attention|slow|skipped|skip|missing|invalid|outdated)\b/gi,
    color: '\x1b[33m'
  },
  // Status - Info (cyan)
  {
    regex: /\b(info|note|hint|tip|debug|verbose|pending|waiting|loading|processing|installing|downloading|uploading|building|compiling)\b/gi,
    color: '\x1b[36m'
  },

  // URLs (blue underline) - must be before file paths
  {
    regex: /https?:\/\/[^\s\])"'>]+/g,
    color: '\x1b[34;4m'
  },

  // Email addresses (blue)
  {
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    color: '\x1b[34m'
  },

  // IP addresses and ports (blue)
  {
    regex: /\b(?:localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?\b/g,
    color: '\x1b[34m'
  },

  // File paths (magenta)
  {
    regex: /(?:^|[\s"'=])([.~]?\/[\w.-]+(?:\/[\w.-]+)*\/?)/gm,
    color: '\x1b[35m',
    group: 1
  },

  // Percentages (yellow)
  {
    regex: /\b\d+(?:\.\d+)?%/g,
    color: '\x1b[33m'
  },

  // File sizes (yellow)
  {
    regex: /\b\d+(?:\.\d+)?\s*(?:KB|MB|GB|TB|PB|bytes)\b/gi,
    color: '\x1b[33m'
  },

  // Durations (yellow)
  {
    regex: /\b\d+(?:\.\d+)?\s*(?:ms|sec|seconds|min|minutes|hr|hours)\b/gi,
    color: '\x1b[33m'
  },

  // Counts with units (yellow)
  {
    regex: /\b\d+\s+(?:files?|lines?|items?|errors?|warnings?|tests?|passed|failed|packages?|modules?)\b/gi,
    color: '\x1b[33m'
  },

  // Function calls (cyan)
  {
    regex: /\b([a-zA-Z_]\w*)\(\)/g,
    color: '\x1b[36m'
  },

  // Backtick-wrapped code (cyan)
  {
    regex: /`([^`]+)`/g,
    color: '\x1b[36m'
  },

  // Timestamps - ISO format (dim)
  {
    regex: /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g,
    color: '\x1b[2m'
  },

  // Timestamps - time only (dim)
  {
    regex: /\b\d{2}:\d{2}:\d{2}(?:\.\d+)?\b/g,
    color: '\x1b[2m'
  },

  // Git hashes (dim cyan)
  {
    regex: /\b[a-f0-9]{7,40}\b/g,
    color: '\x1b[2;36m'
  },

  // Environment variables (magenta)
  {
    regex: /\$[A-Z_][A-Z0-9_]*/g,
    color: '\x1b[35m'
  },

  // Flags/options (dim)
  {
    regex: /\s(--?[a-zA-Z][\w-]*)/g,
    color: '\x1b[2m',
    group: 1
  },
];

/**
 * Highlight text with auto-detected patterns
 * Uses marker-based approach to avoid corrupting ANSI codes
 * @param {string} text - Raw terminal output
 * @returns {string} - Text with ANSI color codes injected
 */
function highlight(text) {
  // Skip if text already has ANSI codes (already colorized)
  if (/\x1b\[/.test(text)) {
    return text;
  }

  // Collect all matches with their positions
  const matches = [];

  for (const pattern of patterns) {
    const { regex, color, group } = pattern;
    regex.lastIndex = 0;

    let match;
    while ((match = regex.exec(text)) !== null) {
      let start, end, matchText;

      if (group !== undefined) {
        // Find the position of the captured group within the match
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

  // Sort by start position, then by length (longer matches first)
  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  // Remove overlapping matches (keep first/longer ones)
  const filtered = [];
  let lastEnd = -1;

  for (const m of matches) {
    if (m.start >= lastEnd) {
      filtered.push(m);
      lastEnd = m.end;
    }
  }

  // Build result string with highlights
  let result = '';
  let pos = 0;

  for (const m of filtered) {
    // Add text before this match
    result += text.slice(pos, m.start);
    // Add highlighted match
    result += m.color + m.text + RESET;
    pos = m.end;
  }

  // Add remaining text
  result += text.slice(pos);

  return result;
}

/**
 * Create a highlighting wrapper for xterm.js
 * @param {Terminal} term - xterm.js terminal instance
 * @returns {function} - Enhanced write function
 */
function createHighlightingWriter(term) {
  const originalWrite = term.write.bind(term);

  return function(data) {
    const highlighted = highlight(data);
    originalWrite(highlighted);
  };
}

// Export for use in browser
if (typeof window !== 'undefined') {
  window.Highlighter = {
    highlight,
    createHighlightingWriter,
    patterns,
    setColors,
    hexToAnsi
  };
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { highlight, createHighlightingWriter, patterns, setColors, hexToAnsi };
}
