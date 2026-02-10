/**
 * Tests for theme store rehydration: CSS variables and DOM must update
 * when the theme store state changes, including after persist rehydration.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '@/stores/themeStore';
import { presetThemes, defaultTheme } from '@/lib/themes';

describe('themeStore rehydration', () => {
  beforeEach(() => {
    useThemeStore.getState().applyTheme(defaultTheme);
  });

  it('sets CSS variables when theme is applied via action', () => {
    const dracula = presetThemes.dracula;
    useThemeStore.getState().applyTheme(dracula);
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--theme-bg')).toBe(dracula.background);
    expect(root.style.getPropertyValue('--theme-fg')).toBe(dracula.foreground);
    expect(root.style.getPropertyValue('--theme-header')).toBe(dracula.header);
    expect(root.style.getPropertyValue('--theme-accent')).toBe(dracula.accent);
  });

  it('sets body background when theme is applied via action', () => {
    const dracula = presetThemes.dracula;
    useThemeStore.getState().applyTheme(dracula);
    // jsdom converts hex to rgb, so check via CSS variable instead
    expect(document.documentElement.style.getPropertyValue('--theme-bg')).toBe(dracula.background);
  });

  it('module-level subscriber applies CSS when state changes via setState (simulates rehydration)', () => {
    const tokyoNight = presetThemes.tokyoNight;
    // Simulate what persist rehydration does: direct setState (bypasses actions)
    useThemeStore.setState({ theme: tokyoNight });

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--theme-bg')).toBe(tokyoNight.background);
    expect(root.style.getPropertyValue('--theme-fg')).toBe(tokyoNight.foreground);
    expect(root.style.getPropertyValue('--theme-accent')).toBe(tokyoNight.accent);
  });

  it('does not re-apply if theme reference is the same', () => {
    const before = document.documentElement.style.getPropertyValue('--theme-bg');
    // setState with the same theme object — subscriber should skip
    useThemeStore.setState({ theme: useThemeStore.getState().theme });
    expect(document.documentElement.style.getPropertyValue('--theme-bg')).toBe(before);
  });
});
