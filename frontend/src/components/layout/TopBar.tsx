import { type ReactNode } from 'react';
import { Search } from 'lucide-react';

interface TopBarProps {
  title: string;
  children?: ReactNode;
}

export function TopBar({ title, children }: TopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-bg-secondary/50 px-6 backdrop-blur-sm">
      <h1 className="text-lg font-semibold text-text-primary">{title}</h1>

      <div className="flex items-center gap-3">
        {children}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search..."
            className="h-8 w-52 rounded-lg border border-border bg-bg-tertiary pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
          />
        </div>
      </div>
    </header>
  );
}
