"use client";

import { useEffect, useState } from "react";
import { Sparkles, Bell, BellOff, Info } from "lucide-react";
import { MultiOutputToolForm } from "@/components/converter/MultiOutputToolForm";
import { submitStems, type SeparationQuality } from "@/lib/api/railway";
import { cn } from "@/lib/utils/cn";

interface StemsFormProps {
  hqAvailable?: boolean;
}

interface QualitySpec {
  value: SeparationQuality;
  label: string;
  time: string;
  detail: string;
  rateLimit: string;
}

const STANDARD_SPEC: QualitySpec = {
  value: "standard",
  label: "Standard",
  time: "20 sec–1 min",
  detail: "Vocals, drums, bass, other",
  rateLimit: "3 per hour",
};

const HQ_SPEC: QualitySpec = {
  value: "hq",
  label: "Studio Quality",
  time: "1–2 min",
  detail: "Cleaner separation, same 4 stems",
  rateLimit: "1 per hour",
};

// Stage timestamps rescaled to fit the corrected times above — previously
// ran to 80s (standard) and 280s (HQ), well beyond the current ~1 min and
// ~2 min estimates.
const STANDARD_STAGES = [
  { at: 0, label: "Uploading and queuing" },
  { at: 5, label: "Analyzing frequencies" },
  { at: 10, label: "Isolating vocals" },
  { at: 20, label: "Isolating drums and bass" },
  { at: 40, label: "Rendering stems" },
];

const HQ_STAGES = [
  { at: 0, label: "Uploading and queuing" },
  { at: 5, label: "Running the studio-quality model" },
  { at: 30, label: "Separating vocals" },
  { at: 65, label: "Separating drums and bass" },
  { at: 95, label: "Refining and rendering stems" },
];

export function StemsForm({ hqAvailable = false }: StemsFormProps) {
  const [quality, setQuality] = useState<SeparationQuality>("standard");
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyPermission, setNotifyPermission] = useState<NotificationPermission | "unsupported">("default");

  const effectiveQuality: SeparationQuality = hqAvailable ? quality : "standard";
  const isHq = effectiveQuality === "hq";
  const spec = isHq ? HQ_SPEC : STANDARD_SPEC;

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotifyPermission("unsupported");
      return;
    }
    setNotifyPermission(Notification.permission);
  }, []);

  const handleNotifyToggle = async () => {
    if (notifyPermission === "unsupported") return;
    if (notifyPermission === "default") {
      const result = await Notification.requestPermission();
      setNotifyPermission(result);
      if (result === "granted") setNotifyEnabled(true);
      return;
    }
    setNotifyEnabled((v) => !v);
  };

  const notifyOnDone = (title: string, body: string) => {
    if (!notifyEnabled || notifyPermission !== "granted") return;
    if (typeof document !== "undefined" && !document.hidden) return;
    try {
      new Notification(title, { body, icon: "/favicon.ico" });
    } catch {
      // Some browsers restrict Notification() outside a service worker
      // context — silently skip rather than throw.
    }
  };

  return (
    <MultiOutputToolForm
      endpoint="stems"
      queryParam="stem"
      onSubmit={(file) => submitStems(file, effectiveQuality)}
      pollIntervalMs={isHq ? 20_000 : 8_000}
      maxPollMs={isHq ? 32 * 60 * 1000 : 12 * 60 * 1000}
      toolLabel="Stem separator"
      toolMeta={`${spec.label} · ${spec.time}`}
      stages={isHq ? HQ_STAGES : STANDARD_STAGES}
      submitLabel={isHq ? "Split into stems (Studio Quality)" : "Split into stems"}
      processingLabel={isHq ? "Running studio quality stem separation" : "Separating vocals, drums, bass, and other"}
      expectedRange={`usually ${spec.time}`}
      resultVerb="Split"
      rateLimitMessage={
        isHq
          ? "You've reached the studio quality limit (1 per hour). Try again later."
          : "You've reached the free limit (3 stem splits per hour). Try again later."
      }
      onComplete={() => notifyOnDone("Stems are ready", "Your separated tracks finished processing.")}
      onFailed={(message) => notifyOnDone("Stem separation failed", message || "The job didn't complete.")}
      renderControls={(file, disabled) => (
        <div className="space-y-5">
          {hqAvailable && (
            <fieldset className="space-y-2" disabled={disabled}>
              <legend className="mb-2 text-sm font-medium text-text-primary">Quality</legend>
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Separation quality">
                {[STANDARD_SPEC, HQ_SPEC].map((option) => {
                  const selected = quality === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setQuality(option.value)}
                      disabled={disabled}
                      className={cn(
                        "rounded-lg border p-3.5 text-left transition-all",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                        "disabled:cursor-not-allowed disabled:opacity-40",
                        selected
                          ? "border-amber-500/60 bg-amber-500/[0.07]"
                          : "border-graphite-700 bg-graphite-850 hover:border-graphite-700/60 hover:bg-graphite-800/60"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "flex items-center gap-1.5 text-sm font-semibold",
                            selected ? "text-amber-400" : "text-text-primary"
                          )}
                        >
                          {option.value === "hq" && <Sparkles className="h-3.5 w-3.5" />}
                          {option.label}
                        </span>
                        <span
                          className={cn(
                            "font-mono text-[10px]",
                            selected ? "text-amber-500/80" : "text-text-subtle"
                          )}
                        >
                          {option.time}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-snug text-text-muted">{option.detail}</p>
                      <p className="mt-1 font-mono text-[10px] text-text-subtle">{option.rateLimit}</p>
                    </button>
                  );
                })}
              </div>

              {isHq && (
                <p className="flex items-start gap-1.5 text-[11px] text-text-subtle">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                  Studio Quality can take a minute or two. Worth turning on the notification below so you
                  don&apos;t have to babysit this tab.
                </p>
              )}
            </fieldset>
          )}

          {notifyPermission !== "unsupported" && (
            <button
              type="button"
              onClick={handleNotifyToggle}
              disabled={disabled || !file}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:cursor-not-allowed disabled:opacity-40",
                notifyEnabled && notifyPermission === "granted"
                  ? "border-amber-500/60 bg-amber-500/[0.07] text-amber-400"
                  : "border-graphite-700 bg-graphite-850 text-text-muted hover:border-graphite-700/60 hover:text-text-primary"
              )}
            >
              {notifyEnabled && notifyPermission === "granted" ? (
                <Bell className="h-4 w-4 shrink-0" />
              ) : (
                <BellOff className="h-4 w-4 shrink-0" />
              )}
              <span className="flex-1">
                {notifyPermission === "denied"
                  ? "Notifications blocked — enable them in your browser settings to use this"
                  : notifyEnabled && notifyPermission === "granted"
                    ? "We'll notify you when it's done"
                    : "Notify me when it's done"}
              </span>
            </button>
          )}
        </div>
      )}
    />
  );
}