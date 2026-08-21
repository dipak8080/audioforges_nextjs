"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * WHY THIS EXISTS AND NOT A <select>.
 *
 * A native select renders its option list as an OS-level popup that lives
 * outside the document. `.scrollbar-thin` cannot reach it, `color-scheme`
 * only nudges it, and on Windows/Chrome it draws a thick light scrollbar
 * against a dark card no matter what the page says. There is no CSS fix —
 * the element is the problem.
 *
 * The other reason: ~99 Whisper languages in a native list is only
 * navigable by type-ahead, which most people don't know exists and which
 * breaks the moment you think "Farsi" instead of "Persian". A visible
 * search field is both discoverable and forgiving.
 *
 * Generic on purpose — takes `{ code, name }` groups, knows nothing about
 * transcription, and should be the pattern for any long list on the site.
 *
 * Accessibility follows the combobox-with-listbox-popup pattern: the
 * search field is the combobox, `aria-activedescendant` moves the reading
 * cursor without moving DOM focus, so typing and arrowing work at once.
 */

export interface SelectOption {
  code: string;
  name: string;
}

export interface SelectGroup {
  label: string;
  options: SelectOption[];
}

interface SearchableSelectProps {
  /** Ties an external <label> to the trigger. */
  id?: string;
  /** Selected code. Empty string means the `autoOption` row. */
  value: string;
  onChange: (code: string) => void;
  groups: SelectGroup[];
  /** The always-first, always-unfiltered default row. */
  autoOption: string;
  disabled?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: string;
  className?: string;
}

/** Scrolls the list, not the document.
 *
 *  `element.scrollIntoView()` walks every scrollable ancestor including
 *  the page, so arrowing through the options would drag the whole page
 *  around underneath the popover. */
function keepInView(element: HTMLElement | null, container: HTMLElement | null) {
  if (!element || !container) return;
  const box = container.getBoundingClientRect();
  const item = element.getBoundingClientRect();
  if (item.top < box.top) {
    container.scrollTop -= box.top - item.top + 8;
  } else if (item.bottom > box.bottom) {
    container.scrollTop += item.bottom - box.bottom + 8;
  }
}

