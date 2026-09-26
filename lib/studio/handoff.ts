const KEY = "af:stem-handoff";
const MAX_AGE_MS = 15 * 60 * 1000;

interface StemHandoff {
  url: string;
  name: string;
  target: string;
  at: number;
}

export function setStemHandoff(h: Omit<StemHandoff, "at">) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ ...h, at: Date.now() }));
  } catch {}
}

function read(): StemHandoff | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StemHandoff) : null;
  } catch {
    return null;
  }
}

export async function takeStemHandoff(pathname: string): Promise<File | null> {
  const h = read();
  if (!h || typeof h.url !== "string") return null;
  if (Date.now() - h.at > MAX_AGE_MS) {
    window.sessionStorage.removeItem(KEY);
    return null;
  }
  if (h.target !== pathname) return null;
  window.sessionStorage.removeItem(KEY);
  try {
    const res = await fetch(h.url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new File([blob], h.name, { type: blob.type || "audio/wav" });
  } catch {
    return null;
  }
}