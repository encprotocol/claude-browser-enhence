import { useState } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import { useCorrectionStore } from '@/stores/correctionStore';
import { presetThemes, defaultTheme } from '@/lib/themes';
import type { Theme, CorrectionMode } from '@/types';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const themeDisplayNames: Record<string, string> = {
  synesthesia: 'Synesthesia',
  dracula: 'Dracula',
  tokyoNight: 'Tokyo Night',
  catppuccin: 'Catppuccin',
  rosePine: 'Rosé Pine',
  synthwave: "Synthwave '84",
  cyberpunk: 'Cyberpunk',
  nord: 'Nord',
  gruvbox: 'Gruvbox',
  ayuDark: 'Ayu Dark',
  oneDark: 'One Dark',
  monokai: 'Monokai',
  tinaciousDesign: 'Tinacious Design',
  catppuccinFrappe: 'Catppuccin Frappé',
  catppuccinMacchiato: 'Catppuccin Macchiato',
  everforestDark: 'Everforest Dark',
  palenight: 'Palenight',
  kanagawa: 'Kanagawa',
  rosePineMoon: 'Rosé Pine Moon',
  everforestLight: 'Everforest Light',
  ayuLight: 'Ayu Light',
  oneLight: 'One Light',
  github: 'GitHub',
  solarizedLight: 'Solarized Light',
  catppuccinLatte: 'Catppuccin Latte',
  rosePineDawn: 'Rosé Pine Dawn',
  tinaciousDesignLight: 'Tinacious Design Light',
};

const darkThemes = [
  'synesthesia', 'dracula', 'tokyoNight', 'catppuccin', 'rosePine',
  'synthwave', 'cyberpunk', 'nord', 'gruvbox', 'ayuDark', 'oneDark',
  'monokai', 'tinaciousDesign',
];

const softThemes = [
  'catppuccinFrappe', 'catppuccinMacchiato', 'everforestDark', 'palenight',
  'kanagawa', 'rosePineMoon', 'everforestLight',
];

const lightThemes = [
  'github', 'oneLight', 'ayuLight', 'solarizedLight', 'catppuccinLatte',
  'rosePineDawn', 'tinaciousDesignLight',
];

type ColorKey = keyof Theme;

const terminalColors: { label: string; key: ColorKey }[] = [
  { label: 'Background', key: 'background' },
  { label: 'Foreground', key: 'foreground' },
  { label: 'Cursor', key: 'cursor' },
  { label: 'Selection', key: 'selection' },
];

const ansiColors: { label: string; key: ColorKey }[] = [
  { label: 'Black', key: 'black' },
  { label: 'Red', key: 'red' },
  { label: 'Green', key: 'green' },
  { label: 'Yellow', key: 'yellow' },
  { label: 'Blue', key: 'blue' },
  { label: 'Magenta', key: 'magenta' },
  { label: 'Cyan', key: 'cyan' },
  { label: 'White', key: 'white' },
];

const uiColors: { label: string; key: ColorKey }[] = [
  { label: 'Header', key: 'header' },
  { label: 'Tab Bar', key: 'tabbar' },
  { label: 'Active Tab', key: 'activeTab' },
  { label: 'Accent', key: 'accent' },
  { label: 'Muted Text', key: 'brightBlack' },
];

const syntaxColors: { label: string; key: ColorKey }[] = [
  { label: 'Keywords', key: 'keyword' },
  { label: 'Strings', key: 'string' },
  { label: 'Numbers', key: 'number' },
  { label: 'Commands', key: 'command' },
];

