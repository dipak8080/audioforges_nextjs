import type { StudioSelection } from "./presets";
import type { StartedRun } from "./run";

const KEY = "af:studio-resume";
const RETURN_KEY = "af_return_to";
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

export interface StudioResume {
  run: StartedRun;
  selection: StudioSelection;
  title: string;
  path: string;
  at: number;
}

export function saveResume(r: Omit<StudioResume, "at">) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...r, at: Date.now() }));
    window.localStorage.setItem(RETURN_KEY, JSON.stringify({ path: r.path, label: r.title || null }));
  } catch {}
}

export function takeResume(path: string): StudioResume | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as StudioResume;
    if (r.path !== path) return null;
    window.localStorage.removeItem(KEY);
    if (Date.now() - r.at > MAX_AGE_MS || !r.run?.jobId) return null;
    return r;
  } catch {
    return null;
  }
}