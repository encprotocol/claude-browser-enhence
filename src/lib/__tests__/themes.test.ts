import { describe, it, expect } from 'vitest';
import { presetThemes, defaultTheme } from '@/lib/themes';

describe('presetThemes', () => {
  it('has 27 themes', () => {
    expect(Object.keys(presetThemes)).toHaveLength(27);
  });

  it('every theme has all required color keys', () => {
    const requiredKeys = [
      'background', 'foreground', 'cursor', 'selection',
      'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
      'brightBlack', 'header', 'tabbar', 'activeTab', 'accent',
      'keyword', 'string', 'number', 'command',
    ];
    for (const [name, theme] of Object.entries(presetThemes)) {
      for (const key of requiredKeys) {
        expect(theme).toHaveProperty(key);
        expect((theme as Record<string, string>)[key]).toMatch(/^#[0-9a-fA-F]{6,8}$/);
      }
    }
  });

  it('default theme is synesthesia', () => {
    expect(defaultTheme).toEqual(presetThemes.synesthesia);
  });

  it('includes dark themes', () => {
    expect(presetThemes).toHaveProperty('dracula');
    expect(presetThemes).toHaveProperty('tokyoNight');
    expect(presetThemes).toHaveProperty('catppuccin');
    expect(presetThemes).toHaveProperty('nord');
  });

  it('includes light themes', () => {
    expect(presetThemes).toHaveProperty('github');
    expect(presetThemes).toHaveProperty('oneLight');
    expect(presetThemes).toHaveProperty('solarizedLight');
  });
});
