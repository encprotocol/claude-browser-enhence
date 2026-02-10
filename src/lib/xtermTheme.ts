import type { Theme } from '@/types';

export interface XtermThemeOptions {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selection: string;
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

export function buildXtermTheme(theme: Theme): XtermThemeOptions {
  return {
    background: theme.background,
    foreground: theme.foreground,
    cursor: theme.cursor,
    cursorAccent: theme.background,
    selection: theme.selection + '4d',
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
