import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Theme } from '@/types';
import { presetThemes, defaultTheme } from '@/lib/themes';
import { isLightColor, darken, lighten, ensureContrast } from '@/lib/colorUtils';
import { setColors as setHighlighterColors } from '@/lib/highlighter';

interface FontSettings {
  fontSize: number;
  lineHeight: number;
}

interface ThemeState {
  theme: Theme;
  fontSettings: FontSettings;
  setTheme: (theme: Theme) => void;
  setFontSettings: (settings: FontSettings) => void;
  applyTheme: (theme: Theme) => void;
}

function applyThemeToDOM(theme: Theme) {
  const isLight = isLightColor(theme.background);
  const buttonBg = isLight ? darken(theme.background, 0.08) : lighten(theme.background, 0.15);
  const buttonBorder = isLight ? darken(theme.background, 0.15) : lighten(theme.background, 0.25);
  const mutedBase = theme.brightBlack || (isLight ? '#6b7280' : '#94a3b8');
  let mutedText = mutedBase;
  [buttonBg, theme.tabbar || theme.background, theme.header || theme.background].forEach((bg) => {
    mutedText = ensureContrast(mutedText, bg, theme.foreground, 3.0);
  });

  const root = document.documentElement;
  root.style.setProperty('--theme-bg', theme.background);
  root.style.setProperty('--theme-fg', theme.foreground);
  root.style.setProperty('--theme-header', theme.header || theme.background);
  root.style.setProperty('--theme-tabbar', theme.tabbar || theme.background);
  root.style.setProperty('--theme-active-tab', theme.activeTab || theme.background);
  root.style.setProperty('--theme-accent', theme.accent || theme.cursor);
  root.style.setProperty('--theme-button-bg', buttonBg);
  root.style.setProperty('--theme-button-border', buttonBorder);
  root.style.setProperty('--theme-button-text', isLight ? darken(theme.foreground, 0.2) : theme.foreground);
  root.style.setProperty('--theme-muted', mutedText);

  // Syntax highlighting vars
  root.style.setProperty('--theme-hljs-keyword', theme.magenta || '#c678dd');
  root.style.setProperty('--theme-hljs-string', theme.green || '#98c379');
  root.style.setProperty('--theme-hljs-number', theme.yellow || '#d19a66');
  root.style.setProperty('--theme-hljs-function', theme.blue || '#61afef');
  root.style.setProperty('--theme-hljs-type', theme.yellow || '#e5c07b');
  root.style.setProperty('--theme-hljs-meta', theme.red || '#e06c75');

  document.body.style.background = theme.background;

  // Update highlighter colors
  setHighlighterColors({
    keyword: theme.keyword,
    string: theme.string,
    number: theme.number,
    command: theme.command,
  });
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: defaultTheme,
      fontSettings: { fontSize: 14, lineHeight: 1.2 },

      setTheme: (theme) => {
        set({ theme });
        applyThemeToDOM(theme);
      },

      setFontSettings: (fontSettings) => set({ fontSettings }),

      applyTheme: (theme) => {
        set({ theme });
        applyThemeToDOM(theme);
      },
    }),
    {
      name: 'synesthesia-theme-store',
      partialize: (state) => ({ theme: state.theme, fontSettings: state.fontSettings }),
      onRehydrate: (_state, _options) => {
        return (state) => {
          if (state?.theme) {
            applyThemeToDOM(state.theme);
          }
        };
      },
    },
  ),
);
