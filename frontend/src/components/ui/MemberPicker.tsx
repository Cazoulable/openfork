import { useState, useRef } from 'react';
import { X, Search } from 'lucide-react';
import { Avatar } from './Avatar';

export interface MemberOption {
  user_id: string;
  display_name: string;
}

interface MemberPickerProps {
  members: MemberOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}

export function MemberPicker({ members, selectedIds, onChange, placeholder = 'Search members...' }: MemberPickerProps) {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = members.filter((m) =>
    m.display_name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedMembers = members.filter((m) => selectedIds.includes(m.user_id));

  const toggle = (userId: string) => {
    if (selectedIds.includes(userId)) {
      onChange(selectedIds.filter((id) => id !== userId));
    } else {
      onChange([...selectedIds, userId]);
    }
  };

  const remove = (userId: string) => {
    onChange(selectedIds.filter((id) => id !== userId));
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Selected chips */}
      {selectedMembers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedMembers.map((m) => (
            <span
              key={m.user_id}
              className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent"
            >
              {m.display_name}
              <button
                type="button"
                onClick={() => remove(m.user_id)}
                className="rounded-full p-0.5 hover:bg-accent/20 transition-colors cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          className="w-full rounded-lg border border-border bg-bg-tertiary pl-8 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Member list */}
      <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-sm text-text-muted py-2 px-1">No members found</p>
        ) : (
          filtered.map((m) => {
            const selected = selectedIds.includes(m.user_id);
            return (
              <button
                key={m.user_id}
                type="button"
                onClick={() => toggle(m.user_id)}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors cursor-pointer ${
                  selected
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-primary hover:bg-bg-hover'
                }`}
              >
                <Avatar displayName={m.display_name} size="sm" />
                <span className="flex-1 truncate">{m.display_name}</span>
                {selected && (
                  <span className="text-xs font-medium text-accent shrink-0">Selected</span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
