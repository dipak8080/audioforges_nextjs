import { ApiError, RAILWAY_API_BASE, fetchWithTimeout, submitJob } from "@/lib/api/railway";
import type { InputSource, StemOutput, StudioSelection } from "./presets";

export type StudioEngine = "one" | "studio";
export type RunFamily = "separate" | "stems" | "youtube/separate" | "youtube/stems";

export interface StartedRun {
  jobId: string;
  family: RunFamily;
  engine: StudioEngine;
}

export interface RunStatus {
  status: "processing" | "complete" | "failed";
  stems: string[];
  error: string | null;
  title: string | null;
  elapsed: number;
  clip: { start: number; seconds: number } | null;
}

export interface SubmitInput {
  engine: StudioEngine;
  source: { kind: "file"; file: File } | { kind: "link"; url: string };
  selection: StudioSelection;
}

export function familyFor(output: StemOutput, source: InputSource): RunFamily {
  const base = output === 2 ? "separate" : "stems";
  return (source === "link" ? `youtube/${base}` : base) as RunFamily;
}

export async function submitRun(input: SubmitInput, signal: AbortSignal, idempotencyKey: string): Promise<StartedRun> {
  const { engine, source, selection } = input;
  const studio = engine === "studio";
  const output: StemOutput = !studio && selection.output === 6 ? 4 : selection.output;
  const family = familyFor(output, source.kind);
  const fd = new FormData();
  if (source.kind === "file") fd.append("file", source.file);
  else fd.append("url", source.url);
  if (studio) {
    if (selection.dereverb) fd.append("dereverb", "true");
    if (selection.leadBack) fd.append("lead_back", "true");
    if (family.endsWith("stems")) fd.append("stem_count", String(output === 6 ? 6 : 4));
  }
  const endpoint = studio ? `${family}-hq` : family;
  const timeout = source.kind === "file" ? 180_000 : 30_000;
  const res = await submitJob(endpoint, fd, timeout, { signal }, true, idempotencyKey);
  return { jobId: res.job_id, family, engine };
}

export async function getRunStatus(run: StartedRun, signal?: AbortSignal): Promise<RunStatus> {
  const res = await fetchWithTimeout(`${RAILWAY_API_BASE}/${run.family}/status/${run.jobId}`, { method: "GET", signal }, 15_000);
  if (res.status === 404) {
    return { status: "failed", stems: [], error: null, title: null, elapsed: 0, clip: null };
  }
  if (!res.ok) throw new ApiError("Status check failed", res.status, { isServerBusy: res.status >= 500 });
  const d = await res.json();
  const status = d?.status === "complete" || d?.status === "failed" ? d.status : "processing";
  const list: string[] = Array.isArray(d?.stems)
    ? d.stems
    : ["vocals", "instrumental", ...(Array.isArray(d?.extra_stems) ? d.extra_stems : [])];
  return {
    status,
    stems: Array.from(new Set(list.filter((s): s is string => typeof s === "string"))),
    error: typeof d?.error === "string" ? d.error : null,
    title: typeof d?.title === "string" ? d.title : null,
    elapsed: typeof d?.elapsed_seconds === "number" ? d.elapsed_seconds : 0,
    clip:
      typeof d?.clip?.start === "number" && typeof d?.clip?.seconds === "number"
        ? { start: d.clip.start, seconds: d.clip.seconds }
        : null,
  };
}

export function stemPreviewUrl(run: StartedRun, stem: string): string {
  return `${RAILWAY_API_BASE}/${run.family}/preview/${run.jobId}?stem=${encodeURIComponent(stem)}`;
}

export function stemDownloadUrl(run: StartedRun, stem: string, format: "wav" | "mp3" = "wav"): string {
  const url = `${RAILWAY_API_BASE}/${run.family}/download/${run.jobId}?stem=${encodeURIComponent(stem)}`;
  return format === "mp3" ? `${url}&format=mp3` : url;
}

const STEM_ORDER = [
  "vocals",
  "lead_vocals",
  "backing_vocals",
  "vocals_dry",
  "instrumental",
  "drums",
  "bass",
  "guitar",
  "piano",
  "other",
];

