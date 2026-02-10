import { describe, it, expect } from 'vitest';
import { buildXtermTheme } from '@/lib/xtermTheme';
import { stripAlpha } from '@/lib/xtermTheme';
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
  it('maps theme colors to xterm ITheme with selectionBackground', () => {
    const xt = buildXtermTheme(testTheme);
    expect(xt.background).toBe('#1a1a2e');
    expect(xt.foreground).toBe('#e2e8f0');
    expect(xt.cursor).toBe('#e94560');
    expect(xt.cursorAccent).toBe('#1a1a2e');
    expect(xt.selectionBackground).toBe('#33415580');
    expect(xt.red).toBe('#ef4444');
    expect(xt.brightRed).toBe('#ef4444');
    expect(xt.brightBlack).toBe('#6b7280');
  });

  it('falls back to default brightBlack when missing', () => {
    const noBright = { ...testTheme, brightBlack: '' };
    const xt = buildXtermTheme(noBright);
    expect(xt.brightBlack).toBe('#6b7280');
  });

  it('applies 30% opacity for high-contrast selection', () => {
    const theme = { ...testTheme, background: '#1a1a2e', selection: '#e94560' };
    const xt = buildXtermTheme(theme);
    expect(xt.selectionBackground).toBe('#e945604d');
  });

  it('applies higher opacity for low-contrast selection', () => {
    const theme = { ...testTheme, background: '#fafafa', selection: '#e5e5e6' };
    const xt = buildXtermTheme(theme);
    expect(xt.selectionBackground).toBe('#e5e5e6b3');
  });

  it('applies medium opacity for medium-contrast selection', () => {
    const theme = { ...testTheme, background: '#eff1f5', selection: '#acb0be' };
    const xt = buildXtermTheme(theme);
    expect(xt.selectionBackground).toBe('#acb0be80');
  });

  it('strips pre-existing alpha from selection color', () => {
    const theme = { ...testTheme, background: '#1D1D26', selection: '#ff339933' };
    const xt = buildXtermTheme(theme);
    expect(xt.selectionBackground).toBe('#ff33994d');
  });

  it('sets selectionForeground to white for light themes', () => {
    const theme = { ...testTheme, background: '#fafafa', selection: '#4078f2' };
    const xt = buildXtermTheme(theme);
    expect(xt.selectionForeground).toBe('#ffffff');
  });

  it('sets selectionForeground to black for dark themes', () => {
    const xt = buildXtermTheme(testTheme);
    expect(xt.selectionForeground).toBe('#000000');
  });

  it('sets selectionInactiveBackground same as selectionBackground', () => {
    const xt = buildXtermTheme(testTheme);
    expect(xt.selectionInactiveBackground).toBe(xt.selectionBackground);
  });
});

describe('stripAlpha', () => {
  it('returns 7-char hex unchanged', () => {
    expect(stripAlpha('#ff3399')).toBe('#ff3399');
  });

  it('strips 8-char hex to 7 chars', () => {
    expect(stripAlpha('#ff339933')).toBe('#ff3399');
  });

  it('strips 9-char hex to 7 chars', () => {
    expect(stripAlpha('#ff33994d')).toBe('#ff3399');
  });
});
