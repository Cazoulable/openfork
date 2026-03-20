import { clsx } from 'clsx';

interface AvatarProps {
  displayName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-11 w-11 text-sm',
};

const avatarColors = [
  'bg-indigo-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-cyan-600',
  'bg-violet-600',
  'bg-pink-600',
  'bg-teal-600',
  'bg-orange-600',
  'bg-sky-600',
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32-bit int
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ displayName, size = 'md', className }: AvatarProps) {
  const colorClass = avatarColors[hashName(displayName) % avatarColors.length];
  const initials = getInitials(displayName);

  return (
    <div
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none',
        colorClass,
        sizeClasses[size],
        className,
      )}
      title={displayName}
    >
      {initials}
    </div>
  );
}
