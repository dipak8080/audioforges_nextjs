"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Cookie,
  RefreshCw,
  Upload,
  Loader2,
  XCircle,
  Clock,
  FileText,
  X,
  AlertTriangle,
  ShieldAlert,
  Info,
} from "lucide-react";

interface CookieSlot {
  exists: boolean;
  path: string;
  size_bytes?: number;
  last_modified?: number;
  // From _parse_cookie_expiry() on the backend. NOTE what this is and
  // isn't - see EXPIRY_PRESENTATION below and the footnote rendered near
  // the bottom of the page: it is the expiry DATE written into the file
  // at export time, nothing more.
  expires_at?: number | null;
  expires_in_days?: number | null;
  expiry_status?: ExpiryStatus;
  critical_cookies_found?: number;
}

type ExpiryStatus =
  | "ok"
  | "warning"
  | "critical"
  | "expired"
  | "missing"
  | "no_auth_cookies"
  | "session_only"
  | "unknown";

type SlotMap = Record<string, CookieSlot>;

const SLOT_LABELS: Record<string, string> = {
  slot_1: "Slot 1 · Primary",
  slot_2: "Slot 2 · Backup",
  slot_3: "Slot 3 · Backup",
};

/**
 * WORDING IS DELIBERATE - an earlier version of this page labelled a
 * future-dated file "Session valid" in green with a checkmark. That
 * claims more than the data supports, in the one direction that
 * actually costs something.
 *
 * The expiry date is a STATIC string written into cookies.txt at export
 * time. If Google revokes the session server-side - password change,
 * security event, too many IPs on one account - that date does not
 * change. The file still reads Aug 2027. A green "valid" badge on a
 * dead cookie is worse than no badge at all, because it actively argues
 * against investigating.
 *
 * So: only states that are DEFINITIVE get a colour and a verdict.
 *
 *   expired / no_auth_cookies -> red. Certain. The file cannot work.
 *   everything else           -> neutral. Reports the date, claims nothing.
 *
 * Server-side revocation is caught by the Discord alert instead (see
 * _maybe_alert_cookie_expiry in youtube.py), which fires on yt-dlp's own
 * "cookies are no longer valid" warning during a real download - the
 * only thing that can actually confirm a session works. This page covers
 * the half of the problem that alert structurally cannot: an account
 * whose clock ran out while sitting unused in a backup slot.
 */
const EXPIRY_PRESENTATION: Record<
  ExpiryStatus,
  { label: string; tone: "warn" | "bad" | "muted"; detail: string }
> = {
  ok: {
    label: "Expires",
    tone: "muted",
    detail:
      "The expiry date on this file hasn't passed. This does not confirm the session still works - Google can revoke it server-side without changing this date.",
  },
  warning: {
    label: "Expires soon",
    tone: "warn",
    detail: "Under two weeks left. Re-export this account when convenient.",
  },
  critical: {
    label: "Expires imminently",
    tone: "bad",
    detail: "Days left, not weeks. Re-export this account now.",
  },
  expired: {
    label: "Expired",
    tone: "bad",
    detail:
      "The expiry date has passed. This account will fail the moment it's used. Re-export from a logged-in browser session.",
  },
  no_auth_cookies: {
    label: "No auth cookies",
    tone: "bad",
    detail:
      "The file parsed but contains no session cookies at all - most likely a logged-out export.",
  },
  session_only: {
    label: "No expiry set",
    tone: "warn",
    detail:
      "Auth cookies are present but session-scoped, so there's no date to check. They died whenever the exporting browser session did.",
  },
  unknown: {
    label: "Unreadable",
    tone: "muted",
    detail: "Couldn't parse an expiry date out of this file.",
  },
  missing: { label: "Not uploaded", tone: "muted", detail: "No file in this slot." },
};

const TONE_CLASSES = {
  warn: "border-amber-500/30 bg-amber-500/5 text-amber-500",
  bad: "border-red-500/30 bg-red-500/5 text-red-500",
  muted: "border-graphite-700 bg-graphite-850 text-text-muted",
} as const;

