import { type SelectHTMLAttributes, forwardRef, useId } from 'react';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  wrapperClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, wrapperClassName, className, id, children, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id || generatedId;

    return (
      <div className={clsx('flex flex-col gap-1.5', wrapperClassName)}>
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium text-text-secondary"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={clsx(
              'w-full appearance-none rounded-lg border bg-bg-tertiary px-3.5 py-2.5 pr-10 text-sm text-text-primary',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent',
              error
                ? 'border-danger/50 focus:ring-danger/50 focus:border-danger'
                : 'border-border',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              className,
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        </div>
        {error && (
          <p className="text-xs text-danger mt-0.5">{error}</p>
        )}
      </div>
    );
  },
);

Select.displayName = 'Select';
