/**
 * File Browser sidebar module
 * VS Code-style file explorer for browsing directories and previewing files
 */
window.FileBrowser = (function () {
  let sendMessage = null;
  let panelEl, treeEl, pathEl, pathDisplayEl, pathInputEl, viewerPanelEl, viewerContentEl, viewerHeaderNameEl, viewerLiveEl, sidebarEl;
  let currentRoot = '';
  let homeDir = '';
  let expandedDirs = new Set();
  let currentSessionId = null;
  let showHidden = false;
  let linked = localStorage.getItem('synesthesia-fb-linked') !== 'false'; // default true
  const sessionStates = new Map(); // sessionId → { currentRoot, expandedDirs, dirCache, scrollTop }
  let cwdCheckTimer = null;

  // Resize state
  let fvWidth = parseInt(localStorage.getItem('synesthesia-fv-width')) || 400;
  let isResizing = false;

  // Watch state
  let currentViewedFile = null;
  let currentViewerMode = 'text'; // 'text' | 'image' | 'pdf'
  let liveFlashTimer = null;

  // Extension → highlight.js language
  const EXT_LANGS = {
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

  const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp']);
  const PDF_EXTS = new Set(['pdf']);

  // File extension to icon mapping
  const EXT_ICONS = {
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

  function getFileIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    return EXT_ICONS[ext] || '📄';
  }

  function init(options) {
    sendMessage = options.sendMessage;
    panelEl = document.getElementById('file-browser');
    treeEl = document.getElementById('file-browser-tree');
    pathEl = document.getElementById('file-browser-path');
    pathDisplayEl = document.getElementById('file-browser-path-display');
    pathInputEl = document.getElementById('file-browser-path-input');
    viewerPanelEl = document.getElementById('file-viewer-panel');
    viewerContentEl = document.getElementById('file-viewer-content');
    viewerHeaderNameEl = document.getElementById('file-viewer-name');
    viewerLiveEl = document.getElementById('file-viewer-live');
    sidebarEl = document.getElementById('file-sidebar');

    // Apply saved viewer width
    if (viewerPanelEl) viewerPanelEl.style.setProperty('--fv-width', fvWidth + 'px');

    // Header buttons
    document.getElementById('file-browser-refresh').addEventListener('click', () => {
      if (currentRoot) requestDirectory(currentRoot);
    });
    document.getElementById('file-browser-toggle-hidden').addEventListener('click', () => {
      showHidden = !showHidden;
      const btn = document.getElementById('file-browser-toggle-hidden');
      btn.style.opacity = showHidden ? '1' : '0.5';
      if (currentRoot) refreshAll();
    });
    document.getElementById('file-browser-close').addEventListener('click', () => {
      toggle(false);
    });
    document.getElementById('file-viewer-close').addEventListener('click', closeViewer);

    const linkBtn = document.getElementById('file-browser-link');
    if (linkBtn) {
      linkBtn.style.opacity = linked ? '1' : '0.5';
      linkBtn.addEventListener('click', () => {
        linked = !linked;
        localStorage.setItem('synesthesia-fb-linked', linked);
        linkBtn.style.opacity = linked ? '1' : '0.5';
        if (linked && currentSessionId) requestCwd(currentSessionId);
      });
    }

    // Up button
    document.getElementById('file-browser-up').addEventListener('click', () => {
      if (!currentRoot || currentRoot === homeDir) return;
      const parent = currentRoot.replace(/\/[^/]+$/, '') || '/';
      if (homeDir && !parent.startsWith(homeDir)) return;
      navigateToDir(parent);
    });

    // Editable path bar
    pathEl.addEventListener('click', (e) => {
      if (e.target === pathInputEl) return;
      pathDisplayEl.style.display = 'none';
      pathInputEl.style.display = '';
      pathInputEl.value = currentRoot;
      pathInputEl.focus();
      pathInputEl.select();
    });
    pathInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = pathInputEl.value.trim();
        if (val) navigateToDir(val);
        exitPathEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        exitPathEdit();
      }
    });
    pathInputEl.addEventListener('blur', () => {
      exitPathEdit();
    });

    // Resize handle
    initResize();
  }

  function initResize() {
    const handle = document.getElementById('file-viewer-resize-handle');
    if (!handle) return;

    let startX, startWidth;

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isResizing = true;
      startX = e.clientX;
      startWidth = fvWidth;
      handle.classList.add('dragging');
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      // Dragging left edge: moving left = wider, moving right = narrower
      const delta = startX - e.clientX;
      const maxWidth = Math.floor(window.innerWidth * 0.85);
      const newWidth = Math.max(200, Math.min(maxWidth, startWidth + delta));
      fvWidth = newWidth;
      viewerPanelEl.style.setProperty('--fv-width', newWidth + 'px');
    });

    document.addEventListener('mouseup', () => {
      if (!isResizing) return;
      isResizing = false;
      const handle = document.getElementById('file-viewer-resize-handle');
      if (handle) handle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('synesthesia-fv-width', fvWidth);
    });
  }

  function toggle(show, sessionId) {
    if (!panelEl) return;
    const isVis = !panelEl.classList.contains('hidden');
    const shouldShow = show !== undefined ? show : !isVis;

    if (shouldShow) {
      if (sidebarEl) sidebarEl.classList.remove('hidden');
      panelEl.classList.remove('hidden');
      const sid = sessionId || currentSessionId;
      if (sid) {
        currentSessionId = sid;
        if (linked || !restoreSessionState(sid)) {
          requestCwd(sid);
        }
      }
    } else {
      saveSessionState(currentSessionId);
      panelEl.classList.add('hidden');
      if (sidebarEl) sidebarEl.classList.add('hidden');
    }
  }

  function isVisible() {
    return panelEl && !panelEl.classList.contains('hidden');
  }

  function requestCwd(sessionId) {
    currentSessionId = sessionId;
    if (sendMessage) {
      sendMessage('get-cwd', { sessionId });
    }
  }

  function requestDirectory(dirPath) {
    if (sendMessage) {
      sendMessage('list-directory', { path: dirPath, showHidden });
    }
  }

  function requestFile(filePath) {
    if (sendMessage) {
      sendMessage('read-file', { path: filePath });
    }
  }

  let previousRoot = '';

  function navigateToDir(dirPath) {
    previousRoot = currentRoot;
    currentRoot = dirPath;
    if (pathDisplayEl) pathDisplayEl.textContent = currentRoot;
    expandedDirs.clear();
    expandedDirs.add(currentRoot);
    dirCache.clear();
    requestDirectory(currentRoot);
  }

  function exitPathEdit() {
    if (pathInputEl) pathInputEl.style.display = 'none';
    if (pathDisplayEl) pathDisplayEl.style.display = '';
  }

  function handleCwdResult(data) {
    // If cwd hasn't changed, skip full reset (preserves expanded dirs on polls)
    if (data.cwd === currentRoot && dirCache.size > 0) return;
    if (!homeDir && data.home) homeDir = data.home;
    currentRoot = data.cwd;
    if (pathDisplayEl) pathDisplayEl.textContent = currentRoot;
    expandedDirs.clear();
    expandedDirs.add(currentRoot);
    dirCache.clear();
    requestDirectory(currentRoot);
  }

  function checkCwdSoon() {
    if (!linked || !isVisible() || !currentSessionId) return;
    clearTimeout(cwdCheckTimer);
    cwdCheckTimer = setTimeout(() => requestCwd(currentSessionId), 150);
  }

  function handleDirectoryListing(data) {
    if (data.error) {
      if (data.path === currentRoot) {
        treeEl.innerHTML = `<div class="file-browser-empty">${escapeHtml(data.error)}</div>`;
        // Revert to previous root if navigation failed
        if (previousRoot && previousRoot !== currentRoot) {
          currentRoot = previousRoot;
          if (pathDisplayEl) pathDisplayEl.textContent = currentRoot;
        }
      }
      return;
    }
    // Store entries for this directory
    dirCache.set(data.path, data.entries);
    renderTree();
  }

  function handleFileContent(data) {
    if (data.error) {
      showViewer(data.name || data.path.split('/').pop(), data.path, data.error, true);
      return;
    }
    showViewer(data.name, data.path, data.content, false);
  }

  function handleFileUpdate(data) {
    if (!currentViewedFile || data.path !== currentViewedFile) return;
    if (currentViewerMode !== 'text') return; // skip updates for image/pdf
    if (data.error) {
      viewerContentEl.textContent = data.error;
      viewerContentEl.style.color = 'var(--theme-accent, #ef4444)';
      if (viewerLiveEl) viewerLiveEl.classList.remove('active');
      return;
    }
    if (data.content !== undefined) {
      const name = viewerHeaderNameEl ? viewerHeaderNameEl.textContent : '';
      applyHighlighting(name, data.content);
      viewerContentEl.style.color = '';
      // Flash the live indicator
      if (viewerLiveEl) {
        viewerLiveEl.classList.add('active');
        clearTimeout(liveFlashTimer);
        liveFlashTimer = setTimeout(() => {
          viewerLiveEl.classList.remove('active');
        }, 2000);
      }
    }
  }

  // Directory content cache
  let dirCache = new Map();

  function refreshAll() {
    dirCache.clear();
    for (const dir of expandedDirs) {
      requestDirectory(dir);
    }
  }

  function renderTree() {
    if (!treeEl) return;
    const fragment = document.createDocumentFragment();
    renderDir(currentRoot, 0, fragment);
    treeEl.innerHTML = '';
    treeEl.appendChild(fragment);
  }

  function renderDir(dirPath, depth, container) {
    const entries = dirCache.get(dirPath);
    if (!entries) return;

    for (const entry of entries) {
      const row = document.createElement('div');
      row.className = 'file-browser-entry';
      row.style.paddingLeft = (12 + depth * 16) + 'px';

      if (entry.type === 'directory') {
        const isExpanded = expandedDirs.has(entry.path);
        row.innerHTML = `<span class="fb-chevron${isExpanded ? ' expanded' : ''}">\u25B6</span>`
          + `<span class="fb-icon">\uD83D\uDCC1</span>`
          + `<span class="fb-name">${escapeHtml(entry.name)}</span>`;
        row.addEventListener('click', () => {
          if (expandedDirs.has(entry.path)) {
            expandedDirs.delete(entry.path);
            renderTree();
          } else {
            expandedDirs.add(entry.path);
            if (!dirCache.has(entry.path)) {
              requestDirectory(entry.path);
            } else {
              renderTree();
            }
          }
        });
        row.addEventListener('dblclick', () => {
          navigateToDir(entry.path);
        });
        container.appendChild(row);
        if (isExpanded) {
          renderDir(entry.path, depth + 1, container);
        }
      } else {
        row.innerHTML = `<span class="fb-chevron" style="visibility:hidden">\u25B6</span>`
          + `<span class="fb-icon">${getFileIcon(entry.name)}</span>`
          + `<span class="fb-name">${escapeHtml(entry.name)}</span>`;
        row.addEventListener('click', () => {
          // Highlight selected
          treeEl.querySelectorAll('.file-browser-entry.selected').forEach(el => el.classList.remove('selected'));
          row.classList.add('selected');
          // Unwatch previous file before requesting new one
          if (currentViewedFile && sendMessage) {
            sendMessage('unwatch-file', { path: currentViewedFile });
          }
          const ext = entry.name.split('.').pop().toLowerCase();
          if (IMAGE_EXTS.has(ext)) {
            showImageViewer(entry.name, entry.path);
          } else if (PDF_EXTS.has(ext)) {
            showPdfViewer(entry.name, entry.path);
          } else {
            requestFile(entry.path);
          }
        });
        container.appendChild(row);
      }
    }
  }

  function applyHighlighting(name, content) {
    if (typeof hljs === 'undefined') {
      viewerContentEl.textContent = content;
      return;
    }
    const ext = (name || '').split('.').pop().toLowerCase();
    const lang = EXT_LANGS[ext];
    try {
      const result = lang
        ? hljs.highlight(content, { language: lang, ignoreIllegals: true })
        : hljs.highlightAuto(content);
      viewerContentEl.innerHTML = '<code class="hljs">' + result.value + '</code>';
    } catch {
      viewerContentEl.textContent = content;
    }
  }

  function showImageViewer(name, filePath) {
    if (!viewerPanelEl) return;
    viewerHeaderNameEl.textContent = name || 'Image';
    viewerContentEl.innerHTML = '';
    viewerContentEl.style.color = '';
    viewerContentEl.style.padding = '';
    const img = document.createElement('img');
    img.src = '/api/file?path=' + encodeURIComponent(filePath);
    img.alt = name;
    viewerContentEl.appendChild(img);
    currentViewedFile = filePath;
    currentViewerMode = 'image';
    if (viewerLiveEl) viewerLiveEl.classList.remove('active');
    viewerPanelEl.classList.remove('hidden');
  }

  function showPdfViewer(name, filePath) {
    if (!viewerPanelEl) return;
    viewerHeaderNameEl.textContent = name || 'PDF';
    viewerContentEl.innerHTML = '';
    viewerContentEl.style.color = '';
    viewerContentEl.style.padding = '0';
    const iframe = document.createElement('iframe');
    iframe.src = '/api/file?path=' + encodeURIComponent(filePath);
    viewerContentEl.appendChild(iframe);
    currentViewedFile = filePath;
    currentViewerMode = 'pdf';
    if (viewerLiveEl) viewerLiveEl.classList.remove('active');
    viewerPanelEl.classList.remove('hidden');
  }

  function showViewer(name, filePath, content, isError) {
    if (!viewerPanelEl) return;
    viewerHeaderNameEl.textContent = name || 'File';
    viewerContentEl.style.padding = '';
    currentViewerMode = 'text';
    if (isError) {
      viewerContentEl.textContent = content;
      viewerContentEl.style.color = 'var(--theme-accent, #ef4444)';
      currentViewedFile = null;
      if (viewerLiveEl) viewerLiveEl.classList.remove('active');
    } else {
      applyHighlighting(name, content);
      viewerContentEl.style.color = '';
      currentViewedFile = filePath;
      // Start watching the file
      if (sendMessage && filePath) {
        sendMessage('watch-file', { path: filePath });
      }
    }
    viewerPanelEl.classList.remove('hidden');
  }

  function closeViewer() {
    if (viewerPanelEl) viewerPanelEl.classList.add('hidden');
    // Unwatch current file
    if (currentViewedFile && sendMessage) {
      sendMessage('unwatch-file', { path: currentViewedFile });
    }
    currentViewedFile = null;
    if (viewerLiveEl) viewerLiveEl.classList.remove('active');
    clearTimeout(liveFlashTimer);
  }

  function saveSessionState(sid) {
    if (!sid) return;
    sessionStates.set(sid, {
      currentRoot,
      expandedDirs: new Set(expandedDirs),
      dirCache: new Map(dirCache),
      scrollTop: treeEl ? treeEl.scrollTop : 0
    });
  }

  function restoreSessionState(sid) {
    const s = sessionStates.get(sid);
    if (!s) return false;
    currentRoot = s.currentRoot;
    expandedDirs = new Set(s.expandedDirs);
    dirCache = new Map(s.dirCache);
    if (pathDisplayEl) pathDisplayEl.textContent = currentRoot;
    renderTree();
    if (treeEl) treeEl.scrollTop = s.scrollTop;
    return true;
  }

  function clearSessionState(sid) { sessionStates.delete(sid); }

  function switchSession(prevId, newId) {
    saveSessionState(prevId);
    currentSessionId = newId;
    if (!isVisible()) return;
    if (linked) {
      requestCwd(newId);
    } else if (!restoreSessionState(newId)) {
      requestCwd(newId);
    }
  }

  function setSessionId(sessionId) {
    currentSessionId = sessionId;
  }

  function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return {
    init,
    toggle,
    isVisible,
    requestCwd,
    handleCwdResult,
    handleDirectoryListing,
    handleFileContent,
    handleFileUpdate,
    setSessionId,
    switchSession,
    clearSessionState,
    checkCwdSoon
  };
})();
