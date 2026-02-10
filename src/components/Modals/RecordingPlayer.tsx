import { useRef, useEffect } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useThemeStore } from '@/stores/themeStore';
import { buildXtermTheme } from '@/lib/xtermTheme';
import type { Recording } from '@/types';

/**
 * Imperative mount: creates a read-only xterm instance, writes all output
 * events, and returns a dispose function.  Used by the React component
 * and directly in tests.
 */
export function mountRecordingPlayer(
  container: HTMLElement,
  recording: Recording,
): () => void {
  const state = useThemeStore.getState();
  const { fontSize, lineHeight } = state.fontSettings;

  // Trim events before first input (removes welcome banner / header noise)
  const firstInputIdx = recording.events.findIndex(ev => ev.type === 'i');
  const firstInputTime = firstInputIdx >= 0 ? recording.events[firstInputIdx].t : -1;
  const events = firstInputTime >= 0
    ? recording.events.filter(ev => ev.t >= firstInputTime && ev.type !== 'i')
    : recording.events.filter(ev => ev.type !== 'i');

  // Determine initial cols/rows: prefer first resize in full recording, fall back to meta
  const firstResize = recording.events.find(ev => ev.type === 'r');
  const cols = firstResize?.cols || recording.cols || 80;
  const rows = firstResize?.rows || recording.rows || 24;

  const term = new Terminal({
    cols,
    rows,
    disableStdin: true,
    theme: buildXtermTheme(state.theme),
    fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, Monaco, monospace',
    fontSize,
    lineHeight,
    scrollback: 10000,
  });

  term.open(container);

  // Helper: compute how many rows fit the container, keeping recorded cols
  const computeFitRows = () => {
    const cellHeight = (term as any)._core?._renderService?.dimensions?.css?.cell?.height;
    const containerHeight = container.clientHeight;
    if (containerHeight > 0 && cellHeight && cellHeight > 0) {
      return Math.max(rows, Math.floor(containerHeight / cellHeight));
    }
    return rows;
  };

  // Watch for container resizes (e.g. entering/exiting fullscreen)
  const ro = new ResizeObserver(() => {
    const fitRows = computeFitRows();
    term.resize(cols, fitRows);
  });
  ro.observe(container);

  // Wait for browser layout so xterm's renderer initializes dimensions
  let rafId: number | null = null;
  rafId = requestAnimationFrame(() => {
    rafId = null;

    // Expand rows to fill the container height, but keep original cols
    // to preserve the line wrapping from the recorded session
    const fitRows = computeFitRows();
    if (fitRows !== rows) {
      term.resize(cols, fitRows);
    }

    // Replay output and resize events in order, then scroll to top
    const playable = events.filter(ev => ev.type === 'o' || ev.type === 'r');

    if (playable.length === 0) {
      term.scrollToTop();
    } else {
      for (let i = 0; i < playable.length; i++) {
        const ev = playable[i];
        if (ev.type === 'r' && ev.cols && ev.rows) {
          term.resize(ev.cols, ev.rows);
        } else if (ev.type === 'o' && ev.data) {
          if (i === playable.length - 1) {
            term.write(ev.data, () => term.scrollToTop());
          } else {
            term.write(ev.data);
          }
        }
      }
      // If last event was a resize (not output), still scroll to top
      if (playable[playable.length - 1].type !== 'o') {
        term.scrollToTop();
      }
    }
  });

  // Sync theme changes
  const unsub = useThemeStore.subscribe((s) => {
    term.options.theme = buildXtermTheme(s.theme);
    term.options.fontSize = s.fontSettings.fontSize;
    term.options.lineHeight = s.fontSettings.lineHeight;
  });

  return () => {
    if (rafId != null) cancelAnimationFrame(rafId);
    ro.disconnect();
    unsub();
    term.dispose();
  };
}

/**
 * React component wrapper — mounts/unmounts the player on recording change.
 */
export default function RecordingPlayer({ recording }: { recording: Recording }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const dispose = mountRecordingPlayer(containerRef.current, recording);
    return dispose;
  }, [recording.id]);

  return <div className="recording-player-terminal" ref={containerRef} />;
}
