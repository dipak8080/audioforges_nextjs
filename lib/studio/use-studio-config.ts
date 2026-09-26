"use client";

import { useSyncExternalStore } from "react";
import { fetchStudioConfig, STUDIO_CONFIG_OFF, type StudioConfig } from "./config";

export type StudioConfigStatus = "idle" | "loading" | "ready" | "error";

export interface StudioConfigState {
  config: StudioConfig;
  status: StudioConfigStatus;
  loadedAt: number;
}

const FRESH_MS = 60_000;
const SERVER_STATE: StudioConfigState = { config: STUDIO_CONFIG_OFF, status: "idle", loadedAt: 0 };

let state: StudioConfigState = SERVER_STATE;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(next: StudioConfigState) {
  state = next;
  listeners.forEach((l) => l());
}

export function refreshStudioConfig(force = false): Promise<void> {
  if (inflight) return inflight;
  if (!force && state.status === "ready" && Date.now() - state.loadedAt < FRESH_MS) {
    return Promise.resolve();
  }
  if (state.status !== "ready") emit({ ...state, status: "loading" });
  inflight = fetchStudioConfig()
    .then((config) => emit({ config, status: "ready", loadedAt: Date.now() }))
    .catch(() => emit({ ...state, status: state.status === "ready" ? "ready" : "error" }))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function onVisible() {
  if (document.visibilityState === "visible") void refreshStudioConfig();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) document.addEventListener("visibilitychange", onVisible);
  queueMicrotask(() => void refreshStudioConfig());
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) document.removeEventListener("visibilitychange", onVisible);
  };
}

export function useStudioConfig(): StudioConfigState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}