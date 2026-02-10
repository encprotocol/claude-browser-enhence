/**
 * Layout contract tests — verify that CSS selectors align with the JSX
 * class names so the flex layout chain is unbroken from body to terminal.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

// --- Mocks -----------------------------------------------------------
// Replace XTermRenderer with a stub that renders just the #terminal div
// (avoids needing to mock all of xterm.js internals)
vi.mock('@/components/Terminal/XTermRenderer', () => ({
  default: () => <div id="terminal" />,
}));

// --- Helpers ---------------------------------------------------------
const cssPath = path.resolve(__dirname, '../../styles/index.css');
const cssSource = fs.readFileSync(cssPath, 'utf-8');

// --- Tests -----------------------------------------------------------
describe('DOM hierarchy', () => {
  it('renders .main-content > .terminal-container > #terminal', async () => {
    // Dynamic import so mocks are in place
    const { default: App } = await import('@/App');
    const { container } = render(<App />);

    const mainContent = container.querySelector('.main-content');
    expect(mainContent).not.toBeNull();

    const termContainer = mainContent!.querySelector('.terminal-container');
    expect(termContainer).not.toBeNull();

    const termDiv = termContainer!.querySelector('#terminal');
    expect(termDiv).not.toBeNull();
  });
});

describe('CSS selector alignment', () => {
  it('uses .terminal-container (not #terminal-container)', () => {
    // The CSS should target the class, not the ID
    expect(cssSource).toContain('.terminal-container');
    expect(cssSource).not.toMatch(/#terminal-container\s*\{/);
  });

  it('uses .main-content (not #main-area)', () => {
    expect(cssSource).toContain('.main-content');
    expect(cssSource).not.toMatch(/#main-area\s*\{/);
  });

  it('has display rules for #root and #app wrappers', () => {
    // React's mount point (#root) and our wrapper (#app) need styling
    // to avoid breaking the flex chain from body
    expect(cssSource).toMatch(/#root/);
    expect(cssSource).toMatch(/#app/);
  });
});
