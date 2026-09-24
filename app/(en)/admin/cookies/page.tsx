"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Cookie,
  FileText,
  Loader2,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { RefreshControl } from "../_components/RefreshControl";
import { StickyHeader, onScrollToggle } from "../_components/StickyHeader";

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
  // cookie_health.apply_to() on the backend. Google can kill a session
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
  // The runtime confirmed YouTube rejected this session. The only status not
  // derived from the file's own expiry date: a slot can show "revoked" while
  // expires_in_days still reads 365.
  | "revoked";

type SlotMap = Record<string, CookieSlot>;
type Tone = "warn" | "bad" | "muted";

interface TrafficAccount {
  path: string;
  successes: number;
  failures: number;
  success_rate: number | null;
  seconds_since_success: number | null;
  last_failure_kind: string | null;
  last_used_via: string | null;
  status?: string;
  recent_success_rate?: number | null;
  rotation?: string;
}

interface TrafficData {
  uptime_seconds: number | null;
  accounts: TrafficAccount[];
}

/** cookies.txt -> slot_1, cookies_2.txt -> slot_2, cookies_3.txt -> slot_3 */
function trafficForSlot(traffic: TrafficData | null, slotName: string): TrafficAccount | null {
  if (!traffic) return null;
  const n = slotName.replace("slot_", "");
  const file = n === "1" ? "cookies.txt" : `cookies_${n}.txt`;
  return traffic.accounts.find((a) => a.path.endsWith(`/${file}`) || a.path === file) ?? null;
}

type TrafficTone = Tone | "good";

/**
 * Rate thresholds: >=85 healthy, 60-85 degrading, <60 refresh today. Under 5
 * total attempts the rate is noise (one failure reads as 0%), so it stays
 * muted with a "too few tries" hint instead of shouting red at an idle backup.
 */
function trafficRead(a: TrafficAccount): { label: string; tone: TrafficTone; pct: number; lowData: boolean } {
  const total = a.successes + a.failures;
  if (total === 0) return { label: "Not used yet", tone: "muted", pct: 0, lowData: true };
  const pct = a.success_rate ?? Math.round((a.successes / total) * 1000) / 10;
  const label = `${pct}%`;
  if (total < 5) return { label, tone: "muted", pct, lowData: true };
  if (pct >= 85) return { label, tone: "good", pct, lowData: false };
  if (pct >= 60) return { label, tone: "warn", pct, lowData: false };
  return { label, tone: "bad", pct, lowData: false };
}