// States where the file is definitively unusable. Only these drive the
// red banner and the header count - everything else is unknown, not
// good, and shouldn't be counted in either direction.
const DEFINITELY_BROKEN: ExpiryStatus[] = ["expired", "no_auth_cookies"];

function formatRelativeTime(unixSeconds: number): string {
  const diffMs = Date.now() - unixSeconds * 1000;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth}mo ago`;
}

function formatAbsoluteTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

// "364.6 days" is noise; "12mo" is what you reason about. Negative
// values render as elapsed time, since for an expired account "how long
// ago" is the operationally interesting number.
function formatExpiryWindow(days: number | null | undefined): string {
  if (days == null) return "-";
  const abs = Math.abs(days);
  let text: string;
  if (abs < 1) text = `${Math.round(abs * 24)}h`;
  else if (abs < 60) text = `${Math.round(abs)}d`;
  else text = `${Math.round(abs / 30)}mo`;
  return days < 0 ? `${text} ago` : text;
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
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
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

  useEffect(() => {
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
  }

  function pickFile(f: File | null) {
    setUploadResult(null);
    if (dismissTimer.current) clearTimeout(dismissTimer.current);

    if (f && !f.name.toLowerCase().endsWith(".txt")) {
      setUploadResult({
        ok: false,
        message: "Please choose a .txt cookies file exported from your browser.",
      });
      setFile(null);
      return;
    }
    setFile(f);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0] ?? null;
    if (dropped) pickFile(dropped);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

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

      // Backend parses expiry at upload time, so an already-dead or
      // logged-out export is caught here rather than during an outage.
      // Phrased as a date, not a verdict - same reasoning as
      // EXPIRY_PRESENTATION above.
      let suffix = "";
      const st = data?.expiry_status as ExpiryStatus | undefined;
      if (st === "expired") {
        suffix =
          " - but this export is already past its expiry date. Re-export from a logged-in session.";
      } else if (st === "no_auth_cookies") {
        suffix = " - but no auth cookies were found. This looks like a logged-out export.";
      } else if (data?.expires_in_days != null) {
        suffix = ` - expires in ${formatExpiryWindow(data.expires_in_days)}.`;
      }

      const isBroken = st != null && DEFINITELY_BROKEN.includes(st);
      setUploadResult({
        ok: !isBroken,
        message: `Uploaded ${formatFileSize(data.bytes_written)} to slot ${data.slot}${suffix}`,
      });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
      // Problems stay on screen; clean uploads auto-dismiss.
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

  const slotEntries = slots ? Object.entries(slots) : [];
  const presentCount = slotEntries.filter(([, s]) => s.exists).length;
  const brokenSlots = slotEntries.filter(
    ([, s]) => s.exists && s.expiry_status != null && DEFINITELY_BROKEN.includes(s.expiry_status)
  );

  return (
    <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-4 sm:py-5 flex-1 min-h-0 overflow-y-auto scrollbar-thin flex flex-col gap-5">
      <div>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">YouTube Cookies</h1>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-md border border-graphite-700 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary hover:bg-graphite-900 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
        {/* Counts files, and files past expiry. Deliberately does NOT
            say "valid" - see EXPIRY_PRESENTATION. */}
        <p className="text-xs sm:text-sm text-text-muted">
          {loading
            ? "Loading…"
            : brokenSlots.length === 0
              ? `${presentCount} of 3 slots filled · none past expiry`
              : `${presentCount} of 3 slots filled · ${brokenSlots.length} past expiry`}
        </p>
      </div>

      {/* Only fires on definitive states. Backup slots are reached only
          after the primary is disabled, so an expired one causes no
          visible symptom until the moment it's needed. */}
      {!loading && brokenSlots.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3.5 flex gap-2.5">
          <ShieldAlert className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <div className="text-xs text-text-primary leading-relaxed">
            <p className="font-medium text-red-500 mb-1">
              {brokenSlots.length === 1 ? "1 account needs" : `${brokenSlots.length} accounts need`}{" "}
              re-exporting
            </p>
            <p className="text-text-muted">
              {brokenSlots
                .map(
                  ([name, s]) =>
                    `${SLOT_LABELS[name] ?? name} (${EXPIRY_PRESENTATION[
                      s.expiry_status ?? "unknown"
                    ].label.toLowerCase()})`
                )
                .join(", ")}
              . Backup slots are only used after the primary is disabled, so a dead one stays
              silent until the moment it&apos;s needed.
            </p>
          </div>
        </div>
      )}

      {/* Status cards */}
      {loading ? (
        <div className="rounded-lg border border-graphite-800 bg-graphite-900 flex items-center gap-2 text-text-subtle text-sm py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-graphite-800 bg-graphite-900 py-8">
          <p className="text-sm text-red-500 text-center px-4">Failed to load: {error}</p>
        </div>
      ) : slots ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {slotEntries.map(([slotName, info]) => {
            const status: ExpiryStatus = info.exists ? (info.expiry_status ?? "unknown") : "missing";
            const presentation = EXPIRY_PRESENTATION[status];
            const isBad = presentation.tone === "bad";

            return (
              <div
                key={slotName}
                className={`rounded-lg border p-3.5 flex flex-col gap-2.5 transition-colors ${
                  isBad
                    ? "border-red-500/30 bg-red-500/5"
                    : info.exists
                      ? "border-graphite-800 bg-graphite-900"
                      : "border-graphite-800/60 bg-graphite-900/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Cookie
                      className={`h-4 w-4 shrink-0 ${
                        isBad ? "text-red-500" : info.exists ? "text-amber-500" : "text-text-subtle"
                      }`}
                    />
                    <span className="text-sm font-medium truncate">
                      {SLOT_LABELS[slotName] ?? slotName.replace("_", " ")}
                    </span>
                  </div>
                  {/* No green tick for a merely future-dated file - a
                      checkmark reads as "verified working", which is
                      exactly the claim this page cannot make. Only
                      definitive problems get an icon. */}
                  {isBad ? (
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                  ) : !info.exists ? (
                    <XCircle className="h-4 w-4 text-text-subtle shrink-0" />
                  ) : null}
                </div>

                <div
                  className={`rounded border px-2 py-1 text-[11px] font-medium inline-flex items-center gap-1.5 self-start ${
                    TONE_CLASSES[presentation.tone]
                  }`}
                  title={presentation.detail}
                >
                  {presentation.label}
                  {info.expires_in_days != null && (
                    <span className="tabular-nums opacity-80">
                      · {formatExpiryWindow(info.expires_in_days)}
                    </span>
                  )}
                </div>

                {info.exists ? (
                  <>
                    {info.expires_at != null && (
                      <div
                        className="flex items-center gap-1.5 text-xs text-text-subtle"
                        title={`Auth cookies carry an expiry of ${formatAbsoluteTime(info.expires_at)}`}
                      >
                        <Clock className="h-3 w-3" />
                        <span>{formatAbsoluteTime(info.expires_at)}</span>
                      </div>
                    )}
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs text-text-subtle">Size</span>
                      <span className="text-xs text-text-primary tabular-nums font-medium">
                        {info.size_bytes ? formatFileSize(info.size_bytes) : "-"}
                      </span>
                    </div>
                    {info.last_modified && (
                      <div
                        className="flex items-center gap-1.5 text-xs text-text-subtle"
                        title={formatAbsoluteTime(info.last_modified)}
                      >
                        <Clock className="h-3 w-3" />
                        <span>Uploaded {formatRelativeTime(info.last_modified)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-text-subtle">Not uploaded yet</p>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* States plainly what this page can and cannot tell you, so the
          absence of a red badge is never mistaken for a health check. */}
      {!loading && !error && (
        <div className="rounded-lg border border-graphite-800 bg-graphite-900/50 p-3 flex gap-2.5">
          <Info className="h-3.5 w-3.5 text-text-subtle shrink-0 mt-0.5" />
          <p className="text-[11px] text-text-subtle leading-relaxed">
            These dates come from the cookie files themselves and only tell you whether the clock
            has run out. Google can revoke a session server-side - password change, security event,
            too many IPs on one account - without the date changing, so a slot with time left is
            not confirmed working. A revoked <span className="text-text-muted">primary</span> shows
            up as a Discord alert the next time it&apos;s used; a revoked{" "}
            <span className="text-text-muted">backup</span> stays silent until failover happens.
          </p>
        </div>
      )}

      {/* Upload form */}
      <div className="rounded-lg border border-graphite-800 bg-graphite-900 p-4 sm:p-5">
        <p className="text-sm font-medium mb-1">Upload cookies.txt</p>
        <p className="text-xs text-text-muted mb-3">
          Export from your browser&apos;s cookie extension and upload here - no SSH needed. Use a{" "}
          <span className="text-text-primary">different Google account per slot</span> so a single
          revoked account can&apos;t take all three down at once.
        </p>

        <form onSubmit={handleUpload} className="flex flex-col gap-3">
          <select
            value={selectedSlot}
            onChange={(e) => setSelectedSlot(e.target.value)}
            disabled={uploading}
            className="rounded-md border border-graphite-700 bg-graphite-850 px-2.5 py-2 text-sm text-text-primary focus:outline-none focus:border-amber-500/60 sm:w-48 disabled:opacity-60"
          >
            <option value="1">Slot 1 (Primary)</option>
            <option value="2">Slot 2 (Backup)</option>
            <option value="3">Slot 3 (Backup)</option>
          </select>

          {!file ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              className={`rounded-md border border-dashed px-4 py-6 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                isDragging
                  ? "border-amber-500 bg-amber-500/5"
                  : "border-graphite-700 bg-graphite-850 hover:border-graphite-600 hover:bg-graphite-800/60"
              }`}
            >
              <Upload className={`h-5 w-5 ${isDragging ? "text-amber-500" : "text-text-subtle"}`} />
              <p className="text-xs text-text-primary">
                <span className="font-medium">Click to browse</span> or drag a .txt file here
              </p>
              <p className="text-[11px] text-text-subtle">Exported cookies.txt only</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </div>
          ) : (
            <div className="rounded-md border border-graphite-700 bg-graphite-850 px-3 py-2.5 flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <FileText className="h-4 w-4 text-amber-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-text-primary truncate">{file.name}</p>
                  <p className="text-[11px] text-text-subtle">
                    {uploading ? `Uploading… ${uploadProgress}%` : formatFileSize(file.size)}
                  </p>
                </div>
                {!uploading && (
                  <button
                    type="button"
                    onClick={() => pickFile(null)}
                    className="p-1 rounded text-text-subtle hover:text-text-primary hover:bg-graphite-800 transition-colors"
                    aria-label="Remove file"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {uploading && (
                <div className="h-1.5 w-full rounded-full bg-graphite-800 overflow-hidden">
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
            className="self-start flex items-center gap-1.5 rounded-md bg-amber-500 text-graphite-950 px-3.5 py-2 text-xs font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {uploading ? `Uploading… ${uploadProgress}%` : "Upload"}
          </button>

          {uploadResult && (
            <div
              className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs transition-opacity ${
                uploadResult.ok
                  ? "border-graphite-700 bg-graphite-850 text-text-muted"
                  : "border-red-500/30 bg-red-500/5 text-red-500"
              }`}
            >
              {uploadResult.ok ? (
                <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
              ) : (
                <XCircle className="h-3.5 w-3.5 shrink-0 mt-px" />
              )}
              <span>{uploadResult.message}</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}