"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Cookie,
  RefreshCw,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  X,
} from "lucide-react";

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

// Wraps XHR in a promise so we get upload progress events, which fetch() can't provide.
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
      setUploadResult({ ok: false, message: "Please choose a .txt cookies file exported from your browser." });
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

      setUploadResult({
        ok: true,
        message: `Uploaded ${formatFileSize(data.bytes_written)} to slot ${data.slot}.`,
      });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
      dismissTimer.current = setTimeout(() => setUploadResult(null), 6000);
    } catch (e) {
      setUploadResult({ ok: false, message: (e as Error).message });
    } finally {
      setUploading(false);
      setUploadProgress(0);
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
              className={`rounded-lg border p-3.5 flex flex-col gap-2.5 transition-colors ${
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
                      {info.size_bytes ? formatFileSize(info.size_bytes) : "—"}
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

          {/* Dropzone / file chip */}
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

              {/* Progress bar */}
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
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploading ? `Uploading… ${uploadProgress}%` : "Upload"}
          </button>

          {uploadResult && (
            <div
              className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs transition-opacity ${
                uploadResult.ok
                  ? "border-teal-400/30 bg-teal-400/5 text-teal-400"
                  : "border-red-500/30 bg-red-500/5 text-red-500"
              }`}
            >
              {uploadResult.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-px" />
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