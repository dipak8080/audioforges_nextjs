"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn } from "@/lib/utils/cn";
import { STUDIO_MENU } from "@/lib/studio/nav";

interface Entry {
  label: string;
  hint: string;
  href: string;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const entries = useMemo<Entry[]>(() => {
    const n = t.nav;
    const tools = STUDIO_MENU.flatMap((g) =>
      g.items.map((item) => ({
        label: item.key === "forgeClean" ? "Forge Clean" : item.key === "forgeSplit" ? "Forge Split" : n[item.key],
        hint: n[g.key],
        href: item.href,
      }))
    );
    return [
      ...tools,
      { label: n.pricing, hint: "", href: "/pricing" },
      { label: n.guides, hint: "", href: "/guides" },
      { label: n.account, hint: "", href: "/account" },
      { label: t.account.billingTitle, hint: n.account, href: "/account#billing" },
      { label: n.buySongs, hint: "", href: "/pricing" },
      { label: t.palette.changelog, hint: "", href: "/changelog" },
      { label: t.palette.freeTools, hint: "", href: "/tools" },
    ];
  }, [t]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => `${e.label} ${e.hint}`.toLowerCase().includes(q));
  }, [entries, query]);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  function go(entry: Entry | undefined) {
    if (!entry) return;
    onClose();
    setQuery("");
    setIndex(0);
    router.push(entry.href);
  }

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label={t.palette.open}>
      <button type="button" aria-label={t.unlock.close} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-graphite-700 bg-graphite-900 shadow-2xl">
        <div className="flex items-center gap-3 border-b border-graphite-800 px-4">
          <Search className="h-4 w-4 text-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(results.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(results[index]);
              }
            }}
            placeholder={t.palette.placeholder}
            className="h-12 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-subtle"
          />
          <kbd className="rounded border border-graphite-700 px-1.5 py-0.5 font-mono text-[10px] text-text-subtle">Esc</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-1">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-text-muted">{t.palette.empty}</li>}
          {results.map((e, i) => (
            <li key={`${e.href}-${e.label}`}>
              <button
                type="button"
                onMouseEnter={() => setIndex(i)}
                onClick={() => go(e)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm",
                  i === index ? "bg-graphite-800 text-text-primary" : "text-text-body"
                )}
              >
                {e.label}
                {e.hint && <span className="font-mono text-[10px] uppercase tracking-wider text-text-subtle">{e.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body
  );
}