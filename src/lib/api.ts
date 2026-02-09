import type { Todo, Note } from '@/types';

export async function fetchTodos(): Promise<Todo[]> {
  const res = await fetch('/api/todos');
  const arr = await res.json();
  return Array.isArray(arr) ? arr : [];
}

export async function saveTodos(todos: Todo[]): Promise<void> {
  await fetch('/api/todos', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(todos),
  });
}

export async function fetchNotes(): Promise<Note[]> {
  const res = await fetch('/api/notes');
  const arr = await res.json();
  return Array.isArray(arr) ? arr : [];
}

export async function saveNotes(notes: Note[]): Promise<void> {
  await fetch('/api/notes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(notes),
  });
}

export async function deleteNote(id: string): Promise<void> {
  await fetch(`/api/notes/${id}`, { method: 'DELETE' });
}

export async function uploadFile(name: string, base64Data: string): Promise<string> {
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, data: base64Data }),
  });
  const json = await res.json();
  if (json.url) return json.url;
  throw new Error(json.error || 'Upload failed');
}
