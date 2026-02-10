import { describe, it, expect } from 'vitest';
import { wrapLinesHtml } from '@/lib/lineNumbers';

describe('wrapLinesHtml', () => {
  it('wraps each line in a code-line span joined without newlines', () => {
    const html = 'line1\nline2\nline3';
    const result = wrapLinesHtml(html);
    expect(result).toBe(
      '<span class="code-line">line1</span>' +
      '<span class="code-line">line2</span>' +
      '<span class="code-line">line3</span>'
    );
  });

  it('preserves HTML tags within lines', () => {
    const html = '<span class="hljs-keyword">const</span> x = 1;\n<span class="hljs-keyword">let</span> y = 2;';
    const result = wrapLinesHtml(html);
    expect(result).toContain('<span class="code-line"><span class="hljs-keyword">const</span> x = 1;</span>');
    expect(result).toContain('<span class="code-line"><span class="hljs-keyword">let</span> y = 2;</span>');
  });

  it('handles single line', () => {
    expect(wrapLinesHtml('hello')).toBe('<span class="code-line">hello</span>');
  });

  it('handles empty string', () => {
    expect(wrapLinesHtml('')).toBe('<span class="code-line"></span>');
  });

  it('handles trailing newline as empty final line', () => {
    const result = wrapLinesHtml('a\nb\n');
    expect(result).toBe(
      '<span class="code-line">a</span>' +
      '<span class="code-line">b</span>' +
      '<span class="code-line"></span>'
    );
  });

  it('closes and reopens multi-line spans at line boundaries', () => {
    // highlight.js produces: <span class="hljs-code">`line1\nline2\nline3`</span>
    const html = '<span class="hljs-code">`line1\nline2\nline3`</span>';
    const result = wrapLinesHtml(html);
    expect(result).toBe(
      '<span class="code-line"><span class="hljs-code">`line1</span></span>' +
      '<span class="code-line"><span class="hljs-code">line2</span></span>' +
      '<span class="code-line"><span class="hljs-code">line3`</span></span>'
    );
  });

  it('handles nested multi-line spans', () => {
    // Outer span wraps 3 lines, inner span is on line 2 only
    const html = '<span class="a">L1\n<span class="b">L2</span>\nL3</span>';
    const result = wrapLinesHtml(html);
    expect(result).toBe(
      '<span class="code-line"><span class="a">L1</span></span>' +
      '<span class="code-line"><span class="a"><span class="b">L2</span></span></span>' +
      '<span class="code-line"><span class="a">L3</span></span>'
    );
  });

  it('handles span that opens and closes on same line with multi-line parent', () => {
    const html = '<span class="a">start\n<span class="b">inner</span>\nend</span>';
    const result = wrapLinesHtml(html);
    expect(result).toBe(
      '<span class="code-line"><span class="a">start</span></span>' +
      '<span class="code-line"><span class="a"><span class="b">inner</span></span></span>' +
      '<span class="code-line"><span class="a">end</span></span>'
    );
  });
});
