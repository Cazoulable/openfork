import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { clsx } from 'clsx';

interface MessageInputProps {
  onSend: (body: string) => void | Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export function MessageInput({
  onSend,
  placeholder = 'Type a message...',
  disabled = false,
  autoFocus = false,
  className,
}: MessageInputProps) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = body.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setBody('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } finally {
      setSending(false);
    }
    textareaRef.current?.focus();
  }, [body, sending, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className={clsx(
        'flex items-end gap-2 border-t border-border bg-bg-secondary px-4 py-3',
        className,
      )}
    >
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          adjustHeight();
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || sending}
        autoFocus={autoFocus}
        rows={1}
        className={clsx(
          'flex-1 resize-none rounded-lg border border-border bg-bg-tertiary px-3.5 py-2.5 text-sm text-text-primary',
          'placeholder:text-text-muted',
          'transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      />
      <button
        onClick={handleSend}
        disabled={!body.trim() || disabled || sending}
        className={clsx(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 cursor-pointer',
          body.trim()
            ? 'bg-accent text-white hover:bg-accent-hover'
            : 'bg-bg-tertiary text-text-muted',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
        title="Send message"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}
