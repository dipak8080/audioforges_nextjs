export type StudioEvent =
  | "studio_upload"
  | "studio_free_done"
  | "studio_run_done"
  | "studio_preview_clicked"
  | "studio_preview_played"
  | "studio_unlock_clicked";

export function trackStudio(event: StudioEvent, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  try {
    window.gtag?.("event", event, params);
  } catch {}
}