function formatUptime(seconds: number | null): string {
  if (seconds == null) return "";
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))} minutes`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
  return `${Math.floor(seconds / 86400)} days`;
}

const TRAFFIC_TEXT: Record<TrafficTone, string> = {
  good: "text-teal-400",
  warn: "text-amber-300",
  bad: "text-red-300",
  muted: "text-text-muted",
};

const TRAFFIC_BAR: Record<TrafficTone, string> = {
  good: "bg-teal-500/80",
  warn: "bg-amber-500/80",
  bad: "bg-red-500/80",
  muted: "bg-graphite-700",
};

interface UploadResponse {
  slot?: string | number;
  expiry_status?: ExpiryStatus;
  expires_in_days?: number | null;
  error?: string;
}

const MAX_UPLOAD_BYTES = 1024 * 1024;

// Slot count comes from the backend (COOKIE_ACCOUNT_SLOTS), so adding a slot
// there needs no change here.
// Enough failures that a run of odd videos can't explain it. Rotation
// already sidelines a slot at this point; this only makes the panel agree.
const MIN_FAILURES_TO_FLAG = 5;

const slotNumber = (slotName: string) => Number(slotName.replace("slot_", "")) || 0;
const slotLabel = (slotName: string) => {
  const n = slotNumber(slotName);
  return n === 1 ? "Primary" : n > 1 ? `Backup ${n - 1}` : slotName.replace("_", " ");
};

/**
 * The expiry date is a static string written into cookies.txt at export time.
 * If Google revokes the session server-side the date does not change, so a
 * future date proves nothing on its own. Only definitive failures get colour;
 * everything else reports the date and claims nothing.
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

const formatFileSize = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);

function formatWindow(days: number | null | undefined): string {
  if (days == null) return "–";
  const abs = Math.abs(days);
  if (abs < 1) return `${Math.round(abs * 24)} hours`;
  if (abs < 60) return `${Math.round(abs)} days`;
  return `${Math.round(abs / 30)} months`;
}

/**
 * One chip, one sentence fragment. Takes the whole slot because the "revoked"
 * case needs revoked_at, which lives beside expires_in_days.
 */
function chipText(info: CookieSlot): string {
  const status = info.expiry_status ?? "unknown";
  switch (status) {
    case "revoked":
      // Says WHEN it was revoked, not "13mo left". The date is still in the
      // facts row below, so nothing is hidden, but the chip's one job is to
      // say what actually happened.
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

const STYLES = `
@keyframes ck-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.ck-rise { animation: ck-rise .24s cubic-bezier(.22,.9,.32,1) both; }
@keyframes ck-toast { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }
.ck-toast { animation: ck-toast .2s cubic-bezier(.22,.9,.32,1) both; }
@keyframes ck-shimmer { 100% { transform: translateX(100%); } }
.ck-skel { position: relative; overflow: hidden; }
.ck-skel::after {
  content: ""; position: absolute; inset: 0; transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / .05), transparent);
  animation: ck-shimmer 1.4s infinite;
}
@media (prefers-reduced-motion: reduce) { .ck-rise, .ck-toast, .ck-skel::after { animation: none !important; } }
`;

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
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2 sm:left-auto sm:w-[24rem]"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "ck-toast pointer-events-auto flex items-start gap-2.5 rounded-xl border p-3 text-[13px] leading-relaxed shadow-2xl shadow-black/40 backdrop-blur",
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

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("ck-skel rounded-2xl bg-graphite-850/70", className)} />;
}

export default function AdminCookiesPage() {
  const [slots, setSlots] = useState<SlotMap | null>(null);
  const [traffic, setTraffic] = useState<TrafficData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const [selectedSlot, setSelectedSlot] = useState("1");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  // Only problems live here. Successes go to a toast.
  const [uploadProblem, setUploadProblem] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadPanelRef = useRef<HTMLDivElement>(null);

  const { toasts, push, dismiss } = useToasts();
  const [scrolled, setScrolled] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
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
    }
    // Traffic health rides along but never blocks the page. The file/expiry
    // view must keep working when /admin/status is briefly unreachable.
    try {
      const res = await fetch("/api/admin/cookies/health", { cache: "no-store" });
      const data = await res.json();
      setTraffic(res.ok ? data : null);
    } catch {
      setTraffic(null);
    } finally {
      setBusy(false);
      setLastUpdated(Date.now());
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key.toLowerCase() === "r") void load();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [load]);

  // Server key order isn't guaranteed; slot order is meaningful here.
  const slotEntries = useMemo(
    () => (slots ? Object.entries(slots).sort(([a], [b]) => slotNumber(a) - slotNumber(b)) : []),
    [slots]
  );
  const presentCount = slotEntries.filter(([, s]) => s.exists).length;
  // A slot is broken when the file says so (expired, revoked, no auth
  // cookies) OR when the runtime has actually proved it: 2026-09-12,
  // Backup 5 sat at 0% over 10 straight bot checks while this panel said
  // "nothing needs your attention", because its expiry date was still a
  // year out. The file's date cannot see a session YouTube is refusing.
  const brokenSlots = slotEntries.filter(([name, s]) => {
    if (!s.exists) return false;
    if (s.expiry_status != null && DEFINITELY_BROKEN.includes(s.expiry_status)) return true;
    const t = trafficForSlot(traffic, name);
    return !!t && t.successes === 0 && t.failures >= MIN_FAILURES_TO_FLAG;
  });
  // Split out for the summary sentence, so "revoked" and "past expiry" aren't
  // conflated: a slot the runtime killed didn't necessarily run out of time.
  const revokedCount = slotEntries.filter(([, s]) => s.expiry_status === "revoked").length;
  const workingCount = presentCount - brokenSlots.length;

  const worstTraffic = useMemo(() => {
    const meaningful = (traffic?.accounts ?? []).filter((a) => a.successes + a.failures >= 5);
    if (meaningful.length === 0) return null;
    return Math.min(...meaningful.map((a) => trafficRead(a).pct));
  }, [traffic]);

  function pickFile(f: File | null) {
    setUploadProblem(null);
    if (f && !f.name.toLowerCase().endsWith(".txt")) {
      setUploadProblem("Choose a .txt file exported from your browser.");
      setFile(null);
      return;
    }
    if (f && f.size > MAX_UPLOAD_BYTES) {
      setUploadProblem("That file is over 1 MB, so it isn't a cookies export.");
      setFile(null);
      return;
    }
    setFile(f);
  }

  function startUploadFor(slot: string) {
    setSelectedSlot(slot);
    uploadPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
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
        message = `Slot ${slotName} saved, with ${formatWindow(data.expires_in_days)} left on the clock.`;
      } else {
        message = `Slot ${slotName} saved.`;
      }
      // "revoked" isn't reachable here: cookie_health is cleared as part of
      // every successful upload (see cookie_upload.py).

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
      onScroll={onScrollToggle(setScrolled)}
      className="scrollbar-thin min-h-0 w-full flex-1 overflow-y-auto"
    >
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <StickyHeader
        title="YouTube cookies"
        subtitle="One Google account per slot. Downloads rotate across the healthy ones."
        scrolled={scrolled}
        condensed={
          !loading && !error ? (
            <span className={cn(brokenSlots.length > 0 && "text-red-300")}>
              {workingCount}/{slotEntries.length} working
              {brokenSlots.length > 0 ? ` · ${brokenSlots.length} to fix` : ""}
            </span>
          ) : null
        }
        actions={<RefreshControl busy={busy} lastUpdated={lastUpdated} onRefresh={() => void load()} />}
      />

      <div className="mx-auto w-full max-w-7xl px-4 pb-6 sm:px-6">
        {!loading && !error && (
          <p className="max-w-2xl text-balance text-[15px] leading-relaxed text-text-body sm:text-base">
            <span className="mr-1.5 text-[28px] font-semibold tabular-nums text-amber-400 sm:text-[32px]">
              {workingCount} of {slotEntries.length}
            </span>
            {workingCount === 1 ? "slot is working" : "slots are working"}.{" "}
            {brokenSlots.length > 0 ? (
              <span className="text-text-muted">
                {brokenSlots.map(([name]) => slotLabel(name)).join(" and ")}{" "}
                {brokenSlots.length === 1 ? "needs" : "need"} a fresh export.
              </span>
            ) : presentCount < slotEntries.length ? (
              <span className="text-text-muted">
                {slotEntries.length - presentCount} slot
                {slotEntries.length - presentCount === 1 ? " is" : "s are"} still empty. Adding one spreads
                downloads across more accounts.
              </span>
            ) : (
              <span className="text-text-muted">Nothing needs your attention right now.</span>
            )}
          </p>
        )}

        {!loading && !error && (
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3" aria-live="polite">
            <div>
              <dt className="text-[12px] text-text-subtle">Slots filled</dt>
              <dd
                className={cn(
                  "text-lg font-semibold tabular-nums",
                  presentCount === 0 ? "text-red-400" : "text-text-primary"
                )}
              >
                {presentCount} of {slotEntries.length}
              </dd>
            </div>
            <div>
              <dt className="text-[12px] text-text-subtle">Need re-export</dt>
              <dd
                className={cn(
                  "text-lg font-semibold tabular-nums",
                  brokenSlots.length > 0 ? "text-red-400" : "text-text-primary"
                )}
              >
                {brokenSlots.length}
              </dd>
            </div>
            {worstTraffic !== null && (
              <div>
                <dt className="text-[12px] text-text-subtle">Worst success rate</dt>
                <dd
                  className={cn(
                    "text-lg font-semibold tabular-nums",
                    worstTraffic < 60 ? "text-red-400" : worstTraffic < 85 ? "text-amber-300" : "text-text-primary"
                  )}
                >
                  {worstTraffic}%
                </dd>
              </div>
            )}
          </dl>
        )}

        {!loading && brokenSlots.length > 0 && (
          <div className="ck-rise mt-4 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/[0.07] px-3.5 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
            <p className="text-[13px] leading-relaxed text-text-muted">
              {revokedCount > 0
                ? "A revoked slot was confirmed dead by a real download attempt, not just its expiry date. Re-exporting replaces it immediately."
                : "A weak account is tried last until you replace it, so downloads keep working meanwhile."}
            </p>
          </div>
        )}

        <section className="mt-5">
          <h2 className="sr-only">Slots</h2>
          {loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[230px]" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-500/25 bg-red-500/[0.06] px-4 py-10">
              <p className="text-center text-sm text-red-300">Slots did not load: {error}</p>
              <Button size="sm" variant="danger" onClick={() => void load()}>
                Try again
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {slotEntries.map(([slotName, info]) => (
                <SlotCard
                  key={slotName}
                  slotName={slotName}
                  info={info}
                  traffic={trafficForSlot(traffic, slotName)}
                  onUpload={() => startUploadFor(String(slotNumber(slotName)))}
                />
              ))}
            </div>
          )}

          {traffic && !loading && !error && (
            <p className="mt-3 text-[12px] leading-relaxed text-text-subtle">
              Success rates are counted since the backend last restarted
              {traffic.uptime_seconds != null ? `, ${formatUptime(traffic.uptime_seconds)} ago` : ""}. They reset on
              every deploy and when you replace a file. Above 85% is healthy, 60 to 85% is slipping, and under 60%
              with a bot check means re-export that account today.
            </p>
          )}
        </section>

        <section
          ref={uploadPanelRef}
          className="mt-5 rounded-2xl border border-graphite-800 bg-graphite-900/70 p-4 sm:p-5"
        >
          <h2 className="text-sm font-semibold">Add cookies</h2>
          <p className="mt-0.5 text-[12px] text-text-subtle">
            Export cookies.txt from a logged-in YouTube tab, then pick which slot it replaces.
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Slot to save into">
            {slotEntries.map(([slotName, info]) => {
              const value = String(slotNumber(slotName));
              const on = value === selectedSlot;
              return (
                <button
                  key={slotName}
                  type="button"
                  aria-pressed={on}
                  disabled={uploading}
                  onClick={() => setSelectedSlot(value)}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] outline-none transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-amber-400/70 disabled:opacity-50",
                    on
                      ? "border-amber-500/50 bg-amber-500/15 text-amber-200"
                      : "border-graphite-700 bg-graphite-850/80 text-text-muted hover:text-text-primary"
                  )}
                >
                  {slotLabel(slotName)}
                  <span className="text-[11px] text-text-subtle">{info.exists ? "replace" : "empty"}</span>
                </button>
              );
            })}
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
                  "flex w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-8 outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-amber-400/70",
                  isDragging
                    ? "border-amber-500 bg-amber-500/[0.07]"
                    : "border-graphite-700 bg-graphite-850/60 hover:border-graphite-600 hover:bg-graphite-850"
                )}
              >
                <Upload className={cn("h-5 w-5", isDragging ? "text-amber-400" : "text-text-subtle")} aria-hidden />
                <span className="text-[13px] text-text-primary">
                  <span className="font-medium">Choose a file</span> or drop it here
                </span>
                <span className="text-[12px] text-text-subtle">cookies.txt, up to 1 MB</span>
              </button>
            ) : (
              <div className="flex flex-col gap-2 rounded-xl border border-graphite-700 bg-graphite-850/80 px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-text-primary">{file.name}</p>
                    <p className="text-[12px] tabular-nums text-text-subtle">
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

            <Button
              type="submit"
              variant="primary"
              busy={uploading}
              disabled={!file}
              className="w-full sm:w-auto sm:self-start"
            >
              {uploading ? "Saving…" : `Save to ${slotLabel(`slot_${selectedSlot}`)}`}
            </Button>

            {/* Problems persist; successes went to a toast. */}
            {uploadProblem && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/[0.07] px-3 py-2 text-[13px] leading-relaxed text-red-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
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
        </section>

        {!loading && !error && (
          <details className="group mt-4 rounded-2xl border border-graphite-800 bg-graphite-900/40">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-2xl px-3.5 py-3 text-[13px] text-text-muted outline-none transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-400/70">
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" aria-hidden />
              Why no slot is ever marked valid
            </summary>
            <p className="px-3.5 pb-4 pl-8 text-[13px] leading-relaxed text-text-subtle">
              The expiry date is read from the file itself, so it only tells you whether the clock has run out.
              Google can revoke a session server-side without changing that date. Revoked means the opposite kind of
              evidence: a real download attempt confirmed YouTube rejected the session, which is stronger than any
              date but only found out after the slot was used. A revoked primary shows up as a Discord alert the next
              time it runs. A revoked backup can stay silent until failover, since standby slots are rarely used.
            </p>
          </details>
        )}
      </div>

      <ToastStack toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

function SlotCard({
  slotName,
  info,
  traffic,
  onUpload,
}: {
  slotName: string;
  info: CookieSlot;
  traffic: TrafficAccount | null;
  onUpload: () => void;
}) {
  const label = slotLabel(slotName);

  if (!info.exists) {
    return (
      <button
        type="button"
        onClick={onUpload}
        className={cn(
          "group flex min-h-[150px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-graphite-700 bg-graphite-900/30 p-4 text-center outline-none transition-colors",
          "hover:border-amber-500/50 hover:bg-graphite-900/60 focus-visible:ring-2 focus-visible:ring-amber-400/70"
        )}
      >
        <Plus className="h-4 w-4 text-text-subtle transition-colors group-hover:text-amber-400" aria-hidden />
        <span className="text-sm font-medium text-text-muted">{label}</span>
        <span className="text-[12px] text-text-subtle">Empty, tap to add cookies</span>
      </button>
    );
  }

  const status: ExpiryStatus = info.expiry_status ?? "unknown";
  const tone = TONE[status];
  const isBad = tone === "bad";
  const read = traffic ? trafficRead(traffic) : null;

  return (
    <div
      className={cn(
        "ck-rise flex flex-col gap-3 rounded-2xl border p-4",
        isBad ? "border-red-500/30 bg-red-500/[0.05]" : "border-graphite-800 bg-graphite-900/70"
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <Cookie className={cn("h-4 w-4 shrink-0", isBad ? "text-red-400" : "text-amber-400")} aria-hidden />
        <span className="text-sm font-medium">{label}</span>
        <span
          className={cn(
            "ml-auto rounded-md border px-2 py-0.5 text-[12px] font-medium tabular-nums",
            CHIP_CLASSES[tone]
          )}
        >
          {chipText(info)}
        </span>
      </div>

      {traffic && read && (
        <div className="rounded-xl border border-graphite-800 bg-graphite-950/40 px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] text-text-subtle">Downloads that worked</span>
            <span className={cn("text-[15px] font-semibold tabular-nums", TRAFFIC_TEXT[read.tone])}>
              {read.label}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-graphite-800">
            <div
              className={cn("h-full rounded-full transition-all", TRAFFIC_BAR[read.tone])}
              style={{ width: `${Math.max(read.pct, 2)}%` }}
            />
          </div>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12px] text-text-subtle">
            <span className="tabular-nums">
              {traffic.successes.toLocaleString()} worked, {traffic.failures.toLocaleString()} failed
            </span>
            {read.lowData && <span>too few tries to judge</span>}
            {traffic.last_failure_kind && (
              <span
                className={cn(traffic.last_failure_kind === "bot_check" && read.tone !== "good" && "text-amber-300")}
              >
                last failure: {traffic.last_failure_kind.replace(/_/g, " ")}
              </span>
            )}
          </p>
          {traffic.rotation === "demoted" && (
            <p className="mt-1.5 text-[12px] text-amber-300">
              Tried last, {traffic.recent_success_rate ?? 0}% worked in the last 2 hours
            </p>
          )}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
        {info.expires_at != null && <Fact label="Expires" value={formatDate(info.expires_at)} />}
        {info.critical_cookies_found != null && (
          // The count backing the expiry read above. A 1.8 KB file with 3 auth
          // cookies beside siblings at 3+ KB and 8 cookies is visible at a
          // glance instead of only by diffing file sizes.
          <Fact label="Auth cookies" value={String(info.critical_cookies_found)} />
        )}
        <Fact label="Size" value={info.size_bytes ? formatFileSize(info.size_bytes) : "–"} />
        {info.last_modified && <Fact label="Added" value={formatRelativeTime(info.last_modified)} />}
      </dl>

      {status === "revoked" && info.revoked_reason && (
        <p className="line-clamp-3 border-t border-red-500/20 pt-2.5 text-[12px] leading-relaxed text-red-300/80">
          {info.revoked_reason}
        </p>
      )}

      <Button size="sm" className="mt-auto w-full" variant={isBad ? "primary" : "ghost"} onClick={onUpload}>
        <Upload className="h-3.5 w-3.5" aria-hidden />
        Replace cookies
      </Button>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-text-subtle">{label}</dt>
      <dd className="truncate tabular-nums text-text-primary">{value}</dd>
    </div>
  );
}