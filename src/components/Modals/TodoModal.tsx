import { useRef, useEffect } from 'react';
import { useTodoStore } from '@/stores/todoStore';

export default function TodoModal() {
  const visible = useTodoStore((s) => s.visible);
  const todos = useTodoStore((s) => s.todos);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) {
      useTodoStore.getState().load();
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        useTodoStore.getState().setVisible(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [visible]);

  if (!visible) return null;

  const handleAdd = () => {
    const text = inputRef.current?.value || '';
    if (text.trim()) {
      useTodoStore.getState().addTodo(text);
      if (inputRef.current) inputRef.current.value = '';
      inputRef.current?.focus();
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="todo-modal visible" onClick={(e) => { if (e.target === e.currentTarget) useTodoStore.getState().setVisible(false); }}>
      <div className="todo-panel">
        <div className="todo-header">
          <h2>Todos</h2>
          <button className="todo-close" onClick={() => useTodoStore.getState().setVisible(false)}>×</button>
        </div>
        <div className="todo-input-row">
          <input
            ref={inputRef}
            type="text"
            placeholder="Add a todo..."
            onKeyDown={handleInputKeyDown}
          />
          <button onClick={handleAdd}>Add</button>
        </div>
        <div className="todo-list">
          {todos.map((todo) => (
            <div key={todo.id} className={`todo-item${todo.done ? ' done' : ''}`}>
              <input
                type="checkbox"
                className="todo-checkbox"
                checked={todo.done}
                onChange={() => useTodoStore.getState().toggleTodo(todo.id)}
              />
              <span className="todo-text">{todo.text}</span>
              <button
                className="todo-delete"
                title="Delete"
                onClick={() => useTodoStore.getState().deleteTodo(todo.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
