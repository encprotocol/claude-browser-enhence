import type { Todo, Note, RecordingMeta, Recording, RecordingSummary } from '@/types';

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

export async function fetchRecordings(): Promise<RecordingMeta[]> {
  const res = await fetch('/api/recordings');
  const arr = await res.json();
  return Array.isArray(arr) ? arr : [];
}

export async function fetchRecording(id: string): Promise<Recording | null> {
  const res = await fetch(`/api/recordings/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function deleteRecording(id: string): Promise<void> {
  await fetch(`/api/recordings/${id}`, { method: 'DELETE' });
}

export async function fetchRecordingSummary(id: string): Promise<RecordingSummary | null> {
  const res = await fetch(`/api/recordings/${id}/summary`);
  if (!res.ok) return null;
  return res.json();
}

export async function generateRecordingSummary(id: string, transcript: string): Promise<RecordingSummary> {
  const res = await fetch(`/api/recordings/${id}/summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Summary generation failed' }));
    throw new Error(err.error || 'Summary generation failed');
  }
  return res.json();
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
