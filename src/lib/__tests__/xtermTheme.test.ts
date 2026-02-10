import { describe, it, expect } from 'vitest';
import { buildXtermTheme } from '@/lib/xtermTheme';
import type { Theme } from '@/types';

const testTheme: Theme = {
  background: '#1a1a2e',
  foreground: '#e2e8f0',
  cursor: '#e94560',
  selection: '#334155',
  black: '#000000',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#eab308',
  blue: '#3b82f6',
  magenta: '#a855f7',
  cyan: '#06b6d4',
  white: '#f8fafc',
  brightBlack: '#6b7280',
  header: '#16213e',
  tabbar: '#0f1729',
  activeTab: '#1a1a2e',
  accent: '#e94560',
  keyword: '#c678dd',
  string: '#98c379',
  number: '#d19a66',
  command: '#61afef',
};

describe('buildXtermTheme', () => {
  it('maps theme colors to xterm ITheme', () => {
    const xt = buildXtermTheme(testTheme);
    expect(xt.background).toBe('#1a1a2e');
    expect(xt.foreground).toBe('#e2e8f0');
    expect(xt.cursor).toBe('#e94560');
    expect(xt.cursorAccent).toBe('#1a1a2e');
    expect(xt.selection).toBe('#3341554d');
    expect(xt.red).toBe('#ef4444');
    expect(xt.brightRed).toBe('#ef4444');
    expect(xt.brightBlack).toBe('#6b7280');
  });

  it('falls back to default brightBlack when missing', () => {
    const noBright = { ...testTheme, brightBlack: '' };
    const xt = buildXtermTheme(noBright);
    expect(xt.brightBlack).toBe('#6b7280');
  });
});
