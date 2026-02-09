import { useState, useRef, useCallback } from 'react';
import { useFileBrowserStore } from '@/stores/fileBrowserStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useSessionStore } from '@/stores/sessionStore';
import type { FileEntry } from '@/types';

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp']);
const PDF_EXTS = new Set(['pdf']);

const EXT_ICONS: Record<string, string> = {
  js: '📜', ts: '📜', jsx: '📜', tsx: '📜', mjs: '📜',
  py: '🐍', rb: '💎', rs: '🦀', go: '🔵', java: '☕',
  c: '⚙️', cpp: '⚙️', h: '⚙️', hpp: '⚙️',
  html: '🌐', css: '🎨', scss: '🎨', less: '🎨',
  json: '📋', yaml: '📋', yml: '📋', toml: '📋', xml: '📋',
  md: '📝', txt: '📄', log: '📄', csv: '📄',
  sh: '⚡', bash: '⚡', zsh: '⚡', fish: '⚡',
  png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🖼️', webp: '🖼️',
  zip: '📦', tar: '📦', gz: '📦',
  lock: '🔒', env: '🔒',
};

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return EXT_ICONS[ext] || '📄';
}

function DirEntry({ entry, depth, expandedDirs, dirCache, onToggle, onNavigate, onFileClick }: {
  entry: FileEntry;
  depth: number;
  expandedDirs: Set<string>;
  dirCache: Map<string, FileEntry[]>;
  onToggle: (path: string) => void;
  onNavigate: (path: string) => void;
  onFileClick: (entry: FileEntry) => void;
}) {
  const isExpanded = expandedDirs.has(entry.path);
  const children = isExpanded ? dirCache.get(entry.path) : undefined;

  return (
    <>
      <div
        className="file-browser-entry"
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={() => onToggle(entry.path)}
        onDoubleClick={() => onNavigate(entry.path)}
      >
        <span className={`fb-chevron${isExpanded ? ' expanded' : ''}`}>▶</span>
        <span className="fb-icon">📁</span>
        <span className="fb-name">{entry.name}</span>
      </div>
      {isExpanded && children?.map((child) => (
        child.type === 'directory' ? (
          <DirEntry
            key={child.path}
            entry={child}
            depth={depth + 1}
            expandedDirs={expandedDirs}
            dirCache={dirCache}
            onToggle={onToggle}
            onNavigate={onNavigate}
            onFileClick={onFileClick}
          />
        ) : (
          <FileRow key={child.path} entry={child} depth={depth + 1} onFileClick={onFileClick} />
        )
      ))}
    </>
  );
}

function FileRow({ entry, depth, onFileClick }: {
  entry: FileEntry;
  depth: number;
  onFileClick: (entry: FileEntry) => void;
}) {
  return (
    <div
      className="file-browser-entry"
      style={{ paddingLeft: 12 + depth * 16 }}
      onClick={() => onFileClick(entry)}
    >
      <span className="fb-chevron" style={{ visibility: 'hidden' }}>▶</span>
      <span className="fb-icon">{getFileIcon(entry.name)}</span>
      <span className="fb-name">{entry.name}</span>
    </div>
  );
}

