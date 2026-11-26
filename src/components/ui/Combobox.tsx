import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/util';

export interface ComboOption {
  value: string;
  label: string;
  hint?: string;
  keywords?: string;
}

/** Searchable single-select following the ARIA combobox pattern. */
export function Combobox({
  options,
  value,
  onChange,
  label,
  placeholder = 'Search…',
  className,
  renderLabel,
}: {
  options: ComboOption[];
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
  renderLabel?: (o: ComboOption) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.hint ?? ''} ${o.keywords ?? ''}`.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (o: ComboOption) => {
    onChange(o.value);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <label htmlFor={`${id}-input`} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          id={`${id}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[active] ? `${id}-opt-${active}` : undefined}
          value={open ? query : (selected?.label ?? '')}
          placeholder={selected ? selected.label : placeholder}
          onFocus={() => {
            setOpen(true);
            setActive(Math.max(0, filtered.findIndex((o) => o.value === value)));
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(filtered.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === 'Enter' && open && filtered[active]) {
              e.preventDefault();
              choose(filtered[active]);
              inputRef.current?.blur();
            } else if (e.key === 'Escape') {
              setOpen(false);
              setQuery('');
            }
          }}
          className="h-10 w-full rounded-[10px] border border-line bg-surface pr-9 pl-9 text-sm font-medium text-ink shadow-1 outline-none placeholder:font-normal placeholder:text-ink focus:border-[var(--focus)] focus:ring-3 focus:ring-[color-mix(in_srgb,var(--focus)_18%,transparent)]"
        />
        <ChevronsUpDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
      </div>
      {open && (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          aria-label={label}
          className="animate-fade absolute z-40 mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-3"
        >
          {filtered.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-muted">No matches for "{query}"</li>}
          {filtered.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-opt-${i}`}
              data-index={i}
              role="option"
              aria-selected={o.value === value}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(o)}
              onMouseMove={() => setActive(i)}
              className={cn('flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[13px]', i === active ? 'bg-surface-2' : '')}
            >
              <Check aria-hidden className={cn('size-3.5 shrink-0 text-primary-ink', o.value === value ? 'opacity-100' : 'opacity-0')} />
              <span className="min-w-0 flex-1 truncate font-medium text-ink">{renderLabel ? renderLabel(o) : o.label}</span>
              {o.hint && <span className="shrink-0 text-xs text-muted">{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