export function SearchableSelect({
  id,
  value,
  onChange,
  groups,
  autoOption,
  disabled = false,
  searchPlaceholder = "Search…",
  emptyLabel = "No matches",
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
const activeRef = useRef<HTMLDivElement>(null);

  const reactId = useId();
  const listboxId = `${reactId}-listbox`;
  const optionId = (index: number) => `${reactId}-option-${index}`;

  /* Flat rows carry their group so headers can be drawn where the group
     changes. Filtering drops the grouping entirely — once you've typed
     "por", "Common / All languages" is noise. */
  const rows = useMemo(() => {
    const all: { group: string | null; option: SelectOption }[] = [
      { group: null, option: { code: "", name: autoOption } },
      ...groups.flatMap((group) =>
        group.options.map((option) => ({ group: group.label, option }))
      ),
    ];

    const needle = query.trim().toLowerCase();
    if (!needle) return all;

    return all
      .filter(
        ({ option }) =>
          option.name.toLowerCase().includes(needle) || option.code.toLowerCase() === needle
      )
      .map((row) => ({ ...row, group: null }))
      // A name that starts with the query beats one that merely contains
      // it, so "en" surfaces English before Slovenian.
      .sort((a, b) => {
        const aStarts = a.option.name.toLowerCase().startsWith(needle) ? 0 : 1;
        const bStarts = b.option.name.toLowerCase().startsWith(needle) ? 0 : 1;
        return aStarts - bStarts;
      });
  }, [groups, query, autoOption]);

  const selectedName = useMemo(() => {
    if (!value) return autoOption;
    for (const group of groups) {
      const hit = group.options.find((option) => option.code === value);
      if (hit) return hit.name;
    }
    return value;
  }, [value, groups, autoOption]);

  /* --- open / close ------------------------------------------------ */
  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    setQuery("");
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    // Start on the current selection rather than the top, so opening and
    // pressing Enter is a no-op instead of silently resetting to auto.
    const current = rows.findIndex((row) => row.option.code === value);
    setActiveIndex(current >= 0 ? current : 0);
    // Intentionally not depending on `rows`: this should run when the
    // popover opens, not every time the query narrows the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open, close]);

  useEffect(() => {
    if (open) keepInView(activeRef.current, listRef.current);
  }, [activeIndex, open, rows]);

  const commit = (index: number) => {
    const row = rows[index];
    if (!row) return;
    onChange(row.option.code);
    close();
  };

  const move = (delta: number) => {
    if (rows.length === 0) return;
    setActiveIndex((current) => (current + delta + rows.length) % rows.length);
  };

  /* --- render ------------------------------------------------------ */
  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-lg border bg-graphite-850 pl-3.5 pr-3 text-left text-sm transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/20",
          "disabled:pointer-events-none disabled:opacity-50",
          open
            ? "border-amber-500/50 text-text-primary"
            : "border-graphite-700 text-text-primary hover:border-graphite-600"
        )}
      >
        <span className="truncate">{selectedName}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-text-subtle transition-transform duration-150",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-lg border border-graphite-700",
            "bg-graphite-900 shadow-xl shadow-graphite-950/70"
          )}
        >
          <div className="relative border-b border-graphite-800">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-subtle"
              aria-hidden
            />
            <input
              ref={searchRef}
              type="text"
              role="combobox"
              aria-expanded
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={rows.length ? optionId(activeIndex) : undefined}
              aria-label={searchPlaceholder}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={(event) => {
                switch (event.key) {
                  case "ArrowDown":
                    event.preventDefault();
                    move(1);
                    break;
                  case "ArrowUp":
                    event.preventDefault();
                    move(-1);
                    break;
                  case "Home":
                    event.preventDefault();
                    setActiveIndex(0);
                    break;
                  case "End":
                    event.preventDefault();
                    setActiveIndex(rows.length - 1);
                    break;
                  case "Enter":
                    event.preventDefault();
                    commit(activeIndex);
                    break;
                  case "Escape":
                    event.preventDefault();
                    close();
                    break;
                  case "Tab":
                    close(false);
                    break;
                }
              }}
              placeholder={searchPlaceholder}
              autoComplete="off"
              spellCheck={false}
              className="h-10 w-full bg-transparent pl-9 pr-9 text-sm text-text-primary placeholder:text-text-subtle focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-text-subtle transition-colors hover:bg-graphite-800 hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Options"
            // overscroll-contain stops the page from taking over the
            // scroll the moment the list hits its end.
            className="scrollbar-thin max-h-64 overflow-y-auto overscroll-contain py-1"
          >
            {rows.length === 0 && (
              <li className="px-3.5 py-3 text-[13px] text-text-subtle">{emptyLabel}</li>
            )}

            {rows.map((row, index) => {
              const isActive = index === activeIndex;
              const isSelected = row.option.code === value;
              const showHeader = row.group !== null && row.group !== rows[index - 1]?.group;

              return (
                <li key={`${row.option.code || "auto"}-${index}`}>
                  {showHeader && (
                    <p
                      // Presentational: the group name is decoration for
                      // sighted scanning, and announcing it as an option
                      // would put an unselectable row in the listbox.
                      aria-hidden
                      className="px-3.5 pb-1 pt-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-text-subtle"
                    >
                      {row.group}
                    </p>
                  )}
                  <div
                    ref={isActive ? activeRef : undefined}
                    id={optionId(index)}
                    role="option"
                    aria-selected={isSelected}
                    // mousedown, not click: click fires after the
                    // document mousedown that would already have closed
                    // the popover out from under the pointer.
                    onMouseDown={(event) => {
                      event.preventDefault();
                      commit(index);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 px-3.5 py-2 text-sm transition-colors",
                      isActive ? "bg-graphite-800 text-text-primary" : "text-text-muted"
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{row.option.name}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}