function isActiveTheme(current: Theme, presetKey: string): boolean {
  const preset = presetThemes[presetKey];
  if (!preset) return false;
  return preset.background === current.background && preset.foreground === current.foreground && preset.cursor === current.cursor;
}

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const theme = useThemeStore((s) => s.theme);
  const fontSettings = useThemeStore((s) => s.fontSettings);
  const applyTheme = useThemeStore((s) => s.applyTheme);
  const setFontSettings = useThemeStore((s) => s.setFontSettings);
  const correctionMode = useCorrectionStore((s) => s.mode);
  const setCorrectionMode = useCorrectionStore((s) => s.setMode);
  const [activeTab, setActiveTab] = useState<'theme' | 'grammar'>('theme');

  if (!open) return null;

  const handlePreset = (key: string) => {
    applyTheme(presetThemes[key]);
  };

  const handleColorChange = (key: ColorKey, value: string) => {
    applyTheme({ ...theme, [key]: value });
  };

  const handleReset = () => {
    applyTheme(defaultTheme);
    setFontSettings({ fontSize: 14, lineHeight: 1.2 });
  };

  const renderPresetSection = (title: string, keys: string[]) => (
    <div className="settings-section">
      <h3>{title}</h3>
      <div className="preset-themes">
        {keys.map((key) => (
          <button
            key={key}
            className={`preset-btn${isActiveTheme(theme, key) ? ' active' : ''}`}
            onClick={() => handlePreset(key)}
          >
            {themeDisplayNames[key] || key}
          </button>
        ))}
      </div>
    </div>
  );

  const renderColorSection = (title: string, colors: { label: string; key: ColorKey }[]) => (
    <div className="settings-section">
      <h3>{title}</h3>
      <div className="color-grid">
        {colors.map(({ label, key }) => (
          <div className="color-item" key={key}>
            <label>{label}</label>
            <input
              type="color"
              className="color-picker"
              value={theme[key]}
              onChange={(e) => handleColorChange(key, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="settings-modal visible" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="settings-panel">
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose}>×</button>
        </div>

        <div className="settings-tabs">
          <button
            className={`settings-tab${activeTab === 'theme' ? ' active' : ''}`}
            onClick={() => setActiveTab('theme')}
          >Theme</button>
          <button
            className={`settings-tab${activeTab === 'grammar' ? ' active' : ''}`}
            onClick={() => setActiveTab('grammar')}
          >Grammar</button>
        </div>

        {activeTab === 'theme' && (
          <>
            {renderPresetSection('Dark Themes', darkThemes)}
            {renderPresetSection('Soft Themes', softThemes)}
            {renderPresetSection('Light Themes', lightThemes)}

            {renderColorSection('Terminal Colors', terminalColors)}
            {renderColorSection('ANSI Colors', ansiColors)}
            {renderColorSection('UI Colors', uiColors)}
            {renderColorSection('Syntax Highlighting', syntaxColors)}

            <div className="settings-section">
              <h3>Font Settings</h3>
              <div className="setting-row">
                <label>Font Size</label>
                <input
                  type="range"
                  min={10}
                  max={24}
                  value={fontSettings.fontSize}
                  onChange={(e) => setFontSettings({ ...fontSettings, fontSize: Number(e.target.value) })}
                />
                <span className="value-display">{fontSettings.fontSize}px</span>
              </div>
              <div className="setting-row">
                <label>Line Height</label>
                <input
                  type="range"
                  min={1.0}
                  max={2.0}
                  step={0.1}
                  value={fontSettings.lineHeight}
                  onChange={(e) => setFontSettings({ ...fontSettings, lineHeight: Number(e.target.value) })}
                />
                <span className="value-display">{fontSettings.lineHeight}</span>
              </div>
            </div>

            <div className="settings-actions">
              <button className="btn btn-secondary" onClick={handleReset}>Reset to Default</button>
            </div>
          </>
        )}

        {activeTab === 'grammar' && (
          <>
            <div className="settings-section">
              <h3>Correction Mode</h3>
              <div className="grammar-mode-group">
                <button
                  className={`grammar-mode-option${correctionMode === 'grammar' ? ' active' : ''}`}
                  onClick={() => setCorrectionMode('grammar')}
                >
                  <div className="grammar-mode-title">Grammar</div>
                  <div className="grammar-mode-desc">Fix spelling and grammar errors only</div>
                </button>
                <button
                  className={`grammar-mode-option${correctionMode === 'polish' ? ' active' : ''}`}
                  onClick={() => setCorrectionMode('polish')}
                >
                  <div className="grammar-mode-title">Polish</div>
                  <div className="grammar-mode-desc">Improve expression while preserving meaning</div>
                </button>
              </div>
            </div>

            <div className="settings-section">
              <h3>Shortcut</h3>
              <p style={{ color: 'var(--theme-muted)', fontSize: '13px' }}>
                Press <kbd style={{ background: 'var(--theme-button-bg)', border: '1px solid var(--theme-button-border)', borderRadius: '4px', padding: '2px 6px', fontSize: '12px' }}>⌘X</kbd> to open the correction panel
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
