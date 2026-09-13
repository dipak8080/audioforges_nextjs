"use client";

import { useCallback, useSyncExternalStore } from "react";

export type NotifyPermission = NotificationPermission | "unsupported";

const listeners = new Set<() => void>();
let cached: NotifyPermission | null = null;

function read(): NotifyPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): NotifyPermission {
  if (cached === null) cached = read();
  return cached;
}

// "default" rather than "unsupported": the server cannot know, and this is the
// value the four separation forms each used as their own initial state, so the
// pre-hydration markup is unchanged.
function getServerSnapshot(): NotifyPermission {
  return "default";
}

// Browsers fire no event when a permission changes, so the only place that can
// change it tells every mounted form at once.
function refresh() {
  const next = read();
  if (next === cached) return;
  cached = next;
  for (const listener of listeners) listener();
}

export function useNotificationPermission() {
  const permission = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const request = useCallback(async (): Promise<NotifyPermission> => {
    if (read() === "unsupported") return "unsupported";
    const result = await Notification.requestPermission();
    refresh();
    return result;
  }, []);

  return { permission, request };
}