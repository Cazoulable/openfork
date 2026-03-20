import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';
import { Spinner } from './Spinner';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-hover shadow-sm shadow-accent/20 active:shadow-none',
  secondary:
    'bg-bg-tertiary text-text-primary hover:bg-bg-hover border border-border',
  danger:
    'bg-danger/10 text-danger hover:bg-danger/20 border border-danger/20',
  ghost:
    'bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5 rounded-md',
  md: 'px-3.5 py-2 text-sm gap-2 rounded-lg',
  lg: 'px-5 py-2.5 text-base gap-2 rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', loading, icon, disabled, className, children, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          'inline-flex items-center justify-center font-medium transition-all duration-150 cursor-pointer',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <Spinner size={size === 'lg' ? 'md' : 'sm'} />
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