export function sortStems(stems: string[]): string[] {
  const rank = (s: string) => {
    const i = STEM_ORDER.indexOf(s);
    return i < 0 ? STEM_ORDER.length : i;
  };
  return [...stems].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

export function expectedStems(selection: StudioSelection, engine: StudioEngine): string[] {
  const out = engine === "one" && selection.output === 6 ? 4 : selection.output;
  const base =
    out === 2
      ? ["vocals", "instrumental"]
      : out === 6
        ? ["vocals", "drums", "bass", "guitar", "piano", "other"]
        : ["vocals", "drums", "bass", "other"];
  if (engine !== "studio") return base;
  const extras = [
    ...(selection.leadBack ? ["lead_vocals", "backing_vocals"] : []),
    ...(selection.dereverb ? ["vocals_dry"] : []),
  ];
  return sortStems([...base, ...extras]);
}

export function estimateSeconds(engine: StudioEngine, selection: StudioSelection, trackSeconds: number | null): number {
  const dur = trackSeconds ?? 210;
  const options = (selection.dereverb ? 1 : 0) + (selection.leadBack ? 1 : 0);
  if (engine === "one") return Math.round(12 + dur * 0.3 + (selection.output > 2 ? 8 : 0));
  return Math.round(25 + dur * 0.9 + options * (10 + dur * 0.15) + (selection.output > 2 ? 10 : 0));
}
export interface TrackAnalysis {
  key: string | null;
  camelot: string | null;
  bpm: number | null;
}

export async function fetchTrackAnalysis(run: StartedRun, signal?: AbortSignal): Promise<TrackAnalysis | null> {
  try {
    const res = await fetchWithTimeout(`${RAILWAY_API_BASE}/separate/analysis/${run.jobId}`, { method: "GET", signal }, 60_000);
    if (!res.ok) return null;
    const d = await res.json();
    const camelot = typeof d?.camelot === "string" && d.camelot !== "Unknown" ? d.camelot : null;
    const bpm = typeof d?.bpm === "number" ? Math.round(d.bpm) : null;
    const key = typeof d?.key === "string" ? d.key : null;
    return camelot || bpm || key ? { key, camelot, bpm } : null;
  } catch {
    return null;
  }
}

export function djExportUrl(run: StartedRun, format: "wav" | "mp3"): string {
  return `${RAILWAY_API_BASE}/separate/export/${run.jobId}?format=${format}`;
}
function optionQuery(selection: StudioSelection, family: RunFamily): string {
  const q = new URLSearchParams();
  if (selection.dereverb) q.set("dereverb", "true");
  if (selection.leadBack) q.set("lead_back", "true");
  if (family.endsWith("stems")) q.set("stem_count", String(selection.output === 6 ? 6 : 4));
  const s = q.toString();
  return s ? `?${s}` : "";
}

async function readError(res: Response): Promise<ApiError> {
  let detail: Record<string, unknown> | null = null;
  try {
    const body = await res.json();
    detail = body?.detail && typeof body.detail === "object" ? body.detail : null;
  } catch {}
  const message = typeof detail?.message === "string" ? detail.message : "";
  const kind = typeof detail?.reason === "string" ? detail.reason : typeof detail?.error === "string" ? detail.error : undefined;
  return new ApiError(message, res.status, { kind, isRateLimit: res.status === 429 });
}

export async function upgradeRun(from: StartedRun, selection: StudioSelection, signal: AbortSignal): Promise<StartedRun> {
  const upFamily = from.family.endsWith("stems") ? "stems" : "separate";
  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/${upFamily}/upgrade/${from.jobId}${optionQuery(selection, from.family)}`,
    { method: "POST", credentials: "include", signal },
    30_000
  );
  if (!res.ok) throw await readError(res);
  const d = await res.json();
  return { jobId: String(d.job_id), family: from.family, engine: "studio" };
}

export async function requestStudioPreview(
  from: StartedRun,
  selection: StudioSelection,
  signal?: AbortSignal
): Promise<StartedRun> {
  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/studio/preview/${from.jobId}${optionQuery(selection, from.family)}`,
    { method: "POST", credentials: "include", signal },
    30_000
  );
  if (!res.ok) throw await readError(res);
  const d = await res.json();
  return { jobId: String(d.job_id), family: from.family, engine: "studio" };
}