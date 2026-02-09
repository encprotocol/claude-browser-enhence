import { describe, it, expect } from 'vitest';
import { computeWordDiff, formatDiff } from '@/lib/diff';

describe('computeWordDiff', () => {
  it('returns same for identical text', () => {
    const result = computeWordDiff('hello world', 'hello world');
    expect(result.every((p) => p.type === 'same')).toBe(true);
    expect(result.map((p) => p.text).join('')).toBe('hello world');
  });

  it('detects word replacement', () => {
    const result = computeWordDiff('I go store', 'I went store');
    const types = result.filter((p) => p.type !== 'same').map((p) => p.type);
    expect(types).toContain('removed');
    expect(types).toContain('added');
  });

  it('detects additions', () => {
    const result = computeWordDiff('I go store', 'I go to the store');
    const added = result.filter((p) => p.type === 'added').map((p) => p.text.trim());
    expect(added).toContain('to');
    expect(added).toContain('the');
  });

  it('detects deletions', () => {
    const result = computeWordDiff('I really go to store', 'I go to store');
    const removed = result.filter((p) => p.type === 'removed').map((p) => p.text.trim());
    expect(removed).toContain('really');
  });

  it('handles empty strings', () => {
    // ''.split(/(\s+)/) returns [''] so we get one 'same' part with empty text
    const both = computeWordDiff('', '');
    expect(both).toHaveLength(1);
    expect(both[0].text).toBe('');
    const fromEmpty = computeWordDiff('', 'hello');
    expect(fromEmpty.some((p) => p.type === 'added')).toBe(true);
  });

  it('preserves whitespace', () => {
    const result = computeWordDiff('a  b', 'a  b');
    expect(result.map((p) => p.text).join('')).toBe('a  b');
  });
});

describe('formatDiff', () => {
  it('formats same text as-is', () => {
    expect(formatDiff([{ type: 'same', text: 'hello' }])).toBe('hello');
  });

  it('formats removed with red strikethrough ANSI', () => {
    const result = formatDiff([{ type: 'removed', text: 'old' }]);
    expect(result).toContain('\x1b[9;31m');
    expect(result).toContain('old');
    expect(result).toContain('\x1b[0m');
  });

  it('formats added with green bold ANSI', () => {
    const result = formatDiff([{ type: 'added', text: 'new' }]);
    expect(result).toContain('\x1b[1;32m');
    expect(result).toContain('new');
    expect(result).toContain('\x1b[0m');
  });

  it('handles mixed diff', () => {
    const result = formatDiff([
      { type: 'same', text: 'hello ' },
      { type: 'removed', text: 'world' },
      { type: 'added', text: 'earth' },
    ]);
    expect(result).toContain('hello ');
    expect(result).toContain('\x1b[9;31mworld\x1b[0m');
    expect(result).toContain('\x1b[1;32mearth\x1b[0m');
  });

  it('returns empty string for empty diff', () => {
    expect(formatDiff([])).toBe('');
  });
});
