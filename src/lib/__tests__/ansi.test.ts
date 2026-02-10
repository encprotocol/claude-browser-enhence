import { describe, it, expect } from 'vitest';
import { stripAnsi, buildCleanTranscript } from '@/lib/ansi';
import type { RecordingEvent } from '@/types';

describe('stripAnsi', () => {
  it('passes plain text unchanged', () => {
    expect(stripAnsi('hello world')).toBe('hello world');
  });

  it('strips color codes', () => {
    expect(stripAnsi('\x1b[31mred\x1b[0m')).toBe('red');
    expect(stripAnsi('\x1b[1;32mbold green\x1b[0m')).toBe('bold green');
  });

  it('strips cursor movement sequences', () => {
    expect(stripAnsi('\x1b[2Jcleared')).toBe('cleared');
    expect(stripAnsi('\x1b[H\x1b[2Jhello')).toBe('hello');
    expect(stripAnsi('\x1b[10;20Hpositioned')).toBe('positioned');
  });

  it('strips OSC sequences', () => {
    expect(stripAnsi('\x1b]0;window title\x07rest')).toBe('rest');
    expect(stripAnsi('\x1b]0;title\x1b\\rest')).toBe('rest');
  });

  it('strips carriage returns', () => {
    expect(stripAnsi('line1\r\nline2')).toBe('line1\nline2');
  });

  it('handles empty string', () => {
    expect(stripAnsi('')).toBe('');
  });

  it('handles mixed sequences', () => {
    expect(stripAnsi('\x1b[1m\x1b[31mhello\x1b[0m \x1b[32mworld\x1b[0m')).toBe('hello world');
  });

  it('strips DEC private mode sequences', () => {
    expect(stripAnsi('\x1b[?2026htext\x1b[?2026l')).toBe('text');
    expect(stripAnsi('\x1b[?25lhidden\x1b[?25h')).toBe('hidden');
  });

  it('strips 24-bit color sequences', () => {
    expect(stripAnsi('\x1b[38;2;255;153;0mcolored\x1b[0m')).toBe('colored');
  });
});

