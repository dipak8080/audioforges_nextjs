export type StudioEvent =
  | "studio_upload"
  | "studio_free_done"
  | "studio_run_done"
  | "studio_preview_clicked"
  | "studio_preview_played"
  | "studio_unlock_clicked"
  | "studio_checkout_started"
  | "studio_purchase"
  | "studio_pass_started";

export function trackStudio(event: StudioEvent, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  try {
    window.gtag?.("event", event, params);
  } catch {}
}