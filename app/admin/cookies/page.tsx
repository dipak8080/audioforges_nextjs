"use client";

/**
 * app/admin/cookies/page.tsx — redesigned to match the rest of the console.
 *
 * Same shell as Credits and Cache: fixed header and KPI rail, one scrolling
 * region, shared primitives and palette.
 *
 * The domain logic is untouched, because it's the part that's hard-won: only
 * definitive failures get colour, "revoked" is treated as a different kind of
 * evidence from "expired", and no slot is ever labelled "valid" — the file's
 * own expiry date can't prove that.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Cookie,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

/* ------------------------------------------------------------------ */
/* types                                                               */
/* ------------------------------------------------------------------ */

interface CookieSlot {
  exists: boolean;
  path: string;
  size_bytes?: number;
  last_modified?: number;
  expires_at?: number | null;
  expires_in_days?: number | null;
  expiry_status?: ExpiryStatus;
  critical_cookies_found?: number;
  // The runtime's own verdict, layered on top of the static expiry date by
  // cookie_health.apply_to() on the backend. See the "revoked" case below for
  // why the date alone was never enough — Google can kill a session
  // server-side without touching the file, so a future date proves nothing
  // once revoked_at is present.
  revoked_at?: number | null;
  revoked_reason?: string | null;
}

type ExpiryStatus =
  | "ok"
  | "warning"
  | "critical"
  | "expired"
  | "missing"
  | "no_auth_cookies"
  | "session_only"
  | "unknown"
  // The runtime confirmed YouTube rejected this session (yt-dlp's "cookies are
  // no longer valid" warning, repeated enough times to rule out a flaky check
  // — see cookie_health.py). Distinct from every other status here because
  // it's the only one NOT derived from the file's own expiry date: a slot can
  // show "revoked" while expires_in_days still reads 365. Never overrides
  // "expired" or "no_auth_cookies" — both are already terminal and more
  // specific about what's wrong with the file itself.
  | "revoked";

type SlotMap = Record<string, CookieSlot>;
type Tone = "warn" | "bad" | "muted";

interface UploadResponse {
  slot?: string | number;
  expiry_status?: ExpiryStatus;
  expires_in_days?: number | null;
  error?: string;
}

const MAX_UPLOAD_BYTES = 1024 * 1024;

const SLOT_LABELS: Record<string, string> = {
  slot_1: "Primary",
  slot_2: "Backup 1",
  slot_3: "Backup 2",
};

/**
 * The expiry date is a static string written into cookies.txt at export time.
 * If Google revokes the session server-side the date does not change, so a
 * future date proves nothing on its own — that gap is exactly what "revoked"
 * exists to close. Only definitive failures get colour; everything else reports
 * the date and claims nothing.
 */
const TONE: Record<ExpiryStatus, Tone> = {
  ok: "muted",
  warning: "warn",
  critical: "bad",
  expired: "bad",
  no_auth_cookies: "bad",
  session_only: "warn",
  unknown: "muted",
  missing: "muted",
  revoked: "bad",
};

const DEFINITELY_BROKEN: ExpiryStatus[] = ["expired", "no_auth_cookies", "revoked"];

const CHIP_CLASSES: Record<Tone, string> = {
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  bad: "border-red-500/30 bg-red-500/10 text-red-300",
  muted: "border-graphite-700 bg-graphite-850 text-text-muted",
};

/* ------------------------------------------------------------------ */
/* formatting                                                          */
/* ------------------------------------------------------------------ */

