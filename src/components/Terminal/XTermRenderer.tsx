import { useRef, useEffect } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { setTerminalInstance, getTerminalInstance } from '@/terminal/terminalInstance';
import { useConnectionStore } from '@/stores/connectionStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useThemeStore } from '@/stores/themeStore';
import { useCorrectionStore } from '@/stores/correctionStore';
import { useFileBrowserStore } from '@/stores/fileBrowserStore';
import { useUIStore } from '@/stores/uiStore';

export default function XTermRenderer() {
  const termRef = useRef<HTMLDivElement>(null);
  const termInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Initialize terminal once
  useEffect(() => {
    if (!termRef.current || termInstanceRef.current) return;

    const theme = useThemeStore.getState().theme;
    const fontSettings = useThemeStore.getState().fontSettings;

    const term = new Terminal({
      theme: {
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
      },
      fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, Monaco, monospace',
      fontSize: fontSettings.fontSize,
      lineHeight: fontSettings.lineHeight,
      cursorBlink: true,
      cursorStyle: 'bar',
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(webLinksAddon);

    term.open(termRef.current);
    fitAddon.fit();

    termInstanceRef.current = term;
    fitAddonRef.current = fitAddon;
    setTerminalInstance(term);

    // Re-fit after web fonts load
    document.fonts.ready.then(() => {
      fitAddon.fit();
      sendResize();
    });

    // Handle terminal input
    term.onData((data) => {
      const { ws } = useConnectionStore.getState();
      const activeSessionId = useSessionStore.getState().activeSessionId;
      if (!ws || ws.readyState !== WebSocket.OPEN || !activeSessionId) return;

      const { enabled, panelVisible } = useCorrectionStore.getState();
      if (enabled && panelVisible) return;

      useConnectionStore.getState().sendMessage('input', { sessionId: activeSessionId, data });

      if (data.indexOf('\r') !== -1) {
        // CWD might have changed after Enter
        const fb = useFileBrowserStore.getState();
        if (fb.visible && fb.linked) {
          setTimeout(() => {
            useConnectionStore.getState().sendMessage('get-cwd', {
              sessionId: useSessionStore.getState().activeSessionId,
            });
          }, 500);
        }
      }
    });

    // Shift+Enter handler
    term.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown' && e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        const corrState = useCorrectionStore.getState();
        if (corrState.enabled && !corrState.pendingCorrection && !corrState.waitingForCorrection) {
          useCorrectionStore.getState().setInputBuffer(corrState.inputBuffer + '\n');
        }
        const activeSessionId = useSessionStore.getState().activeSessionId;
        if (activeSessionId) {
          useConnectionStore.getState().sendMessage('input', { sessionId: activeSessionId, data: '\n' });
        }
        return false;
      }

      // Capture paste for image cache
      if (e.type === 'keydown' && (e.metaKey || e.ctrlKey) && e.key === 'v') {
        navigator.clipboard.read().then((items) => {
          for (const item of items) {
            for (const type of item.types) {
              if (type.startsWith('image/')) {
                item.getType(type).then((blob) => {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    if (event.target?.result) {
                      useUIStore.getState().addImageToCache(event.target.result as string);
                    }
                  };
                  reader.readAsDataURL(blob);
                });
              }
            }
          }
        }).catch(() => {});
      }

      return true;
    });

    // [Image #X] link provider
    term.registerLinkProvider({
      provideLinks: (bufferLineNumber, callback) => {
        const line = term.buffer.active.getLine(bufferLineNumber - 1);
        if (!line) { callback(undefined); return; }
        const text = line.translateToString();
        const links: Array<{
          range: { start: { x: number; y: number }; end: { x: number; y: number } };
          text: string;
          activate: () => void;
          hover: (event: MouseEvent) => void;
          leave: () => void;
        }> = [];
        const regex = /\[Image #(\d+)\]/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
          const imageNum = parseInt(match[1]);
          links.push({
            range: {
              start: { x: match.index + 1, y: bufferLineNumber },
              end: { x: match.index + match[0].length + 1, y: bufferLineNumber },
            },
            text: match[0],
            activate: () => useUIStore.getState().showImageModal(imageNum),
            hover: () => {},
            leave: () => {},
          });
        }
        callback(links.length > 0 ? links : undefined);
      },
    });

    // Window resize handler
    const handleResize = () => {
      fitAddon.fit();
      sendResize();
      requestAnimationFrame(() => term.scrollToBottom());
    };
    window.addEventListener('resize', handleResize);

    // Paste handler for image caching
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                useUIStore.getState().addImageToCache(event.target.result as string);
              }
            };
            reader.readAsDataURL(blob);
          }
        }
      }
    };
    document.addEventListener('paste', handlePaste, true);

    // Connect to WebSocket
    useConnectionStore.getState().connect();

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('paste', handlePaste, true);
      term.dispose();
      termInstanceRef.current = null;
    };
  }, []);

  // React to theme changes (including rehydration that may have already fired)
  useEffect(() => {
    const applyTermTheme = (state: ReturnType<typeof useThemeStore.getState>) => {
      const term = termInstanceRef.current;
      if (!term) return;
      const t = state.theme;
      term.options.theme = {
        background: t.background,
        foreground: t.foreground,
        cursor: t.cursor,
        cursorAccent: t.background,
        selection: t.selection + '4d',
        black: t.black,
        red: t.red,
        green: t.green,
        yellow: t.yellow,
        blue: t.blue,
        magenta: t.magenta,
        cyan: t.cyan,
        white: t.white,
        brightBlack: t.brightBlack || '#6b7280',
        brightRed: t.red,
        brightGreen: t.green,
        brightYellow: t.yellow,
        brightBlue: t.blue,
        brightMagenta: t.magenta,
        brightCyan: t.cyan,
        brightWhite: t.white,
      };
      term.options.fontSize = state.fontSettings.fontSize;
      term.options.lineHeight = state.fontSettings.lineHeight;
      fitAddonRef.current?.fit();
    };
    const unsub = useThemeStore.subscribe(applyTermTheme);
    // Apply current state immediately — rehydration may have already completed
    applyTermTheme(useThemeStore.getState());
    return unsub;
  }, []);

  return <div id="terminal" ref={termRef} style={{ height: '100%' }} />;
}

function sendResize() {
  const { ws, sendMessage } = useConnectionStore.getState();
  const activeSessionId = useSessionStore.getState().activeSessionId;
  const termInst = getTerminalInstance();
  if (ws && ws.readyState === WebSocket.OPEN && activeSessionId && termInst) {
    sendMessage('resize', {
      sessionId: activeSessionId,
      cols: termInst.cols,
      rows: termInst.rows,
    });
  }
}
