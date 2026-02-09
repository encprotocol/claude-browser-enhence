import { create } from 'zustand';
import type { Todo } from '@/types';
import { fetchTodos, saveTodos } from '@/lib/api';

interface TodoState {
  todos: Todo[];
  visible: boolean;
  loading: boolean;
  load: () => Promise<void>;
  addTodo: (text: string) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  toggle: () => void;
  setVisible: (visible: boolean) => void;
}

export const useTodoStore = create<TodoState>((set, get) => ({
  todos: [],
  visible: false,
  loading: false,

  load: async () => {
    set({ loading: true });
    const todos = await fetchTodos();
    set({ todos, loading: false });
  },

  addTodo: (text) => {
    text = text.trim();
    if (!text) return;
    const todo: Todo = { id: Date.now().toString(36), text, done: false };
    const todos = [...get().todos, todo];
    set({ todos });
    saveTodos(todos);
  },

  toggleTodo: (id) => {
    const todos = get().todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    set({ todos });
    saveTodos(todos);
  },

  deleteTodo: (id) => {
    const todos = get().todos.filter((t) => t.id !== id);
    set({ todos });
    saveTodos(todos);
  },

  toggle: () => set((s) => ({ visible: !s.visible })),
  setVisible: (visible) => set({ visible }),
}));
