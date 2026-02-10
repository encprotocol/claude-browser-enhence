import type { Theme } from '@/types';
import { wcagContrast, isLightColor } from '@/lib/colorUtils';

export interface XtermThemeOptions {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  selectionForeground: string;
  selectionInactiveBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

/** Strip any embedded alpha from a hex color (e.g. #ff339933 → #ff3399) */
export function stripAlpha(hex: string): string {
  return hex.length > 7 ? hex.slice(0, 7) : hex;
}

/** Compute selection opacity suffix based on contrast with background */
function selectionOpacity(selection: string, background: string): string {
  const contrast = wcagContrast(selection, background);
  if (contrast >= 3.0) return '4d'; // 30%
  if (contrast >= 1.5) return '80'; // 50%
  return 'b3'; // 70%
}

export function buildXtermTheme(theme: Theme): XtermThemeOptions {
  const sel = stripAlpha(theme.selection);
  const alpha = selectionOpacity(sel, theme.background);
  const light = isLightColor(theme.background);
  return {
    background: theme.background,
    foreground: theme.foreground,
    cursor: theme.cursor,
    cursorAccent: theme.background,
    selectionBackground: sel + alpha,
    selectionForeground: light ? '#ffffff' : '#000000',
    selectionInactiveBackground: sel + alpha,
    black: theme.black,
    red: theme.red,
    green: theme.green,
    yellow: theme.yellow,
    blue: theme.blue,
    magenta: theme.magenta,
    cyan: theme.cyan,
    white: theme.white,
    brightBlack: theme.brightBlack || '#6b7280',
    brightRed: theme.red,
    brightGreen: theme.green,
    brightYellow: theme.yellow,
    brightBlue: theme.blue,
    brightMagenta: theme.magenta,
    brightCyan: theme.cyan,
    brightWhite: theme.white,
  };
}
