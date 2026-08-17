/**
 * Cooperative scheduling helpers for analysis passes that run on the
 * main thread.
 *
 * decodeAudioData is off-thread, but everything we do with the decoded
 * samples afterwards is not: those passes are tens of millions of
 * iterations, and running one in a single task blocks the page right
 * after the user picks a file — exactly when they're most likely to
 * click something.
 */

/** How long a single chunk may occupy the main thread before yielding.
 *  Under one frame at 60Hz, so a pass never shows up as a long task. */
export const CHUNK_BUDGET_MS = 12;

/**
 * Hands control back to the browser so queued input and paint can run.
 * `scheduler.yield()` resumes at the front of the queue where it
 * exists; setTimeout is the fallback and clamps to a few ms.
 */
export function yieldToBrowser(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (typeof scheduler?.yield === "function") return scheduler.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}