import { useRef, useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';

export default function PromptDialog() {
  const { prompt, closePrompt } = useUIStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (prompt.visible && inputRef.current && !prompt.isConfirm) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [prompt.visible, prompt.isConfirm]);

  if (!prompt.visible) return null;

  const handleOk = () => {
    closePrompt(prompt.isConfirm ? true : inputRef.current?.value ?? null);
  };

  const handleCancel = () => {
    closePrompt(prompt.isConfirm ? false : null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleOk();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  return (
    <div className="prompt-overlay visible" onClick={(e) => e.target === e.currentTarget && handleCancel()}>
      <div className="prompt-box">
        <h3>{prompt.title}</h3>
        {!prompt.isConfirm && (
          <input
            ref={inputRef}
            type="text"
            defaultValue={prompt.defaultValue}
            onKeyDown={handleKeyDown}
          />
        )}
        <div className="prompt-buttons">
          <button className="prompt-btn" onClick={handleCancel}>Cancel</button>
          <button className="prompt-btn prompt-btn-primary" onClick={handleOk}>
            {prompt.isConfirm ? 'Yes' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
