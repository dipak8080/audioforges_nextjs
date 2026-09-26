"use client";

import { useStudioPreview } from "@/lib/studio/preview-switch";

export function StudioGate({
  studio,
  fallback = null,
}: {
  studio: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return <>{useStudioPreview() ? studio : fallback}</>;
}