function formatRelativeTime(unixSeconds: number): string {
  const diffSec = Math.floor((Date.now() - unixSeconds * 1000) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return `${Math.floor(diffDay / 30)}mo ago`;
}

const formatDate = (unixSeconds: number) =>
  new Date(unixSeconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatFileSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;

function formatWindow(days: number | null | undefined): string {
  if (days == null) return "—";
  const abs = Math.abs(days);
  if (abs < 1) return `${Math.round(abs * 24)}h`;
  if (abs < 60) return `${Math.round(abs)}d`;
  return `${Math.round(abs / 30)}mo`;
}

/**
 * One chip, one sentence fragment. No label + value duplication. Takes the
 * whole slot because the "revoked" case needs revoked_at, which lives beside
 * expires_in_days on the same object.
 */
function chipText(info: CookieSlot): string {
  const status = info.expiry_status ?? "unknown";
  switch (status) {
    case "revoked":
      // Deliberately says WHEN it was revoked, not "13mo left" — the date is
      // still visible in the Expires row below, so nothing is hidden, but the
      // chip's one job is to say what actually happened, and "revoked"
      // outranks a clock that never stopped.
      return info.revoked_at != null ? `Revoked ${formatRelativeTime(info.revoked_at)}` : "Revoked";
    case "expired":
      return info.expires_in_days != null ? `Expired ${formatWindow(info.expires_in_days)} ago` : "Expired";
    case "no_auth_cookies":
      return "No auth cookies";
    case "session_only":
      return "No expiry set";
    case "unknown":
      return "Date unreadable";
    default:
      return info.expires_in_days != null ? `${formatWindow(info.expires_in_days)} left` : "Expiry unknown";
  }
}

/** fetch() can't report upload progress, so this stays on XHR. */
function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress: (pct: number) => void
): Promise<{ status: number; data: UploadResponse | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data: UploadResponse | null = null;
      try {
        data = JSON.parse(xhr.responseText) as UploadResponse;
      } catch {
        data = null;
      }
      resolve({ status: xhr.status, data });
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.send(formData);
  });
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

const STYLES = `
.af-scroll { scrollbar-width: thin; scrollbar-color: rgb(120 113 108 / .45) transparent; }
.af-scroll::-webkit-scrollbar { width: 11px; height: 11px; }
.af-scroll::-webkit-scrollbar-track { background: transparent; }
.af-scroll::-webkit-scrollbar-thumb {
  background: rgb(120 113 108 / .38); border-radius: 99px;
  border: 3px solid transparent; background-clip: content-box;
}
.af-scroll::-webkit-scrollbar-thumb:hover { background: rgb(245 158 11 / .55); background-clip: content-box; }
.af-railless { scrollbar-width: none; -ms-overflow-style: none; }
.af-railless::-webkit-scrollbar { display: none; }
@keyframes af-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.af-rise { animation: af-rise .24s cubic-bezier(.22,.9,.32,1) both; }
@keyframes af-toast { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }
.af-toast { animation: af-toast .2s cubic-bezier(.22,.9,.32,1) both; }
@keyframes af-shimmer { 100% { transform: translateX(100%); } }
.af-skel { position: relative; overflow: hidden; }
.af-skel::after {
  content: ""; position: absolute; inset: 0; transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / .05), transparent);
  animation: af-shimmer 1.4s infinite;
}
@media (prefers-reduced-motion: reduce) { .af-rise, .af-toast, .af-skel::after { animation: none !important; } }
`;

/* ------------------------------------------------------------------ */
/* shell + toasts                                                      */
/* ------------------------------------------------------------------ */

function useShellHeight() {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setHeight(Math.max(360, Math.round(window.innerHeight - el.getBoundingClientRect().top)));
    measure();
    window.addEventListener("resize", measure);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro && el.parentElement) ro.observe(el.parentElement);
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, []);

  return [ref, height] as const;
}

type Toast = { id: number; tone: "ok" | "warn" | "bad"; text: string };

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast["tone"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  return { toasts, push, dismiss };
}

