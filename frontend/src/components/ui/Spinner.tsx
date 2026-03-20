import { clsx } from 'clsx';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4 border-[1.5px]',
  md: 'h-5 w-5 border-2',
  lg: 'h-8 w-8 border-2',
};

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div
      className={clsx(
        'animate-spin rounded-full border-current border-t-transparent opacity-70',
        sizeClasses[size],
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