export default function FileBrowserPanel() {
  const [editingPath, setEditingPath] = useState(false);
  const [pathInputValue, setPathInputValue] = useState('');
  const pathInputRef = useRef<HTMLInputElement>(null);

  const currentRoot = useFileBrowserStore((s) => s.currentRoot);
  const home = useFileBrowserStore((s) => s.home);
  const showHidden = useFileBrowserStore((s) => s.showHidden);
  const linked = useFileBrowserStore((s) => s.linked);
  const expandedDirs = useFileBrowserStore((s) => s.expandedDirs);
  const dirCache = useFileBrowserStore((s) => s.dirCache);

  const sendMessage = useConnectionStore((s) => s.sendMessage);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);

  const handleRefresh = () => {
    if (currentRoot) {
      // Clear cache and re-request all expanded dirs
      const store = useFileBrowserStore.getState();
      for (const dir of store.expandedDirs) {
        sendMessage('list-directory', { path: dir, showHidden });
      }
    }
  };

  const handleToggleHidden = () => {
    const newVal = !showHidden;
    useFileBrowserStore.getState().setShowHidden(newVal);
    if (currentRoot) {
      const store = useFileBrowserStore.getState();
      for (const dir of store.expandedDirs) {
        sendMessage('list-directory', { path: dir, showHidden: newVal });
      }
    }
  };

  const handleToggleLink = () => {
    const newLinked = !linked;
    useFileBrowserStore.getState().setLinked(newLinked);
    if (newLinked && activeSessionId) {
      sendMessage('get-cwd', { sessionId: activeSessionId });
    }
  };

  const handleClose = () => {
    useFileBrowserStore.getState().setVisible(false);
  };

  const handleUp = () => {
    if (!currentRoot || currentRoot === home) return;
    const parent = currentRoot.replace(/\/[^/]+$/, '') || '/';
    if (home && !parent.startsWith(home)) return;
    useFileBrowserStore.getState().navigateToDir(parent);
    sendMessage('list-directory', { path: parent, showHidden });
  };

  const handlePathClick = () => {
    setPathInputValue(currentRoot);
    setEditingPath(true);
    setTimeout(() => {
      pathInputRef.current?.focus();
      pathInputRef.current?.select();
    }, 0);
  };

  const handlePathKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = pathInputValue.trim();
      if (val) {
        useFileBrowserStore.getState().navigateToDir(val);
        sendMessage('list-directory', { path: val, showHidden });
      }
      setEditingPath(false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingPath(false);
    }
  };

  const handleToggleDir = useCallback((dirPath: string) => {
    const store = useFileBrowserStore.getState();
    if (store.expandedDirs.has(dirPath)) {
      store.toggleExpand(dirPath);
    } else {
      store.toggleExpand(dirPath);
      if (!store.dirCache.has(dirPath)) {
        sendMessage('list-directory', { path: dirPath, showHidden: store.showHidden });
      }
    }
  }, [sendMessage]);

  const handleNavigate = useCallback((dirPath: string) => {
    useFileBrowserStore.getState().navigateToDir(dirPath);
    sendMessage('list-directory', { path: dirPath, showHidden: useFileBrowserStore.getState().showHidden });
  }, [sendMessage]);

  const handleFileClick = useCallback((entry: FileEntry) => {
    // Unwatch previous file
    const store = useFileBrowserStore.getState();
    if (store.watchedFile) {
      sendMessage('unwatch-file', { path: store.watchedFile });
    }
    const ext = entry.name.split('.').pop()?.toLowerCase() || '';
    if (IMAGE_EXTS.has(ext)) {
      store.showImageViewer(entry.name, entry.path);
    } else if (PDF_EXTS.has(ext)) {
      store.showPdfViewer(entry.name, entry.path);
    } else {
      sendMessage('read-file', { path: entry.path });
    }
  }, [sendMessage]);

  const rootEntries = dirCache.get(currentRoot);

  return (
    <div className="file-browser">
      <div className="file-browser-header">
        <span className="fb-title">Files</span>
        <button title="Refresh" onClick={handleRefresh}>↻</button>
        <button
          title="Toggle hidden files"
          style={{ opacity: showHidden ? 1 : 0.5 }}
          onClick={handleToggleHidden}
        >
          ⚙
        </button>
        <button title="Up" onClick={handleUp}>↑</button>
        <button
          title="Link to terminal CWD"
          style={{ opacity: linked ? 1 : 0.5 }}
          onClick={handleToggleLink}
        >
          🔗
        </button>
        <button title="Close" onClick={handleClose}>×</button>
      </div>

      <div className="file-browser-path" onClick={!editingPath ? handlePathClick : undefined}>
        {editingPath ? (
          <input
            ref={pathInputRef}
            className="file-browser-path-input"
            value={pathInputValue}
            onChange={(e) => setPathInputValue(e.target.value)}
            onKeyDown={handlePathKeyDown}
            onBlur={() => setEditingPath(false)}
          />
        ) : (
          <span>{currentRoot || '~'}</span>
        )}
      </div>

      <div className="file-browser-tree">
        {rootEntries ? (
          rootEntries.map((entry) =>
            entry.type === 'directory' ? (
              <DirEntry
                key={entry.path}
                entry={entry}
                depth={0}
                expandedDirs={expandedDirs}
                dirCache={dirCache}
                onToggle={handleToggleDir}
                onNavigate={handleNavigate}
                onFileClick={handleFileClick}
              />
            ) : (
              <FileRow key={entry.path} entry={entry} depth={0} onFileClick={handleFileClick} />
            )
          )
        ) : (
          currentRoot ? <div className="file-browser-empty">Loading...</div> : null
        )}
      </div>
    </div>
  );
}
