import { useRef, useEffect, useCallback } from 'react';
import hljs from 'highlight.js';
import { marked } from 'marked';
import { useFileBrowserStore } from '@/stores/fileBrowserStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { wrapLinesHtml } from '@/lib/lineNumbers';

const EXT_LANGS: Record<string, string> = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript',
  jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', rb: 'ruby', rs: 'rust', go: 'go',
  java: 'java', c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
  cs: 'csharp', swift: 'swift', kt: 'kotlin',
  html: 'xml', css: 'css', scss: 'scss', less: 'less',
  json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'ini',
  xml: 'xml', sql: 'sql', sh: 'bash', bash: 'bash',
  zsh: 'bash', fish: 'bash', md: 'markdown',
  php: 'php', lua: 'lua', r: 'r', pl: 'perl',
  dockerfile: 'dockerfile', makefile: 'makefile',
};

function applyHighlighting(name: string, content: string): string {
  const ext = (name || '').split('.').pop()?.toLowerCase() || '';
  const lang = EXT_LANGS[ext];
  try {
    const result = lang
      ? hljs.highlight(content, { language: lang, ignoreIllegals: true })
      : hljs.highlightAuto(content);
    return '<code class="hljs">' + result.value + '</code>';
  } catch {
    return '';
  }
}

export default function FileViewerPanel() {
  const viewerVisible = useFileBrowserStore((s) => s.viewerVisible);
  const viewerMode = useFileBrowserStore((s) => s.viewerMode);
  const viewerFileName = useFileBrowserStore((s) => s.viewerFileName);
  const viewerFilePath = useFileBrowserStore((s) => s.viewerFilePath);
  const viewerContent = useFileBrowserStore((s) => s.viewerContent);
  const viewerRawContent = useFileBrowserStore((s) => s.viewerRawContent);
  const viewerIsError = useFileBrowserStore((s) => s.viewerIsError);
  const viewerRendered = useFileBrowserStore((s) => s.viewerRendered);
  const liveActive = useFileBrowserStore((s) => s.liveActive);
  const viewerWidth = useFileBrowserStore((s) => s.viewerWidth);

  const viewerScrollTop = useFileBrowserStore((s) => s.viewerScrollTop);

  const contentRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const liveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const isMarkdown = /\.(md|markdown)$/i.test(viewerFileName);

  // Save scroll position as ratio (0–1) on scroll (debounced)
  const handleScroll = useCallback(() => {
    clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      if (contentRef.current) {
        const el = contentRef.current;
        const maxScroll = el.scrollHeight - el.clientHeight;
        const ratio = maxScroll > 0 ? el.scrollTop / maxScroll : 0;
        useFileBrowserStore.getState().setViewerScrollTop(ratio);
      }
    }, 100);
  }, []);

  // Restore scroll position from ratio after content/mode changes
  useEffect(() => {
    if (contentRef.current && viewerScrollTop > 0) {
      requestAnimationFrame(() => {
        if (contentRef.current) {
          const el = contentRef.current;
          const maxScroll = el.scrollHeight - el.clientHeight;
          el.scrollTop = viewerScrollTop * maxScroll;
        }
      });
    }
  }, [viewerContent, viewerRendered]);

  // Auto-clear live indicator after 2s
  useEffect(() => {
    if (liveActive) {
      liveTimerRef.current = setTimeout(() => {
        useFileBrowserStore.getState().setLiveActive(false);
      }, 2000);
      return () => clearTimeout(liveTimerRef.current);
    }
  }, [liveActive, viewerContent]);

  const handleClose = () => {
    const state = useFileBrowserStore.getState();
    if (state.watchedFile) {
      useConnectionStore.getState().sendMessage('unwatch-file', { path: state.watchedFile });
    }
    state.closeViewer();
  };

  const handleToggleRender = () => {
    useFileBrowserStore.getState().setViewerRendered(!viewerRendered);
  };

  // Resize handler
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startWidth: viewerWidth };
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = resizeRef.current.startX - e.clientX;
      const maxWidth = Math.floor(window.innerWidth * 0.85);
      const newWidth = Math.max(200, Math.min(maxWidth, resizeRef.current.startWidth + delta));
      useFileBrowserStore.getState().setViewerWidth(newWidth);
    };

    const handleMouseUp = () => {
      resizeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [viewerWidth]);

  if (!viewerVisible) return null;

  let contentHtml = '';
  let contentText = '';
  let isHtml = false;

  let showLineNumbers = false;

  if (viewerMode === 'text') {
    if (viewerIsError) {
      contentText = viewerContent;
    } else if (viewerRendered && isMarkdown && viewerRawContent) {
      try {
        contentHtml = marked.parse(viewerRawContent) as string;
        isHtml = true;
      } catch {
        contentText = viewerRawContent;
      }
    } else {
      const highlighted = applyHighlighting(viewerFileName, viewerContent);
      if (highlighted) {
        // Wrap lines inside the <code> tag for line numbering
        contentHtml = highlighted.replace(
          /(<code class="hljs">)([\s\S]*)(<\/code>)/,
          (_m, open, body, close) => open + wrapLinesHtml(body) + close,
        );
        isHtml = true;
      } else {
        // Plain text — escape HTML and wrap lines
        const escaped = viewerContent
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        contentHtml = '<code class="hljs">' + wrapLinesHtml(escaped) + '</code>';
        isHtml = true;
      }
      showLineNumbers = true;
    }
  }

  return (
    <div
      className="file-viewer-panel"
      style={{ '--fv-width': viewerWidth + 'px' } as React.CSSProperties}
    >
      <div className="file-viewer-resize-handle" onMouseDown={handleResizeMouseDown} />
      <div className="file-viewer-header">
        <span className="fv-name">{viewerFileName || 'File'}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className={`fv-live-indicator${liveActive ? ' active' : ''}`}>●</span>
          {isMarkdown && viewerMode === 'text' && !viewerIsError && (
            <button
              className={viewerRendered ? 'active' : ''}
              title="Toggle markdown render"
              onClick={handleToggleRender}
            >
              📖
            </button>
          )}
          <button title="Close" onClick={handleClose}>×</button>
        </div>
      </div>
      <div
        ref={contentRef}
        className={`file-viewer-content${viewerRendered && isMarkdown ? ' rendered' : ''}${showLineNumbers ? ' line-numbers' : ''}`}
        style={viewerIsError ? { color: 'var(--theme-accent, #ef4444)' } : undefined}
        onScroll={handleScroll}
      >
        {viewerMode === 'text' && (
          isHtml
            ? <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
            : <span>{contentText}</span>
        )}
        {viewerMode === 'image' && (
          <img
            src={'/api/file?path=' + encodeURIComponent(viewerFilePath)}
            alt={viewerFileName}
          />
        )}
        {viewerMode === 'pdf' && (
          <iframe
            src={'/api/file?path=' + encodeURIComponent(viewerFilePath)}
            title={viewerFileName}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        )}
      </div>
    </div>
  );
}
