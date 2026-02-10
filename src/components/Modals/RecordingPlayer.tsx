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
  const cols = recording.cols || 80;
  const rows = recording.rows || 24;

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

  // Expand cols and rows to fill the container
  const cellWidth = (term as any)._core?._renderService?.dimensions?.css?.cell?.width;
  const cellHeight = (term as any)._core?._renderService?.dimensions?.css?.cell?.height;
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;

  let fitCols = cols;
  let fitRows = rows;
  if (containerWidth > 0 && cellWidth && cellWidth > 0) {
    fitCols = Math.max(cols, Math.floor(containerWidth / cellWidth));
  }
  if (containerHeight > 0 && cellHeight && cellHeight > 0) {
    fitRows = Math.max(rows, Math.floor(containerHeight / cellHeight));
  }
  if (fitCols !== cols || fitRows !== rows) {
    term.resize(fitCols, fitRows);
  }

  // Write all output events then scroll to top
  const outputEvents = recording.events.filter(ev => ev.type === 'o');

  if (outputEvents.length === 0) {
    term.scrollToTop();
  } else {
    for (let i = 0; i < outputEvents.length - 1; i++) {
      term.write(outputEvents[i].data);
    }
    term.write(outputEvents[outputEvents.length - 1].data, () => {
      term.scrollToTop();
    });
  }

  // Sync theme changes
  const unsub = useThemeStore.subscribe((s) => {
    term.options.theme = buildXtermTheme(s.theme);
    term.options.fontSize = s.fontSettings.fontSize;
    term.options.lineHeight = s.fontSettings.lineHeight;
  });

  return () => {
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
