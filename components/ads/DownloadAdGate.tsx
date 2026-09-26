"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { AdsterraBanner, useAdFree } from "@/components/ads/AdsterraBanner";

function DownloadAdModal({ onContinue }: { onContinue: () => void }) {
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    buttonRef.current?.querySelector("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onContinue();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onContinue]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-graphite-950/80 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onContinue();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-ad-title"
        className="relative w-full max-w-sm rounded-2xl border border-graphite-800 bg-graphite-900 p-5 shadow-2xl shadow-graphite-950/70"
      >
        <button
          type="button"
          onClick={onContinue}
          aria-label="Close and download"
          className={buttonStyles({
            variant: "ghost",
            size: "icon-sm",
            className: "absolute right-3 top-3 z-10 text-text-subtle",
          })}
        >
          <X />
        </button>
        <p id="download-ad-title" className="pr-8 text-sm font-medium text-text-primary">
          Your file is ready
        </p>
        <p className="mt-1 text-[13px] text-text-muted">Ads keep this tool free.</p>
        <AdsterraBanner className="mt-4" />
        <div ref={buttonRef} className="mt-4">
          <Button variant="primary" size="lg" className="w-full" onClick={onContinue}>
            <Download />
            Continue to download
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function clickLink(href: string, filename?: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename ?? "";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// One ad per result. Closing the ad still downloads the file.
export function useDownloadAd(enabled = true) {
  const adFree = useAdFree();
  const [open, setOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);
  const shown = useRef<Set<string>>(new Set());

  const gate = useCallback(
    (id: string, action: () => void) => {
      if (!enabled || adFree || shown.current.has(id)) {
        action();
        return;
      }
      shown.current.add(id);
      pending.current = action;
      setOpen(true);
    },
    [enabled, adFree]
  );

  const linkClick = useCallback(
    (id: string, href: string, filename?: string | boolean) => (e: MouseEvent<HTMLAnchorElement>) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!enabled || adFree || shown.current.has(id)) return;
      e.preventDefault();
      gate(id, () => clickLink(href, typeof filename === "string" ? filename : undefined));
    },
    [enabled, adFree, gate]
  );

  const finish = useCallback(() => {
    const action = pending.current;
    pending.current = null;
    setOpen(false);
    action?.();
  }, []);

  const modal = open ? <DownloadAdModal onContinue={finish} /> : null;

  return { gate, linkClick, modal };
}