describe('buildCleanTranscript', () => {
  it('coalesces individual keystrokes into input lines', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'i', data: 'h' },
      { t: 50, type: 'i', data: 'i' },
      { t: 100, type: 'i', data: '\r' },
    ];
    const result = buildCleanTranscript(events);
    const inputs = result.filter((s) => s.type === 'input');
    expect(inputs).toHaveLength(1);
    expect(inputs[0].text).toBe('hi');
  });

  it('filters spinner and thinking noise from output', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: '✢\n✳\n(thinking)\nTransmuting…\nHello world\n' },
    ];
    const result = buildCleanTranscript(events);
    const outputs = result.filter((s) => s.type !== 'input');
    expect(outputs).toHaveLength(1);
    expect(outputs[0].text).toContain('Hello world');
    expect(outputs[0].text).not.toContain('thinking');
    expect(outputs[0].text).not.toContain('Transmuting');
  });

  it('filters separator lines', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: '────────────────\nContent here\n────────────────\n' },
    ];
    const result = buildCleanTranscript(events);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Content here');
  });

  it('filters single-character keystroke echoes', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'i', data: 'h' },
      { t: 10, type: 'o', data: 'h' },
      { t: 50, type: 'i', data: 'i' },
      { t: 60, type: 'o', data: 'i' },
      { t: 100, type: 'i', data: '\r' },
      { t: 200, type: 'o', data: 'Response text here\n' },
    ];
    const result = buildCleanTranscript(events);
    const inputs = result.filter((s) => s.type === 'input');
    const outputs = result.filter((s) => s.type !== 'input');
    expect(inputs).toHaveLength(1);
    expect(inputs[0].text).toBe('hi');
    expect(outputs).toHaveLength(1);
    expect(outputs[0].text).toBe('Response text here');
  });

  it('deduplicates consecutive identical output lines', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: 'Same line\nSame line\nSame line\nDifferent\n' },
    ];
    const result = buildCleanTranscript(events);
    expect(result[0].text).toBe('Same line\nDifferent');
  });

  it('preserves tool use lines with spinner prefix', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: '⏺ Web Search("tokyo weather")\nResult here\n' },
    ];
    const result = buildCleanTranscript(events);
    expect(result[0].type).toBe('tool-use');
    expect(result[0].text).toContain('Web Search');
    expect(result[1].type).toBe('response');
    expect(result[1].text).toContain('Result here');
  });

  it('filters esc-to-interrupt and shortcut hints', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: 'esc to interrupt\n? for shortcuts\nActual content\n' },
    ];
    const result = buildCleanTranscript(events);
    expect(result[0].text).toBe('Actual content');
  });

  it('filters spaceless noise from cursor positioning artifacts', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: 'esctointerrupt\nforshortcuts\nActual content\n' },
    ];
    const result = buildCleanTranscript(events);
    expect(result[0].text).toBe('Actual content');
  });

  it('filters lines starting with non-⏺ spinner chars', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: '✽Trns\n✻mi\n✶i…\nActual response\n' },
    ];
    const result = buildCleanTranscript(events);
    expect(result[0].text).toBe('Actual response');
  });

  it('strips ⏺ prefix but keeps content', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: "⏺Here's the weather in Tokyo\n" },
    ];
    const result = buildCleanTranscript(events);
    expect(result[0].text).toBe("Here's the weather in Tokyo");
  });

  it('strips escape sequences from input', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'i', data: 'hello' },
      { t: 100, type: 'i', data: '\r' },
      { t: 200, type: 'i', data: '\x1b[O' },
    ];
    const result = buildCleanTranscript(events);
    const inputs = result.filter((s) => s.type === 'input');
    expect(inputs).toHaveLength(1);
    expect(inputs[0].text).toBe('hello');
  });

  it('returns empty array for no meaningful content', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: '✢\n✳\n(thinking)\n' },
    ];
    expect(buildCleanTranscript(events)).toHaveLength(0);
  });

  it('preserves word spacing from cursor-forward codes', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: 'hello\x1b[1Cworld\x1b[1Cfoo\n' },
    ];
    const result = buildCleanTranscript(events);
    expect(result[0].text).toBe('hello world foo');
  });

  it('filters short fragment lines and truncated TUI text', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: 'adng\nKne…\nReading…\nActual useful content here\n' },
    ];
    const result = buildCleanTranscript(events);
    expect(result[0].text).toBe('Actual useful content here');
  });

  it('filters Claude Code getting-started banner fragments', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: 'claude-code/getting-startedformoreoptions.\nReal content\n' },
    ];
    const result = buildCleanTranscript(events);
    expect(result[0].text).toBe('Real content');
  });

  it('processes backspace corrections in input', () => {
    // User types "Ica", backspaces 3 times, then types "What"
    const events: RecordingEvent[] = [
      { t: 0, type: 'i', data: 'I' },
      { t: 50, type: 'i', data: 'c' },
      { t: 100, type: 'i', data: 'a' },
      { t: 150, type: 'i', data: '\x7f' }, // backspace
      { t: 200, type: 'i', data: '\x7f' }, // backspace
      { t: 250, type: 'i', data: '\x7f' }, // backspace
      { t: 300, type: 'i', data: 'W' },
      { t: 350, type: 'i', data: 'h' },
      { t: 400, type: 'i', data: 'a' },
      { t: 450, type: 'i', data: 't' },
      { t: 500, type: 'i', data: '\r' },
    ];
    const result = buildCleanTranscript(events);
    const inputs = result.filter((s) => s.type === 'input');
    expect(inputs).toHaveLength(1);
    expect(inputs[0].text).toBe('What');
  });

  it('processes backspace \\x08 in input', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'i', data: 'helo' },
      { t: 50, type: 'i', data: '\x08' }, // backspace
      { t: 100, type: 'i', data: 'lo' },
      { t: 150, type: 'i', data: '\r' },
    ];
    const result = buildCleanTranscript(events);
    const inputs = result.filter((s) => s.type === 'input');
    expect(inputs).toHaveLength(1);
    expect(inputs[0].text).toBe('hello');
  });

  it('filters Percolating spinner word from output', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: 'Percolating…\nActual response here\n' },
    ];
    const result = buildCleanTranscript(events);
    expect(result[0].text).toBe('Actual response here');
  });

  it('filters all lines starting with ❯ prompt character', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: '❯ What is the weather today? · Percolating…\n❯\nPercolating…\nThe weather today is sunny.\n' },
    ];
    const result = buildCleanTranscript(events);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('The weather today is sunny.');
  });

  it('filters spinner words: Perambulating, Moseying, Symbioting', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: 'Perambulating…\nMoseying…\nSymbioting…\nActual content\n' },
    ];
    const result = buildCleanTranscript(events);
    expect(result[0].text).toBe('Actual content');
  });

  it('filters "Did N search in Ns" progress lines', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: 'Did 1 search in 12s\nDid 3 searches in 5s\nActual content\n' },
    ];
    const result = buildCleanTranscript(events);
    expect(result[0].text).toBe('Actual content');
  });

  it('filters token counter lines', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: '(36s · ↑ 659 tokens)\n1.0k tokens)\nActual content\n' },
    ];
    const result = buildCleanTranscript(events);
    expect(result[0].text).toBe('Actual content');
  });

  it('filters Claude Code welcome box', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: '╭─── Claude Code v2.1.38 ──────────────────╮\n│ Welcome back James! │\n│ Tips for getting started │\n│ ▗ ▗   ▖ ▖ │\n│ No recent activity │\n│ Opus 4.6 · Claude Max │\n╰──────────────────────────────────────────╯\nActual content\n' },
    ];
    const result = buildCleanTranscript(events);
    expect(result[0].text).toBe('Actual content');
  });

  it('filters Fetch permission prompts', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: 'Claude wants to fetch content from wanderlog.com\nDo you want to allow Claude to fetch this content?\nActual content\n' },
    ];
    const result = buildCleanTranscript(events);
    expect(result[0].text).toBe('Actual content');
  });

  it('filters Fetching/Received progress lines', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: 'Fetching…\nReceived 400.9KB (200 OK)\nActual content\n' },
    ];
    const result = buildCleanTranscript(events);
    expect(result[0].text).toBe('Actual content');
  });

  it('filters lines with box-drawing characters (╭╮│╰╯├┤┬┴┼)', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: '├─────┼─────────────────────────┤\nActual content\n' },
    ];
    const result = buildCleanTranscript(events);
    expect(result[0].text).toBe('Actual content');
  });

  it('preserves table data lines with box chars at boundaries', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: '│ 1 │ TOMMY PIZZA │ 4.8 │ 18 │\n' },
    ];
    const result = buildCleanTranscript(events);
    expect(result[0].text).toContain('TOMMY PIZZA');
    expect(result[0].text).toContain('4.8');
  });

  it('filters "Try refactor" suggestion lines', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: 'Try "refactor <filepath>"\nActual content\n' },
    ];
    const result = buildCleanTranscript(events);
    expect(result[0].text).toBe('Actual content');
  });

  it('filters "Yes, and don\'t ask again" permission lines', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: "Yes, and don't ask again for wanderlog.com\nActual content\n" },
    ];
    const result = buildCleanTranscript(events);
    expect(result[0].text).toBe('Actual content');
  });

  it('filters sparse cursor-positioned fragment lines', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: 'w                                    h\nm o 9 5\ng 50 3\nActual content\n' },
    ];
    const result = buildCleanTranscript(events);
    expect(result[0].text).toBe('Actual content');
  });

  it('filters TUI box panel content (│...│) but keeps table data', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: '│ Welcome back James! │\n│ 1 │ TOMMY PIZZA │ 4.8 │\n' },
    ];
    const result = buildCleanTranscript(events);
    expect(result).toHaveLength(1);
    expect(result[0].text).toContain('TOMMY PIZZA');
    expect(result[0].text).not.toContain('Welcome');
  });

  // === New tests: ASCII art preservation & segment classification ===

  it('preserves ASCII art box-drawing in content blocks (⏺ prefix)', () => {
    const data = [
      '⏺ Here is your travel plan:',
      '',
      '╔════════════════════════════╗',
      '║   TRAVEL PLAN: TOKYO      ║',
      '╠════════════════════════════╣',
      '║ Day 1: Arrival             ║',
      '║ Day 2: Temples             ║',
      '╚════════════════════════════╝',
      '',
      'Have a great trip!',
    ].join('\n') + '\n';
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data },
    ];
    const result = buildCleanTranscript(events);
    const asciiSeg = result.find(s => s.type === 'ascii-art');
    expect(asciiSeg).toBeDefined();
    expect(asciiSeg!.text).toContain('═══');
    expect(asciiSeg!.text).toContain('TRAVEL PLAN');
  });

  it('preserves table separator rows in content blocks', () => {
    const data = '⏺ Table:\n├─────┼─────────┤\n│ A   │ B       │\n├─────┼─────────┤\n';
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data },
    ];
    const result = buildCleanTranscript(events);
    const hasSeparator = result.some(s => s.text.includes('├─────┼─────────┤'));
    expect(hasSeparator).toBe(true);
  });

  it('preserves single-char flow elements (│, ▼) in content blocks', () => {
    const data = '⏺ Flow diagram:\n│\n▼\nProcess A\n│\n▼\nProcess B\n';
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data },
    ];
    const result = buildCleanTranscript(events);
    const hasArrow = result.some(s => s.text.includes('▼'));
    const hasPipe = result.some(s => s.text.includes('│'));
    expect(hasArrow).toBe(true);
    expect(hasPipe).toBe(true);
  });

  it('classifies tool-use segments in content blocks', () => {
    const data = '⏺ Web Search("tokyo weather")\nSunny, 25°C\n';
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data },
    ];
    const result = buildCleanTranscript(events);
    expect(result[0].type).toBe('tool-use');
    expect(result[0].text).toContain('Web Search');
    expect(result[1].type).toBe('response');
    expect(result[1].text).toContain('Sunny');
  });

  it('classifies sources segments in content blocks', () => {
    const data = [
      '⏺ Here is the information:',
      'The weather is sunny.',
      '',
      'Sources:',
      '- https://weather.com/tokyo',
      '- https://example.com/forecast',
    ].join('\n') + '\n';
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data },
    ];
    const result = buildCleanTranscript(events);
    const sourcesSeg = result.find(s => s.type === 'sources');
    expect(sourcesSeg).toBeDefined();
    expect(sourcesSeg!.text).toContain('Sources:');
    expect(sourcesSeg!.text).toContain('https://weather.com');
  });

  it('still filters TUI welcome box as noise block', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: '╭─── Claude Code v2.1.38 ──────╮\n│ Welcome back │\n╰──────────────────────────────╯\n' },
      { t: 100, type: 'o', data: 'Actual response content here\n' },
    ];
    const result = buildCleanTranscript(events);
    expect(result.some(s => s.text.includes('Welcome'))).toBe(false);
    expect(result.some(s => s.text.includes('Actual response'))).toBe(true);
  });

  it('large output bursts (≥200 bytes) are treated as content blocks', () => {
    const longResponse = 'This is a detailed response about weather patterns. '.repeat(5);
    const data = longResponse + '\n╔══════╗\n║ Data ║\n╚══════╝\n';
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data },
    ];
    const result = buildCleanTranscript(events);
    const asciiSeg = result.find(s => s.type === 'ascii-art');
    expect(asciiSeg).toBeDefined();
    expect(asciiSeg!.text).toContain('══════');
  });

  it('noise blocks still filter box-drawing separator lines', () => {
    // Small payload, no ⏺ prefix → noise block
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: '├─────┼─────┤\nActual content\n' },
    ];
    const result = buildCleanTranscript(events);
    expect(result[0].text).toBe('Actual content');
    expect(result[0].text).not.toContain('├');
  });

  it('emits response type for noise block output', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: 'Simple noise block output\n' },
    ];
    const result = buildCleanTranscript(events);
    expect(result[0].type).toBe('response');
  });

  // === Pattern-based diagram recognition ===

  it('keeps certificate chain tree as one unified ascii-art segment', () => {
    const data = [
      '⏺ Certificate Chain:',
      '  |',
      '  +-- signs --> Root CA',
      '  |',
      '  +-- signs --> Intermediate CA',
      '  |',
      '  +-- signs --> Server Certificate',
    ].join('\n') + '\n';
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data },
    ];
    const result = buildCleanTranscript(events);
    const artSegments = result.filter(s => s.type === 'ascii-art');
    expect(artSegments).toHaveLength(1);
    expect(artSegments[0].text).toContain('Root CA');
    expect(artSegments[0].text).toContain('Intermediate CA');
    expect(artSegments[0].text).toContain('Server Certificate');
  });

  it('classifies lines with arrow patterns as ascii-art', () => {
    const data = [
      '⏺ Data flow:',
      'Client --> Server',
      'Server <-- Client',
      'Input ==> Output',
    ].join('\n') + '\n';
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data },
    ];
    const result = buildCleanTranscript(events);
    const artSegments = result.filter(s => s.type === 'ascii-art');
    expect(artSegments).toHaveLength(1);
    expect(artSegments[0].text).toContain('Client --> Server');
    expect(artSegments[0].text).toContain('Server <-- Client');
  });

  it('bridges text line between two diagram lines into one ascii-art segment', () => {
    const data = [
      '⏺ Architecture:',
      '│ Top box │',
      'Label text',
      '│ Bottom box │',
    ].join('\n') + '\n';
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data },
    ];
    const result = buildCleanTranscript(events);
    const artSegments = result.filter(s => s.type === 'ascii-art');
    expect(artSegments).toHaveLength(1);
    expect(artSegments[0].text).toContain('Label text');
    expect(artSegments[0].text).toContain('Top box');
    expect(artSegments[0].text).toContain('Bottom box');
  });

  it('filters long TUI separator lines from content blocks', () => {
    const data = [
      '⏺ Key concepts:',
      '1. First concept',
      '────────────────────────────────',
      '2. Second concept',
      '────────────────────────────────',
      '3. Third concept',
    ].join('\n') + '\n';
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data },
    ];
    const result = buildCleanTranscript(events);
    const allText = result.map(s => s.text).join('\n');
    expect(allText).toContain('First concept');
    expect(allText).toContain('Second concept');
    expect(allText).toContain('Third concept');
    expect(allText).not.toContain('──────────');
  });

  it('preserves short table separators in content blocks', () => {
    const data = [
      '⏺ Table:',
      '├───┼───┤',
      '│ A │ B │',
      '├───┼───┤',
    ].join('\n') + '\n';
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data },
    ];
    const result = buildCleanTranscript(events);
    const hasSeparator = result.some(s => s.text.includes('├───┼───┤'));
    expect(hasSeparator).toBe(true);
  });

  it('filters Incubating spinner from output', () => {
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data: 'Incubating…\nActual content\n' },
    ];
    const result = buildCleanTranscript(events);
    expect(result[0].text).toBe('Actual content');
    expect(result.every(s => !s.text.includes('Incubating'))).toBe(true);
  });

  it('filters ◯ /ide indicator lines from content blocks', () => {
    const data = [
      '⏺ Some response here that is long enough.',
      '◯ /ide for Visual Studio Code',
      'More useful content after the indicator.',
    ].join('\n') + '\n';
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data },
    ];
    const result = buildCleanTranscript(events);
    const allText = result.map(s => s.text).join('\n');
    expect(allText).not.toContain('◯');
    expect(allText).not.toContain('/ide');
    expect(allText).toContain('More useful content');
  });

  it('preserves relative indentation in content blocks', () => {
    const data = [
      '⏺ Tree structure:',
      '  root',
      '    child1',
      '      grandchild',
      '    child2',
    ].join('\n') + '\n';
    const events: RecordingEvent[] = [
      { t: 0, type: 'o', data },
    ];
    const result = buildCleanTranscript(events);
    const allText = result.map(s => s.text).join('\n');
    const lines = allText.split('\n');
    const childLine = lines.find(l => l.includes('child1'));
    const grandLine = lines.find(l => l.includes('grandchild'));
    expect(childLine).toBeDefined();
    expect(grandLine).toBeDefined();
    const childIndent = childLine!.match(/^(\s*)/)?.[1].length ?? 0;
    const grandIndent = grandLine!.match(/^(\s*)/)?.[1].length ?? 0;
    expect(grandIndent).toBeGreaterThan(childIndent);
  });
});
