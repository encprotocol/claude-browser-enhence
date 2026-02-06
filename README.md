# Synesthesia Web Terminal

A browser-based terminal emulator with automatic syntax highlighting for terminal output. Built with xterm.js, WebSockets, and node-pty.

## Features

- **Auto-detecting keyword colorization** - Automatically highlights patterns in terminal output:
  - Status words (success/error/warning/info)
  - URLs (clickable, blue underlined)
  - File paths, IP addresses, email addresses
  - Percentages, file sizes, durations
  - Git hashes, environment variables, CLI flags
  - Timestamps, function calls, backtick-wrapped code
- **Multiple shell sessions** - Tabbed interface to manage multiple concurrent shells
- **Session persistence** - Sessions survive browser reconnects (1-hour timeout)
- **File browser** - VS Code-style sidebar (`Cmd+B`) with directory tree, file preview, and live file watching:
  - **Syntax highlighting** - Code files are highlighted using highlight.js with colors that adapt to the active theme
  - **Image preview** - PNG, JPG, GIF, SVG, WebP, ICO, and BMP files display inline
  - **PDF preview** - PDF files render in an embedded viewer
  - **Live updates** - Previewed files auto-refresh when modified on disk
  - **Resizable panel** - Drag the left edge to resize (up to 85% of viewport)
  - **Persistent state** - Toggling the sidebar preserves the open preview and file watcher
- **English correction** - Toggle correction mode (`Cmd+X`) to type in a dedicated panel, check grammar/spelling via Claude AI (Haiku), review word-level diffs, then accept or edit before sending to the terminal
- **Theme support** - 18 built-in themes (Synesthesia, Dracula, Tokyo Night, Catppuccin, Nord, Gruvbox, Monokai, and more) plus full color customization via settings panel
- **Clickable links** - URLs in terminal output are clickable and open in a new tab
- **Image paste & preview** - Paste images from clipboard into the terminal; pasted images are cached and displayed as `[Image #N]` markers. Hover to preview, click to open full-size viewer
- **Terminal resize** - Automatic terminal resizing to fit the browser window
- **Font settings** - Adjustable font size and line height via settings panel

## Tech Stack

- **Frontend**: xterm.js, vanilla JS/CSS
- **Backend**: Node.js, Express, WebSocket (ws), node-pty
- **Testing**: Jest

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm

### Install & Run

```bash
npm install
npm start
```

Open `http://localhost:3000` in your browser.

### Run Tests

```bash
npm test
```

## Project Structure

```
├── server.js              # Express + WebSocket server, PTY session management, file API
├── public/
│   ├── index.html         # Terminal UI (xterm.js, tabs, themes, correction panel)
│   ├── highlighter.js     # Auto-detecting keyword colorizer (ANSI patterns)
│   ├── diff.js            # Word-level diff (LCS) for correction display
│   └── filebrowser.js     # File browser sidebar (directory tree, viewer, image/PDF preview)
├── __tests__/
│   ├── highlighter.test.js
│   ├── diff.test.js
│   ├── server.test.js
│   └── integration.test.js
└── package.json
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+B` | Toggle file browser sidebar |
| `Cmd+X` | Toggle English correction mode |
| `Shift+Enter` | Send newline without executing |
| `Ctrl+Shift+T` | New tab |
| `Ctrl+Shift+W` | Close current tab |
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |

### In Correction Panel

| Shortcut | Action |
|----------|--------|
| `Enter` | Check & correct text (input) / Accept correction (result) |
| `Shift+Enter` | Newline in text input |
| `Esc` | Clear text (input) / Go back to edit (result) |
