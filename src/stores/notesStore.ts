import { create } from 'zustand';
import type { Note } from '@/types';
import { fetchNotes, saveNotes, deleteNote as apiDeleteNote, uploadFile } from '@/lib/api';
import { closeAllPopups } from '@/lib/popupManager';

interface NotesState {
  notes: Note[];
  visible: boolean;
  editingNoteId: string | null;
  loading: boolean;

  load: () => Promise<void>;
  createNote: () => void;
  openNote: (id: string) => void;
  closeEditor: () => void;
  saveCurrentNote: (title: string, content: string) => void;
  deleteNote: (id: string) => void;
  toggle: () => void;
  setVisible: (visible: boolean) => void;
  uploadImage: (file: File) => Promise<string>;
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  visible: false,
  editingNoteId: null,
  loading: false,

  load: async () => {
    set({ loading: true });
    const notes = await fetchNotes();
    set({ notes, loading: false });
  },

  createNote: () => {
    const note: Note = {
      id: Date.now().toString(36),
      title: '',
      content: '',
      updatedAt: Date.now(),
    };
    const notes = [...get().notes, note];
    set({ notes, editingNoteId: note.id });
    saveNotes(notes);
  },

  openNote: (id) => set({ editingNoteId: id }),

  closeEditor: () => {
    set({ editingNoteId: null });
  },

  saveCurrentNote: (title, content) => {
    const { editingNoteId, notes } = get();
    if (!editingNoteId) return;
    const updated = notes.map((n) =>
      n.id === editingNoteId ? { ...n, title, content, updatedAt: Date.now() } : n,
    );
    set({ notes: updated });
    saveNotes(updated);
  },

  deleteNote: (id) => {
    apiDeleteNote(id);
    const notes = get().notes.filter((n) => n.id !== id);
    set({ notes });
    if (get().editingNoteId === id) {
      set({ editingNoteId: null });
    }
  },

  toggle: () => {
    const { visible, editingNoteId } = get();
    const willOpen = !visible;
    if (editingNoteId) {
      set({ editingNoteId: null });
    }
    if (willOpen) closeAllPopups();
    set({ visible: willOpen });
  },

  setVisible: (visible) => set({ visible }),

  uploadImage: async (file) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        try {
          const url = await uploadFile(file.name, base64);
          resolve(url);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  },
}));
