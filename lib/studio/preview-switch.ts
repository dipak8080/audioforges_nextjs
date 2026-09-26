"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "af:studio-preview";
const PARAM = "studio-preview";

let on: boolean | null = null;
const listeners = new Set<() => void>();

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function emit() {
  listeners.forEach((l) => l());
}

export function setStudioPreview(next: boolean) {
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
  on = next;
  emit();
}

function consumeUrlParam() {
  const url = new URL(window.location.href);
  const value = url.searchParams.get(PARAM);
  if (value !== "on" && value !== "off") return;
  url.searchParams.delete(PARAM);
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  setStudioPreview(value === "on");
}

function onStorage(e: StorageEvent) {
  if (e.key !== STORAGE_KEY) return;
  on = readStored();
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  queueMicrotask(consumeUrlParam);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): boolean {
  if (on === null) on = readStored();
  return on;
}

export function useStudioPreview(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}