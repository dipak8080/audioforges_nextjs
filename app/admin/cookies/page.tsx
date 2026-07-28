"use client";

import { useCallback, useEffect, useState } from "react";
import { Cookie, RefreshCw, Upload, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

interface CookieSlot {
  exists: boolean;
  path: string;
  size_bytes?: number;
  last_modified?: number;
}

type SlotMap = Record<string, CookieSlot>;

const SLOT_LABELS: Record<string, string> = {
  slot_1: "Slot 1 · Primary",
  slot_2: "Slot 2 · Backup",
  slot_3: "Slot 3 · Backup",
};

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

export default function AdminCookiesPage() {
  const [slots, setSlots] = useState<SlotMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedSlot, setSelectedSlot] = useState("1");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ ok: boolean; message: string } | null>(null);

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

  async function handleRefresh() {
    setRefreshing(true);
    await load();
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append("slot", selectedSlot);
      formData.append("file", file);
      const res = await fetch("/api/admin/cookies", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Server returned ${res.status}`);
      setUploadResult({ ok: true, message: `Uploaded ${(data.bytes_written / 1024).toFixed(1)} KB to slot ${data.slot}.` });
      setFile(null);
      await load();
    } catch (e) {
      setUploadResult({ ok: false, message: (e as Error).message });
    } finally {
      setUploading(false);
    }
  }

  const presentCount = slots ? Object.values(slots).filter((s) => s.exists).length : 0;

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
        <p className="text-xs sm:text-sm text-text-muted">
          {loading ? "Loading…" : `${presentCount} of 3 rotating cookie accounts configured.`}
        </p>
      </div>

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
          {Object.entries(slots).map(([slotName, info]) => (
            <div
              key={slotName}
              className={`rounded-lg border p-3.5 flex flex-col gap-2.5 ${
                info.exists
                  ? "border-graphite-800 bg-graphite-900"
                  : "border-graphite-800/60 bg-graphite-900/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Cookie className={`h-4 w-4 shrink-0 ${info.exists ? "text-amber-500" : "text-text-subtle"}`} />
                  <span className="text-sm font-medium truncate">
                    {SLOT_LABELS[slotName] ?? slotName.replace("_", " ")}
                  </span>
                </div>
                {info.exists ? (
                  <CheckCircle2 className="h-4 w-4 text-teal-400 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500/70 shrink-0" />
                )}
              </div>

              {info.exists ? (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs text-text-subtle">Size</span>
                    <span className="text-xs text-text-primary tabular-nums font-medium">
                      {info.size_bytes ? `${(info.size_bytes / 1024).toFixed(1)} KB` : "—"}
                    </span>
                  </div>
                  {info.last_modified && (
                    <div className="flex items-center gap-1.5 text-xs text-text-subtle" title={formatAbsoluteTime(info.last_modified)}>
                      <Clock className="h-3 w-3" />
                      <span>Updated {formatRelativeTime(info.last_modified)}</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-text-subtle">Not uploaded yet</p>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {/* Upload form */}
      <div className="rounded-lg border border-graphite-800 bg-graphite-900 p-4 sm:p-5">
        <p className="text-sm font-medium mb-1">Upload cookies.txt</p>
        <p className="text-xs text-text-muted mb-3">
          Export from your browser's cookie extension and upload here — no SSH needed.
        </p>
        <form onSubmit={handleUpload} className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedSlot}
              onChange={(e) => setSelectedSlot(e.target.value)}
              className="rounded-md border border-graphite-700 bg-graphite-850 px-2.5 py-2 text-sm text-text-primary focus:outline-none focus:border-amber-500/60 sm:w-44"
            >
              <option value="1">Slot 1 (Primary)</option>
              <option value="2">Slot 2 (Backup)</option>
              <option value="3">Slot 3 (Backup)</option>
            </select>
            <input
              type="file"
              accept=".txt"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="flex-1 rounded-md border border-graphite-700 bg-graphite-850 px-2.5 py-2 text-sm text-text-primary file:mr-3 file:rounded file:border-0 file:bg-graphite-800 file:px-2.5 file:py-1 file:text-xs file:text-text-muted focus:outline-none focus:border-amber-500/60"
            />
          </div>
          <button
            type="submit"
            disabled={!file || uploading}
            className="self-start flex items-center gap-1.5 rounded-md bg-amber-500 text-graphite-950 px-3.5 py-2 text-xs font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploading ? "Uploading…" : "Upload"}
          </button>
          {uploadResult && (
            <p className={`text-xs ${uploadResult.ok ? "text-teal-400" : "text-red-500"}`}>{uploadResult.message}</p>
          )}
        </form>
      </div>
    </div>
  );
}