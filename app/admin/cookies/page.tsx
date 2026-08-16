"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Cookie,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";

interface CookieSlot {
  exists: boolean;
  path: string;
  size_bytes?: number;
  last_modified?: number;
  expires_at?: number | null;
  expires_in_days?: number | null;
  expiry_status?: ExpiryStatus;
  critical_cookies_found?: number;
  // ADDED 2026-08-16: the runtime's own verdict, layered on top of the
  // static expiry date by cookie_health.apply_to() on the backend. See
  // ExpiryStatus's "revoked" case below for why the date alone was never
  // enough - Google can kill a session server-side without touching the
  // file, so a future date proves nothing once revoked_at is present.
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
  // ADDED 2026-08-16: the runtime confirmed YouTube rejected this
  // session (yt-dlp's "cookies are no longer valid" warning, repeated
  // enough times to rule out a one-off flaky check - see
  // cookie_health.py). Distinct from every other status here because
  // it's the only one NOT derived from the file's own expiry date: a
  // slot can show "revoked" while expires_in_days still reads 365.
  // Never overrides "expired" or "no_auth_cookies" - both of those are
  // already terminal and more specific about what's wrong with the file
  // itself.
  | "revoked";

type SlotMap = Record<string, CookieSlot>;
type Tone = "warn" | "bad" | "muted";

const MAX_UPLOAD_BYTES = 1024 * 1024;

const SLOT_LABELS: Record<string, string> = {
  slot_1: "Primary",
  slot_2: "Backup 1",
  slot_3: "Backup 2",
};

/**
 * The expiry date is a static string written into cookies.txt at export time.
 * If Google revokes the session server-side the date does not change, so a
 * future date proves nothing on its own - that gap is exactly what "revoked"
 * exists to close (see cookie_health.py on the backend). Only definitive
 * failures get colour; everything else reports the date and claims nothing.
 * Chip text is self-contained, which is why there is no separate "status
 * label" - one element, one job.
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
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  bad: "border-red-500/30 bg-red-500/10 text-red-400",
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

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatWindow(days: number | null | undefined): string {
  if (days == null) return "-";
  const abs = Math.abs(days);
  if (abs < 1) return `${Math.round(abs * 24)}h`;
  if (abs < 60) return `${Math.round(abs)}d`;
  return `${Math.round(abs / 30)}mo`;
}

/**
 * One chip, one sentence fragment. No label + value duplication.
 *
 * UPDATED 2026-08-16: takes the whole slot instead of (status, days) - the
 * "revoked" case needs revoked_at, which lives alongside expires_in_days on
 * the same object, and threading a third positional param through every
 * call site was worse than just passing what's already in hand.
 */
function chipText(info: CookieSlot): string {
  const status = info.expiry_status ?? "unknown";
  switch (status) {
    case "revoked":
      // Deliberately says WHEN it was revoked, not "13mo left" - the date
      // is still visible lower in the card (see the Expires row) so
      // nothing is hidden, but the chip's one job is to say what actually
      // happened, and "revoked" outranks a clock that never stopped.
      return info.revoked_at != null
        ? `Revoked ${formatRelativeTime(info.revoked_at)}`
        : "Revoked";
    case "expired":
      return info.expires_in_days != null
        ? `Expired ${formatWindow(info.expires_in_days)} ago`
        : "Expired";
    case "no_auth_cookies":
      return "No auth cookies";
    case "session_only":
      return "No expiry set";
    case "unknown":
      return "Date unreadable";
    default:
      return info.expires_in_days != null
        ? `${formatWindow(info.expires_in_days)} left`
        : "Expiry unknown";
  }
}

function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress: (pct: number) => void
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data: any = null;
      try {
        data = JSON.parse(xhr.responseText);
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

export default function AdminCookiesPage() {
  const [slots, setSlots] = useState<SlotMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedSlot, setSelectedSlot] = useState("1");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadPanelRef = useRef<HTMLDivElement>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    load();
  }, [load]);

  useEffect(() => () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
  }, []);

  // Server key order isn't guaranteed; slot order is meaningful here.
  const slotEntries = useMemo(
    () => (slots ? Object.entries(slots).sort(([a], [b]) => a.localeCompare(b)) : []),
    [slots]
  );
  const presentCount = slotEntries.filter(([, s]) => s.exists).length;
  const brokenSlots = slotEntries.filter(
    ([, s]) => s.exists && s.expiry_status != null && DEFINITELY_BROKEN.includes(s.expiry_status)
  );
  // Split out purely for the header sentence below, so "revoked" and
  // "past expiry" aren't conflated into one misleading word - a slot the
  // runtime killed didn't necessarily run out of time, and a slot that
  // ran out of time wasn't necessarily ever confirmed dead in use.
  const revokedCount = slotEntries.filter(([, s]) => s.expiry_status === "revoked").length;

  async function handleRefresh() {
    setRefreshing(true);
    await load();
  }

  function clearResult() {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setUploadResult(null);
  }

  function pickFile(f: File | null) {
    clearResult();
    if (f && !f.name.toLowerCase().endsWith(".txt")) {
      setUploadResult({ ok: false, message: "Choose a .txt file exported from your browser." });
      setFile(null);
      return;
    }
    if (f && f.size > MAX_UPLOAD_BYTES) {
      setUploadResult({ ok: false, message: "That file is over 1 MB — not a cookies export." });
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

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    clearResult();
    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("slot", selectedSlot);
      formData.append("file", file);

      const { status, data } = await uploadWithProgress(
        "/api/admin/cookies",
        formData,
        setUploadProgress
      );
      if (status < 200 || status >= 300) {
        throw new Error(data?.error || `Server returned ${status}`);
      }

      const st = data?.expiry_status as ExpiryStatus | undefined;
      const isBroken = st != null && DEFINITELY_BROKEN.includes(st);

      let message: string;
      if (st === "expired") {
        message = `Slot ${data.slot} saved, but this export is already past its expiry date. Re-export from a logged-in session.`;
      } else if (st === "no_auth_cookies") {
        message = `Slot ${data.slot} saved, but it contains no auth cookies. This looks like a logged-out export.`;
      } else if (st === "session_only") {
        message = `Slot ${data.slot} saved. Cookies are session-scoped, so there's no expiry date to check.`;
      } else if (data?.expires_in_days != null) {
        message = `Slot ${data.slot} saved · ${formatWindow(data.expires_in_days)} left on the clock.`;
      } else {
        message = `Slot ${data.slot} saved.`;
      }
      // NOTE: "revoked" deliberately isn't reachable here. cookie_health
      // is cleared as part of every successful upload (see
      // cookie_upload.py), so a just-uploaded slot can never come back
      // revoked in the same response - if it somehow did, the generic
      // branches above still produce a sane message rather than crashing.

      setUploadResult({ ok: !isBroken, message });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
      if (!isBroken) {
        dismissTimer.current = setTimeout(() => setUploadResult(null), 6000);
      }
    } catch (e) {
      setUploadResult({ ok: false, message: (e as Error).message });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  return (
    <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-5 flex-1 min-h-0 overflow-y-auto scrollbar-thin flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">YouTube cookies</h1>
          <p className="text-xs text-text-muted mt-0.5" aria-live="polite">
            {loading
              ? "Loading…"
              : brokenSlots.length > 0
                ? `${presentCount} of 3 filled · ${brokenSlots.length} need re-export`
                : `${presentCount} of 3 filled`}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          aria-label="Refresh slots"
          className="flex items-center gap-1.5 rounded-md border border-graphite-700 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary hover:bg-graphite-850 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 transition-colors disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Only fires on definitive failures. */}
      {!loading && brokenSlots.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/[0.07] px-3.5 py-3 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-px" />
          <p className="text-xs leading-relaxed text-text-muted">
            <span className="font-medium text-red-400">
              {brokenSlots.map(([name]) => SLOT_LABELS[name] ?? name).join(", ")}
            </span>{" "}
            {brokenSlots.length === 1 ? "needs" : "need"} re-exporting.{" "}
            {revokedCount > 0
              ? "A revoked slot was confirmed dead by an actual download attempt, not just its expiry date - re-export replaces it immediately."
              : "Backups only take over after the primary fails, so a dead one stays silent until you need it."}
          </p>
        </div>
      )}

      {/* Slots */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[132px] rounded-lg border border-graphite-800 bg-graphite-900/60 animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-graphite-800 bg-graphite-900 py-8 px-4 flex flex-col items-center gap-3">
          <p className="text-sm text-red-400 text-center">Couldn&apos;t load slots: {error}</p>
          <button
            onClick={handleRefresh}
            className="rounded-md border border-graphite-700 px-3 py-1.5 text-xs text-text-muted hover:text-text-primary hover:bg-graphite-850 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 transition-colors"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {slotEntries.map(([slotName, info]) => {
            const label = SLOT_LABELS[slotName] ?? slotName.replace("_", " ");
            const slotNumber = slotName.replace("slot_", "");

            if (!info.exists) {
              return (
                <button
                  key={slotName}
                  type="button"
                  onClick={() => startUploadFor(slotNumber)}
                  className="group rounded-lg border border-dashed border-graphite-700 bg-graphite-900/30 p-4 min-h-[132px] flex flex-col items-center justify-center gap-1.5 text-center hover:border-amber-500/50 hover:bg-graphite-900/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 transition-colors"
                >
                  <Plus className="h-4 w-4 text-text-subtle group-hover:text-amber-500 transition-colors" />
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
                className={`rounded-lg border p-4 min-h-[132px] flex flex-col gap-3 transition-colors ${
                  isBad
                    ? "border-red-500/30 bg-red-500/[0.04]"
                    : "border-graphite-800 bg-graphite-900"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Cookie
                    className={`h-4 w-4 shrink-0 ${isBad ? "text-red-400" : "text-amber-500"}`}
                  />
                  <span className="text-sm font-medium truncate">{label}</span>
                </div>

                <span
                  className={`self-start rounded border px-2 py-1 text-[11px] font-medium tabular-nums ${CHIP_CLASSES[tone]}`}
                >
                  {chipText(info)}
                </span>

                <dl className="mt-auto flex flex-col gap-1 text-[11px]">
                  {info.expires_at != null && (
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-text-subtle">Expires</dt>
                      <dd className="text-text-muted tabular-nums">
                        {formatDate(info.expires_at)}
                      </dd>
                    </div>
                  )}
                  {/* ADDED 2026-08-16: the count backing the expiry/revoked
                      read above. A 1.8 KB file with 3 auth cookies against
                      siblings at 3+ KB / 8 cookies is visible at a glance
                      instead of only discoverable by diffing file sizes. */}
                  {info.critical_cookies_found != null && (
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-text-subtle">Auth cookies</dt>
                      <dd className="text-text-muted tabular-nums">
                        {info.critical_cookies_found}
                      </dd>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-text-subtle">Size</dt>
                    <dd className="text-text-muted tabular-nums">
                      {info.size_bytes ? formatFileSize(info.size_bytes) : "-"}
                    </dd>
                  </div>
                  {info.last_modified && (
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-text-subtle">Added</dt>
                      <dd className="text-text-muted tabular-nums">
                        {formatRelativeTime(info.last_modified)}
                      </dd>
                    </div>
                  )}
                </dl>

                {/* ADDED 2026-08-16: the actual yt-dlp warning text that
                    triggered the revocation, when the backend captured
                    one. Kept OUT of the <dl> above (which is a fixed
                    label/value grid) since this is prose, not a field,
                    and can run longer than a value column comfortably
                    holds. */}
                {status === "revoked" && info.revoked_reason && (
                  <p className="text-[11px] text-red-400/80 leading-snug line-clamp-2">
                    {info.revoked_reason}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload */}
      <div
        ref={uploadPanelRef}
        className="rounded-lg border border-graphite-800 bg-graphite-900 p-4 sm:p-5 flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Add cookies</p>
          <div className="flex items-center gap-2">
            <label htmlFor="slot-select" className="text-[11px] text-text-subtle">
              Slot
            </label>
            <select
              id="slot-select"
              value={selectedSlot}
              onChange={(e) => setSelectedSlot(e.target.value)}
              disabled={uploading}
              className="rounded-md border border-graphite-700 bg-graphite-850 px-2 py-1.5 text-xs text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 disabled:opacity-50"
            >
              <option value="1">Primary</option>
              <option value="2">Backup 1</option>
              <option value="3">Backup 2</option>
            </select>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".txt"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />

        <form onSubmit={handleUpload} className="flex flex-col gap-3">
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
              className={`w-full rounded-md border border-dashed px-4 py-6 flex flex-col items-center justify-center gap-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 ${
                isDragging
                  ? "border-amber-500 bg-amber-500/5"
                  : "border-graphite-700 bg-graphite-850 hover:border-graphite-600 hover:bg-graphite-800/60"
              }`}
            >
              <Upload
                className={`h-5 w-5 ${isDragging ? "text-amber-500" : "text-text-subtle"}`}
              />
              <span className="text-xs text-text-primary">
                <span className="font-medium">Choose a file</span> or drop it here
              </span>
              <span className="text-[11px] text-text-subtle">
                cookies.txt · one Google account per slot
              </span>
            </button>
          ) : (
            <div className="rounded-md border border-graphite-700 bg-graphite-850 px-3 py-2.5 flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <FileText className="h-4 w-4 text-amber-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-text-primary truncate">{file.name}</p>
                  <p className="text-[11px] text-text-subtle tabular-nums">
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
                    className="p-1 rounded text-text-subtle hover:text-text-primary hover:bg-graphite-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {uploading && (
                <div
                  className="h-1 w-full rounded-full bg-graphite-800 overflow-hidden"
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

          <button
            type="submit"
            disabled={!file || uploading}
            className="self-start flex items-center gap-1.5 rounded-md bg-amber-500 text-graphite-950 px-3.5 py-2 text-xs font-semibold hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-graphite-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {uploading ? "Saving…" : "Save to slot"}
          </button>

          <div aria-live="polite">
            {uploadResult && (
              <div
                className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs leading-relaxed ${
                  uploadResult.ok
                    ? "border-graphite-700 bg-graphite-850 text-text-muted"
                    : "border-red-500/30 bg-red-500/[0.07] text-red-400"
                }`}
              >
                {!uploadResult.ok && <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />}
                <span>{uploadResult.message}</span>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* The caveat that used to be three paragraphs. Collapsed by default —
          it matters when you're reading a chip, not every time you land here. */}
      {!loading && !error && (
        <details className="group rounded-lg border border-graphite-800 bg-graphite-900/40">
          <summary className="flex items-center gap-1.5 px-3.5 py-2.5 cursor-pointer list-none text-[11px] text-text-subtle hover:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 rounded-lg transition-colors">
            <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
            Why no slot is marked &ldquo;valid&rdquo;
          </summary>
          <p className="px-3.5 pb-3 pl-8 text-[11px] text-text-subtle leading-relaxed">
            The expiry date is read from the file itself, so it only tells you whether the clock
            has run out — Google can revoke a session server-side without changing that date.{" "}
            <span className="text-text-muted">Revoked</span> means the opposite kind of
            evidence: an actual download attempt confirmed YouTube rejected the session, which is
            stronger than any date but only ever found out about a slot after it was used. A
            revoked primary shows up as a Discord alert the next time it runs; a revoked backup
            can still stay silent until failover, since standby slots are rarely used at all.
          </p>
        </details>
      )}
    </div>
  );
}