function ToastStack({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "af-toast pointer-events-auto flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-relaxed shadow-2xl shadow-black/40 backdrop-blur",
            t.tone === "ok" && "border-teal-500/30 bg-teal-500/10 text-teal-300",
            t.tone === "warn" && "border-amber-500/30 bg-amber-500/10 text-amber-300",
            t.tone === "bad" && "border-red-500/30 bg-red-500/10 text-red-300"
          )}
        >
          {t.tone === "ok" ? (
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
          <span className="flex-1">{t.text}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
            className="rounded p-0.5 opacity-60 outline-none transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-current"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* primitives                                                          */
/* ------------------------------------------------------------------ */

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-graphite-800 bg-graphite-900/70", className)}>
      {children}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-subtle">{children}</p>;
}

function Button({
  children,
  onClick,
  type = "button",
  variant = "ghost",
  size = "md",
  disabled,
  busy,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  busy?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-medium outline-none transition-all",
        "focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-graphite-950",
        "disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "h-9 px-3 text-[13px]" : "h-10 px-4 text-sm",
        variant === "primary" &&
          "bg-amber-500 font-semibold text-graphite-950 shadow-lg shadow-amber-500/10 hover:bg-amber-400 active:scale-[0.98]",
        variant === "ghost" &&
          "border border-graphite-700 bg-graphite-850/80 text-text-muted hover:border-graphite-600 hover:text-text-primary active:scale-[0.98]",
        variant === "danger" &&
          "border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 active:scale-[0.98]",
        className
      )}
    >
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

function Pill({ label, value, tone = "plain" }: { label: string; value: string; tone?: "plain" | "accent" | "alarm" }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-baseline gap-2 rounded-lg border px-2.5 py-1.5",
        tone === "alarm" ? "border-red-500/30 bg-red-500/[0.07]" : "border-graphite-800 bg-graphite-900/60"
      )}
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-text-subtle">{label}</span>
      <span
        className={cn(
          "font-mono text-[13px] font-semibold tabular-nums",
          tone === "alarm" ? "text-red-400" : tone === "accent" ? "text-amber-400" : "text-text-primary"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("af-skel rounded-2xl bg-graphite-850/70", className)} />;
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function AdminCookiesPage() {
  const [slots, setSlots] = useState<SlotMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedSlot, setSelectedSlot] = useState("1");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  // Only problems live here. Successes go to a toast — a green box that sticks
  // around under the form is just clutter once you've read it.
  const [uploadProblem, setUploadProblem] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadPanelRef = useRef<HTMLDivElement>(null);

  const { toasts, push, dismiss } = useToasts();
  const [shellRef, shellHeight] = useShellHeight();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/cookies", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Server returned ${res.status}`);
      setSlots(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Server key order isn't guaranteed; slot order is meaningful here.
  const slotEntries = useMemo(
    () => (slots ? Object.entries(slots).sort(([a], [b]) => a.localeCompare(b)) : []),
    [slots]
  );
  const presentCount = slotEntries.filter(([, s]) => s.exists).length;
  const brokenSlots = slotEntries.filter(
    ([, s]) => s.exists && s.expiry_status != null && DEFINITELY_BROKEN.includes(s.expiry_status)
  );
  // Split out for the banner sentence, so "revoked" and "past expiry" aren't
  // conflated into one misleading word — a slot the runtime killed didn't
  // necessarily run out of time, and one that ran out of time wasn't
  // necessarily ever confirmed dead in use.
  const revokedCount = slotEntries.filter(([, s]) => s.expiry_status === "revoked").length;

  async function handleRefresh() {
    setRefreshing(true);
    await load();
  }

  function pickFile(f: File | null) {
    setUploadProblem(null);
    if (f && !f.name.toLowerCase().endsWith(".txt")) {
      setUploadProblem("Choose a .txt file exported from your browser.");
      setFile(null);
      return;
    }
    if (f && f.size > MAX_UPLOAD_BYTES) {
      setUploadProblem("That file is over 1 MB — not a cookies export.");
      setFile(null);
      return;
    }
    setFile(f);
  }

  function startUploadFor(slot: string) {
    setSelectedSlot(slot);
    uploadPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    fileInputRef.current?.click();
  }

  async function handleUpload() {
    if (!file) return;
    setUploadProblem(null);
    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("slot", selectedSlot);
      formData.append("file", file);

      const { status, data } = await uploadWithProgress("/api/admin/cookies", formData, setUploadProgress);
      if (status < 200 || status >= 300) throw new Error(data?.error || `Server returned ${status}`);

      const st = data?.expiry_status;
      const isBroken = st != null && DEFINITELY_BROKEN.includes(st);
      const slotName = String(data?.slot ?? selectedSlot);

      let message: string;
      if (st === "expired") {
        message = `Slot ${slotName} saved, but this export is already past its expiry date. Re-export from a logged-in session.`;
      } else if (st === "no_auth_cookies") {
        message = `Slot ${slotName} saved, but it contains no auth cookies. This looks like a logged-out export.`;
      } else if (st === "session_only") {
        message = `Slot ${slotName} saved. Cookies are session-scoped, so there's no expiry date to check.`;
      } else if (data?.expires_in_days != null) {
        message = `Slot ${slotName} saved · ${formatWindow(data.expires_in_days)} left on the clock.`;
      } else {
        message = `Slot ${slotName} saved.`;
      }
      // "revoked" deliberately isn't reachable here: cookie_health is cleared
      // as part of every successful upload (see cookie_upload.py), so a
      // just-uploaded slot can't come back revoked in the same response. If it
      // somehow did, the generic branches above still produce a sane message.

      if (isBroken) {
        setUploadProblem(message);
        push("warn", `Slot ${slotName} saved, but it needs a fresh export.`);
      } else if (st === "session_only") {
        push("warn", message);
      } else {
        push("ok", message);
      }

      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } catch (e) {
      const m = (e as Error).message;
      setUploadProblem(m);
      push("bad", m);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  return (
    <div
      ref={shellRef}
      style={shellHeight ? { height: shellHeight } : undefined}
      className="flex w-full flex-col overflow-hidden bg-graphite-950 text-text-primary"
    >
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      {/* ===== fixed chrome ===== */}
      <header className="shrink-0 border-b border-graphite-800 px-4 py-3 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
              <Cookie className="h-4 w-4 text-amber-400" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-[17px] font-semibold leading-tight tracking-tight">YouTube cookies</h1>
              <p className="truncate text-[11px] text-text-subtle">
                One Google account per slot; backups take over when the primary fails
              </p>
            </div>
            <div className="ml-auto">
              <Button size="sm" busy={refreshing} disabled={loading} onClick={handleRefresh}>
                <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} aria-hidden />
                Refresh
              </Button>
            </div>
          </div>

          {!loading && !error && (
            <div className="af-railless -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-live="polite">
              <Pill label="Slots filled" value={`${presentCount} / 3`} tone={presentCount === 0 ? "alarm" : "plain"} />
              <Pill
                label="Need re-export"
                value={String(brokenSlots.length)}
                tone={brokenSlots.length > 0 ? "alarm" : "plain"}
              />
              <Pill label="Revoked" value={String(revokedCount)} tone={revokedCount > 0 ? "alarm" : "plain"} />
            </div>
          )}
        </div>
      </header>

      {/* ===== the one scrolling region ===== */}
      <main className="af-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          {/* Only fires on definitive failures. */}
          {!loading && brokenSlots.length > 0 && (
            <div className="af-rise flex items-start gap-2.5 rounded-2xl border border-red-500/30 bg-red-500/[0.07] px-3.5 py-3">
              <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-red-400" aria-hidden />
              <p className="text-xs leading-relaxed text-text-muted">
                <span className="font-medium text-red-300">
                  {brokenSlots.map(([name]) => SLOT_LABELS[name] ?? name).join(", ")}
                </span>{" "}
                {brokenSlots.length === 1 ? "needs" : "need"} re-exporting.{" "}
                {revokedCount > 0
                  ? "A revoked slot was confirmed dead by an actual download attempt, not just its expiry date — re-export replaces it immediately."
                  : "Backups only take over after the primary fails, so a dead one stays silent until you need it."}
              </p>
            </div>
          )}

          {/* ===== slots ===== */}
          {loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[148px]" />
              ))}
            </div>
          ) : error ? (
            <Card className="flex flex-col items-center gap-3 px-4 py-8">
              <p className="text-center text-sm text-red-400">Couldn&apos;t load slots: {error}</p>
              <Button size="sm" variant="danger" onClick={handleRefresh}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Try again
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {slotEntries.map(([slotName, info]) => {
                const label = SLOT_LABELS[slotName] ?? slotName.replace("_", " ");
                const slotNumber = slotName.replace("slot_", "");

                if (!info.exists) {
                  return (
                    <button
                      key={slotName}
                      type="button"
                      onClick={() => startUploadFor(slotNumber)}
                      className={cn(
                        "group flex min-h-[148px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-graphite-700 bg-graphite-900/30 p-4 text-center outline-none transition-colors",
                        "hover:border-amber-500/50 hover:bg-graphite-900/60 focus-visible:ring-2 focus-visible:ring-amber-400/70"
                      )}
                    >
                      <Plus className="h-4 w-4 text-text-subtle transition-colors group-hover:text-amber-400" aria-hidden />
                      <span className="text-sm font-medium text-text-muted">{label}</span>
                      <span className="text-[11px] text-text-subtle">Empty · add cookies</span>
                    </button>
                  );
                }

                const status: ExpiryStatus = info.expiry_status ?? "unknown";
                const tone = TONE[status];
                const isBad = tone === "bad";

                return (
                  <div
                    key={slotName}
                    className={cn(
                      "af-rise flex min-h-[148px] flex-col gap-3 rounded-2xl border p-4 transition-colors",
                      isBad ? "border-red-500/30 bg-red-500/[0.05]" : "border-graphite-800 bg-graphite-900/70"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Cookie className={cn("h-4 w-4 shrink-0", isBad ? "text-red-400" : "text-amber-400")} aria-hidden />
                      <span className="truncate text-sm font-medium">{label}</span>
                    </div>

                    <span
                      className={cn(
                        "self-start rounded-md border px-2 py-1 text-[11px] font-medium tabular-nums",
                        CHIP_CLASSES[tone]
                      )}
                    >
                      {chipText(info)}
                    </span>

                    <dl className="mt-auto flex flex-col gap-1 text-[11px]">
                      {info.expires_at != null && (
                        <Row label="Expires" value={formatDate(info.expires_at)} />
                      )}
                      {/* The count backing the expiry/revoked read above. A
                          1.8 KB file with 3 auth cookies against siblings at
                          3+ KB / 8 cookies is visible at a glance instead of
                          only discoverable by diffing file sizes. */}
                      {info.critical_cookies_found != null && (
                        <Row label="Auth cookies" value={String(info.critical_cookies_found)} />
                      )}
                      <Row label="Size" value={info.size_bytes ? formatFileSize(info.size_bytes) : "—"} />
                      {info.last_modified && (
                        <Row label="Added" value={formatRelativeTime(info.last_modified)} />
                      )}
                    </dl>

                    {/* The actual yt-dlp warning that triggered revocation, when
                        the backend captured one. Kept out of the <dl> above:
                        that's a fixed label/value grid, and this is prose that
                        can run longer than a value column holds. */}
                    {status === "revoked" && info.revoked_reason && (
                      <p className="line-clamp-2 border-t border-red-500/20 pt-2 text-[11px] leading-snug text-red-300/80">
                        {info.revoked_reason}
                      </p>
                    )}

                    <Button size="sm" className="w-full" onClick={() => startUploadFor(slotNumber)}>
                      <Upload className="h-3.5 w-3.5" aria-hidden />
                      Replace
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ===== upload ===== */}
          <Card className="p-4 sm:p-5" >
            <div ref={uploadPanelRef} className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Add cookies</p>
              <div className="flex items-center gap-2">
                <label htmlFor="slot-select" className="sr-only">
                  Slot
                </label>
                <SectionLabel>Slot</SectionLabel>
                <div className="relative">
                  <select
                    id="slot-select"
                    value={selectedSlot}
                    onChange={(e) => setSelectedSlot(e.target.value)}
                    disabled={uploading}
                    className={cn(
                      "h-9 appearance-none rounded-lg border border-graphite-700 bg-graphite-850/80 pl-3 pr-8 text-[13px] text-text-primary outline-none transition-colors",
                      "hover:border-graphite-600 focus-visible:border-amber-500/50 focus-visible:ring-2 focus-visible:ring-amber-500/20 disabled:opacity-50"
                    )}
                  >
                    <option value="1">Primary</option>
                    <option value="2">Backup 1</option>
                    <option value="3">Backup 2</option>
                  </select>
                  <ChevronRight
                    className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-90 text-text-subtle"
                    aria-hidden
                  />
                </div>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleUpload();
              }}
              className="mt-3 flex flex-col gap-3"
            >
              {!file ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const dropped = e.dataTransfer.files?.[0] ?? null;
                    if (dropped) pickFile(dropped);
                  }}
                  className={cn(
                    "flex w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-7 outline-none transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-amber-400/70",
                    isDragging
                      ? "border-amber-500 bg-amber-500/[0.07]"
                      : "border-graphite-700 bg-graphite-850/60 hover:border-graphite-600 hover:bg-graphite-850"
                  )}
                >
                  <Upload className={cn("h-5 w-5", isDragging ? "text-amber-400" : "text-text-subtle")} aria-hidden />
                  <span className="text-xs text-text-primary">
                    <span className="font-medium">Choose a file</span> or drop it here
                  </span>
                  <span className="text-[11px] text-text-subtle">cookies.txt · one Google account per slot</span>
                </button>
              ) : (
                <div className="flex flex-col gap-2 rounded-xl border border-graphite-700 bg-graphite-850/80 px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <FileText className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-text-primary">{file.name}</p>
                      <p className="text-[11px] tabular-nums text-text-subtle">
                        {uploading
                          ? uploadProgress < 100
                            ? `Uploading ${uploadProgress}%`
                            : "Checking file…"
                          : formatFileSize(file.size)}
                      </p>
                    </div>
                    {!uploading && (
                      <button
                        type="button"
                        onClick={() => pickFile(null)}
                        aria-label="Remove file"
                        className="rounded p-1 text-text-subtle outline-none transition-colors hover:bg-graphite-800 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-400/70"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                  </div>
                  {uploading && (
                    <div
                      className="h-1 w-full overflow-hidden rounded-full bg-graphite-800"
                      role="progressbar"
                      aria-valuenow={uploadProgress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full bg-amber-500 transition-[width] duration-150 ease-out"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              <Button type="submit" variant="primary" busy={uploading} disabled={!file} className="self-start">
                {uploading ? "Saving…" : "Save to slot"}
              </Button>

              {/* Problems persist; successes went to a toast. */}
              {uploadProblem && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/[0.07] px-3 py-2 text-xs leading-relaxed text-red-300">
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="flex-1">{uploadProblem}</span>
                  <button
                    type="button"
                    onClick={() => setUploadProblem(null)}
                    aria-label="Dismiss"
                    className="rounded p-0.5 opacity-60 outline-none transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-current"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              )}
            </form>
          </Card>

          {/* The caveat that used to be three paragraphs. Collapsed by default —
              it matters when you're reading a chip, not every time you land here. */}
          {!loading && !error && (
            <details className="group rounded-2xl border border-graphite-800 bg-graphite-900/40">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-2xl px-3.5 py-2.5 text-[11px] text-text-subtle outline-none transition-colors hover:text-text-muted focus-visible:ring-2 focus-visible:ring-amber-400/70">
                <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" aria-hidden />
                Why no slot is marked &ldquo;valid&rdquo;
              </summary>
              <p className="px-3.5 pb-3 pl-8 text-[11px] leading-relaxed text-text-subtle">
                The expiry date is read from the file itself, so it only tells you whether the clock has run out —
                Google can revoke a session server-side without changing that date.{" "}
                <span className="text-text-muted">Revoked</span> means the opposite kind of evidence: an actual
                download attempt confirmed YouTube rejected the session, which is stronger than any date but only
                ever found out about a slot after it was used. A revoked primary shows up as a Discord alert the
                next time it runs; a revoked backup can stay silent until failover, since standby slots are rarely
                used at all.
              </p>
            </details>
          )}
        </div>
      </main>

      <ToastStack toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-text-subtle">{label}</dt>
      <dd className="tabular-nums text-text-muted">{value}</dd>
    </div>
  );
}