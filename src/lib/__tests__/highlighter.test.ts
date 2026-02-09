import { describe, it, expect } from 'vitest';
import { highlight, hexToAnsi } from '@/lib/highlighter';

describe('highlight', () => {
  it('skips already-colorized text', () => {
    const colored = '\x1b[32mhello\x1b[0m';
    expect(highlight(colored)).toBe(colored);
  });

  it('highlights error keywords in red', () => {
    const result = highlight('error occurred');
    expect(result).toContain('\x1b[31m');
    expect(result).toContain('error');
  });

  it('highlights success keywords in green', () => {
    const result = highlight('task succeeded');
    expect(result).toContain('\x1b[32m');
  });

  it('highlights warning keywords in yellow', () => {
    const result = highlight('warning: deprecated');
    expect(result).toContain('\x1b[33m');
  });

  it('highlights info keywords in cyan', () => {
    const result = highlight('info: loading');
    expect(result).toContain('\x1b[36m');
  });

  it('highlights URLs with blue underline', () => {
    const result = highlight('visit https://example.com');
    expect(result).toContain('\x1b[34;4m');
  });

  it('highlights percentages in yellow', () => {
    const result = highlight('progress: 85%');
    expect(result).toContain('\x1b[33m');
    expect(result).toContain('85%');
  });

  it('highlights file sizes', () => {
    const result = highlight('downloaded 10 MB');
    expect(result).toContain('\x1b[33m');
  });

  it('preserves plain text without patterns', () => {
    const plain = 'just some regular text';
    expect(highlight(plain)).toBe(plain);
  });

  it('does not overlap matches', () => {
    const result = highlight('error at https://example.com/error');
    // Both error and URL should be highlighted, no corrupted output
    expect(result).toContain('\x1b[0m');
  });
});

describe('hexToAnsi', () => {
  it('converts white', () => {
    expect(hexToAnsi('#ffffff')).toBe('\x1b[38;2;255;255;255m');
  });

  it('converts black', () => {
    expect(hexToAnsi('#000000')).toBe('\x1b[38;2;0;0;0m');
  });

  it('converts a color', () => {
    expect(hexToAnsi('#ff5555')).toBe('\x1b[38;2;255;85;85m');
  });
});
