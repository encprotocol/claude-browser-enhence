window.NotesPanel = (function() {
  var modal, notesTiles, noteEditor, noteTitleInput, noteContentArea, noteImagesPreview;
  var noteBackBtn, noteDeleteBtn, noteUploadBtn, noteFileInput, closeBtn, addBtn;
  var data = [];
  var editingNoteId = null;
  var IMG_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

  function load() {
    return fetch('/api/notes')
      .then(function(r) { return r.json(); })
      .then(function(arr) { data = Array.isArray(arr) ? arr : []; })
      .catch(function() { data = []; });
  }

  function save() {
    fetch('/api/notes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).catch(function() {});
  }

  // --- Tile rendering ---

  function extractImages(content) {
    var imgs = [];
    var m;
    var re = /!\[([^\]]*)\]\(([^)]+)\)/g;
    while ((m = re.exec(content)) !== null) {
      imgs.push(m[2]);
    }
    return imgs;
  }

  function stripImages(content) {
    return content.replace(IMG_RE, '').trim();
  }

  function renderTiles() {
    notesTiles.innerHTML = '';
    var sorted = data.slice().sort(function(a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    if (sorted.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'notes-empty';
      empty.textContent = 'No notes yet. Click + to create one.';
      notesTiles.appendChild(empty);
      return;
    }
    sorted.forEach(function(note) {
      var tile = document.createElement('div');
      tile.className = 'notes-tile';
      tile.addEventListener('click', function() { openNote(note.id); });

      var title = document.createElement('div');
      title.className = 'notes-tile-title';
      title.textContent = note.title || 'Untitled';
      tile.appendChild(title);

      var textContent = stripImages(note.content || '');
      if (textContent) {
        var preview = document.createElement('div');
        preview.className = 'notes-tile-preview';
        preview.textContent = textContent.substring(0, 150);
        tile.appendChild(preview);
      }

      var images = extractImages(note.content || '');
      if (images.length > 0) {
        var thumbRow = document.createElement('div');
        thumbRow.className = 'notes-tile-thumbs';
        images.slice(0, 2).forEach(function(src) {
          var img = document.createElement('img');
          img.className = 'notes-tile-thumb';
          img.src = src;
          img.alt = '';
          img.loading = 'lazy';
          thumbRow.appendChild(img);
        });
        if (images.length > 2) {
          var more = document.createElement('span');
          more.className = 'notes-tile-thumb-more';
          more.textContent = '+' + (images.length - 2);
          thumbRow.appendChild(more);
        }
        tile.appendChild(thumbRow);
      }

      var del = document.createElement('button');
      del.className = 'notes-tile-delete';
      del.textContent = '\u00d7';
      del.title = 'Delete note';
      del.addEventListener('click', function(e) {
        e.stopPropagation();
        deleteNote(note.id);
      });
      tile.appendChild(del);

      notesTiles.appendChild(tile);
    });
  }

  // --- Notes CRUD ---

  function createNote() {
    var note = {
      id: Date.now().toString(36),
      title: '',
      content: '',
      updatedAt: Date.now()
    };
    data.push(note);
    save();
    openNote(note.id);
  }

  function renderEditorPreview() {
    var content = noteContentArea.value;
    noteImagesPreview.innerHTML = '';
    if (!content.trim()) return;
    var parts = content.split(/!\[([^\]]*)\]\(([^)]+)\)/);
    for (var i = 0; i < parts.length; i++) {
      if (i % 3 === 0) {
        if (parts[i]) {
          var span = document.createElement('div');
          span.className = 'notes-preview-text';
          span.textContent = parts[i];
          noteImagesPreview.appendChild(span);
        }
      } else if (i % 3 === 2) {
        var img = document.createElement('img');
        img.src = parts[i];
        img.alt = parts[i - 1] || '';
        noteImagesPreview.appendChild(img);
      }
    }
  }

  function openNote(id) {
    editingNoteId = id;
    var note = data.find(function(n) { return n.id === id; });
    if (!note) return;
    noteTitleInput.value = note.title;
    noteContentArea.value = note.content;
    renderEditorPreview();
    noteEditor.classList.add('visible');
    noteTitleInput.focus();
  }

  function closeEditor() {
    saveCurrentNote();
    editingNoteId = null;
    noteEditor.classList.remove('visible');
    renderTiles();
  }

  function saveCurrentNote() {
    if (!editingNoteId) return;
    var note = data.find(function(n) { return n.id === editingNoteId; });
    if (!note) return;
    note.title = noteTitleInput.value;
    note.content = noteContentArea.value;
    note.updatedAt = Date.now();
    save();
  }

  function deleteNote(id) {
    // Server handles image cleanup
    fetch('/api/notes/' + id, { method: 'DELETE' }).catch(function() {});
    data = data.filter(function(n) { return n.id !== id; });
    if (editingNoteId === id) {
      editingNoteId = null;
      noteEditor.classList.remove('visible');
    }
    renderTiles();
  }

  // --- Image / file upload ---

  function uploadFile(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() {
        var base64 = reader.result.split(',')[1];
        fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: file.name, data: base64 })
        })
        .then(function(res) { return res.json(); })
        .then(function(json) {
          if (json.url) resolve(json.url);
          else reject(json.error || 'Upload failed');
        })
        .catch(reject);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function insertAtCursor(textarea, text) {
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var before = textarea.value.substring(0, start);
    var after = textarea.value.substring(end);
    textarea.value = before + text + after;
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus();
    var evt = new Event('input', { bubbles: true });
    textarea.dispatchEvent(evt);
  }

  function handlePaste(e) {
    var items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        var file = items[i].getAsFile();
        var name = 'paste-' + Date.now() + '.png';
        var renamedFile = new File([file], name, { type: file.type });
        insertAtCursor(noteContentArea, '![Uploading...]()');
        uploadFile(renamedFile).then(function(url) {
          noteContentArea.value = noteContentArea.value.replace('![Uploading...]()', '![image](' + url + ')');
          var evt = new Event('input', { bubbles: true });
          noteContentArea.dispatchEvent(evt);
        }).catch(function() {
          noteContentArea.value = noteContentArea.value.replace('![Uploading...]()', '[Upload failed]');
          var evt = new Event('input', { bubbles: true });
          noteContentArea.dispatchEvent(evt);
        });
        return;
      }
    }
  }

  function handleFileSelect(e) {
    var files = e.target.files;
    if (!files || !files.length) return;
    for (var i = 0; i < files.length; i++) {
      (function(file) {
        var isImage = file.type.indexOf('image') !== -1;
        var placeholder = isImage ? '![Uploading ' + file.name + '...]()' : '[Uploading ' + file.name + '...]()';
        insertAtCursor(noteContentArea, placeholder);
        uploadFile(file).then(function(url) {
          var md = isImage ? '![' + file.name + '](' + url + ')' : '[' + file.name + '](' + url + ')';
          noteContentArea.value = noteContentArea.value.replace(placeholder, md);
          var evt = new Event('input', { bubbles: true });
          noteContentArea.dispatchEvent(evt);
        }).catch(function() {
          noteContentArea.value = noteContentArea.value.replace(placeholder, '[Upload failed: ' + file.name + ']');
          var evt = new Event('input', { bubbles: true });
          noteContentArea.dispatchEvent(evt);
        });
      })(files[i]);
    }
    e.target.value = '';
  }

  // --- Panel ---

  function toggle() {
    if (editingNoteId) closeEditor();
    modal.classList.toggle('visible');
  }

  function isVisible() {
    return modal.classList.contains('visible');
  }

  function init() {
    modal = document.getElementById('notes-modal');
    notesTiles = document.getElementById('notes-tiles');
    noteEditor = document.getElementById('notes-editor');
    noteTitleInput = document.getElementById('notes-edit-title');
    noteContentArea = document.getElementById('notes-edit-content');
    noteBackBtn = document.getElementById('notes-edit-back');
    noteDeleteBtn = document.getElementById('notes-edit-delete');
    noteUploadBtn = document.getElementById('notes-edit-upload');
    noteFileInput = document.getElementById('notes-file-input');
    noteImagesPreview = document.getElementById('notes-edit-images');
    closeBtn = document.getElementById('notes-close');
    addBtn = document.getElementById('notes-add-btn');

    load().then(function() { renderTiles(); });

    addBtn.addEventListener('click', function() { createNote(); });
    noteBackBtn.addEventListener('click', function() { closeEditor(); });
    noteDeleteBtn.addEventListener('click', function() {
      if (editingNoteId) deleteNote(editingNoteId);
    });

    noteUploadBtn.addEventListener('click', function() { noteFileInput.click(); });
    noteFileInput.addEventListener('change', handleFileSelect);
    noteContentArea.addEventListener('paste', handlePaste);

    var noteDebounce = null;
    function onNoteInput() {
      clearTimeout(noteDebounce);
      noteDebounce = setTimeout(function() {
        saveCurrentNote();
        renderEditorPreview();
      }, 300);
    }
    noteTitleInput.addEventListener('input', onNoteInput);
    noteContentArea.addEventListener('input', onNoteInput);

    closeBtn.addEventListener('click', function() {
      if (editingNoteId) closeEditor();
      modal.classList.remove('visible');
    });

    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        if (editingNoteId) closeEditor();
        modal.classList.remove('visible');
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && isVisible()) {
        if (editingNoteId) {
          e.stopPropagation();
          closeEditor();
        } else {
          modal.classList.remove('visible');
        }
      }
    });
  }

  return { init: init, toggle: toggle, isVisible: isVisible };
})();
