import { useRef, useEffect, useCallback } from 'react';
import { useNotesStore } from '@/stores/notesStore';
import type { Note } from '@/types';

const IMG_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

function extractImages(content: string): string[] {
  const imgs: string[] = [];
  let m;
  const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
  while ((m = re.exec(content)) !== null) {
    imgs.push(m[2]);
  }
  return imgs;
}

function stripImages(content: string): string {
  return content.replace(IMG_RE, '').trim();
}

function NoteTile({ note, onOpen, onDelete }: { note: Note; onOpen: (id: string) => void; onDelete: (id: string) => void }) {
  const textContent = stripImages(note.content || '');
  const images = extractImages(note.content || '');

  return (
    <div className="notes-tile" onClick={() => onOpen(note.id)}>
      <div className="notes-tile-title">{note.title || 'Untitled'}</div>
      {textContent && (
        <div className="notes-tile-preview">{textContent.substring(0, 150)}</div>
      )}
      {images.length > 0 && (
        <div className="notes-tile-thumbs">
          {images.slice(0, 2).map((src, i) => (
            <img key={i} className="notes-tile-thumb" src={src} alt="" loading="lazy" />
          ))}
          {images.length > 2 && (
            <span className="notes-tile-thumb-more">+{images.length - 2}</span>
          )}
        </div>
      )}
      <button
        className="notes-tile-delete"
        title="Delete note"
        onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
      >
        ×
      </button>
    </div>
  );
}

function NoteEditor({ note }: { note: Note }) {
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.value = note.title;
    }
    if (contentRef.current) {
      contentRef.current.value = note.content;
    }
    titleRef.current?.focus();
  }, [note.id]);

  const saveDebounced = useCallback(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const title = titleRef.current?.value || '';
      const content = contentRef.current?.value || '';
      useNotesStore.getState().saveCurrentNote(title, content);
    }, 300);
  }, []);

  const handleBack = () => {
    // Save before closing
    const title = titleRef.current?.value || '';
    const content = contentRef.current?.value || '';
    useNotesStore.getState().saveCurrentNote(title, content);
    useNotesStore.getState().closeEditor();
  };

  const handleDelete = () => {
    useNotesStore.getState().deleteNote(note.id);
  };

  const insertAtCursor = (text: string) => {
    const ta = contentRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    ta.value = ta.value.substring(0, start) + text + ta.value.substring(end);
    ta.selectionStart = ta.selectionEnd = start + text.length;
    ta.focus();
    saveDebounced();
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        const name = 'paste-' + Date.now() + '.png';
        const renamedFile = new File([file], name, { type: file.type });
        insertAtCursor('![Uploading...]()');
        try {
          const url = await useNotesStore.getState().uploadImage(renamedFile);
          if (contentRef.current) {
            contentRef.current.value = contentRef.current.value.replace('![Uploading...]()', `![image](${url})`);
            saveDebounced();
          }
        } catch {
          if (contentRef.current) {
            contentRef.current.value = contentRef.current.value.replace('![Uploading...]()', '[Upload failed]');
            saveDebounced();
          }
        }
        return;
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith('image/');
      const placeholder = isImage ? `![Uploading ${file.name}...]()` : `[Uploading ${file.name}...]()`;
      insertAtCursor(placeholder);
      try {
        const url = await useNotesStore.getState().uploadImage(file);
        const md = isImage ? `![${file.name}](${url})` : `[${file.name}](${url})`;
        if (contentRef.current) {
          contentRef.current.value = contentRef.current.value.replace(placeholder, md);
          saveDebounced();
        }
      } catch {
        if (contentRef.current) {
          contentRef.current.value = contentRef.current.value.replace(placeholder, `[Upload failed: ${file.name}]`);
          saveDebounced();
        }
      }
    }
    e.target.value = '';
  };

  // Render preview of content (images inline)
  const content = contentRef.current?.value || note.content;
  const parts = content.split(/!\[([^\]]*)\]\(([^)]+)\)/);
  const previewElements: React.ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 3 === 0) {
      if (parts[i]) {
        previewElements.push(<div key={i} className="notes-preview-text">{parts[i]}</div>);
      }
    } else if (i % 3 === 2) {
      previewElements.push(<img key={i} src={parts[i]} alt={parts[i - 1] || ''} />);
    }
  }

  return (
    <div className="notes-editor visible">
      <div className="notes-editor-toolbar">
        <button className="notes-editor-btn" onClick={handleBack}>← Back</button>
        <div className="notes-editor-toolbar-right">
          <button className="notes-editor-btn" onClick={() => fileInputRef.current?.click()}>📎 Upload</button>
          <button className="notes-editor-btn notes-editor-delete" onClick={handleDelete}>🗑 Delete</button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </div>
      </div>
      <input
        ref={titleRef}
        type="text"
        className="notes-edit-title"
        placeholder="Note title..."
        defaultValue={note.title}
        onInput={saveDebounced}
      />
      <div className="notes-editor-body">
        <textarea
          ref={contentRef}
          className="notes-textarea"
          placeholder="Write your note... (paste images here)"
          defaultValue={note.content}
          onInput={saveDebounced}
          onPaste={handlePaste}
        />
        <div className="notes-edit-images">{previewElements}</div>
      </div>
    </div>
  );
}

export default function NotesModal() {
  const visible = useNotesStore((s) => s.visible);
  const notes = useNotesStore((s) => s.notes);
  const editingNoteId = useNotesStore((s) => s.editingNoteId);

  useEffect(() => {
    if (visible) {
      useNotesStore.getState().load();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingNoteId) {
          e.stopPropagation();
          useNotesStore.getState().closeEditor();
        } else {
          useNotesStore.getState().setVisible(false);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [visible, editingNoteId]);

  if (!visible) return null;

  const sorted = [...notes].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const editingNote = editingNoteId ? notes.find((n) => n.id === editingNoteId) : null;

  const handleClose = () => {
    if (editingNoteId) useNotesStore.getState().closeEditor();
    useNotesStore.getState().setVisible(false);
  };

  return (
    <div className="notes-modal visible" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="notes-panel">
        <div className="notes-header">
          <h2>Notes</h2>
          <button className="notes-add-btn" onClick={() => useNotesStore.getState().createNote()}>+</button>
          <button className="notes-close" onClick={handleClose}>×</button>
        </div>

        {editingNote ? (
          <NoteEditor note={editingNote} />
        ) : (
          <div className="notes-tiles">
            {sorted.length === 0 ? (
              <div className="notes-empty">No notes yet. Click + to create one.</div>
            ) : (
              sorted.map((note) => (
                <NoteTile
                  key={note.id}
                  note={note}
                  onOpen={(id) => useNotesStore.getState().openNote(id)}
                  onDelete={(id) => useNotesStore.getState().deleteNote(id)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
