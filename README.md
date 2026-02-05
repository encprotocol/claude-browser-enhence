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
- **English correction** - Select text and correct grammar/spelling using Claude AI (Haiku), with word-level diff display
- **Theme support** - Multiple built-in themes (Midnight, Monokai, Solarized Dark, Nord, Dracula, Tokyo Night, Gruvbox)
- **Clickable links** - URLs in terminal output are clickable and open in a new tab
- **Image preview** - Image file paths display inline previews on hover
- **Terminal resize** - Automatic terminal resizing to fit the browser window

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
├── server.js              # Express + WebSocket server, PTY session management
├── public/
│   ├── index.html         # Terminal UI (xterm.js, tabs, themes, correction panel)
│   ├── highlighter.js     # Auto-detecting keyword colorizer (ANSI patterns)
│   └── diff.js            # Word-level diff (LCS) for correction display
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
| `Shift+Enter` | Send newline without executing |
| Text selection + correction toggle | Correct selected English text via AI |
