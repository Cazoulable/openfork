import { type InputHTMLAttributes, forwardRef, useId } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, wrapperClassName, className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className={clsx('flex flex-col gap-1.5', wrapperClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-text-secondary"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            'w-full rounded-lg border bg-bg-tertiary px-3.5 py-2.5 text-sm text-text-primary',
            'placeholder:text-text-muted',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent',
            error
              ? 'border-danger/50 focus:ring-danger/50 focus:border-danger'
              : 'border-border',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className,
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-danger mt-0.5">{error}</p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
