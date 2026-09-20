"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic2, Music4, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Waveform } from "@/components/ui/Waveform";
import { StemMixer } from "@/components/converter/StemMixer";
import { UpgradeToHqCard } from "@/components/credits/UpgradeToHqCard";
import { CreditReceipt, StudioQualityTag } from "@/components/credits/CreditReceipt";
import { useCredits } from "@/components/credits/CreditProvider";
import { DemoQualityStrip } from "@/components/tools/DemoQualityStrip";
import {
  ErrorPanel,
  SeparationTheater,
  WorkingPanel,
  easedProgress,
  serverFailure,
  terminalPollError,
  type FormError,
  type ProcessingStage,
} from "@/components/tools/JobFormKit";
import {
  ApiError,
  cancelJob,
  getYoutubeSeparateDownloadUrl,
  getYoutubeSeparatePreviewUrl,
  getYoutubeSeparateStatus,
  submitYoutubeSeparate,
} from "@/lib/api/railway";
import { triggerDownload, triggerDownloadsStaggered } from "@/lib/utils/download";
import { useSharedLimit } from "@/lib/hooks/useSharedLimit";
import { trackCredits } from "@/lib/analytics";
import type { StemType, SubmitBilling } from "@/lib/types/converter";

const DEMO_STANDARD = "/audio/demo-vocals-standard.mp3";
const DEMO_STUDIO = "/audio/demo-vocals-studio.mp3";

const POLL_STANDARD = { intervalMs: 8_000, maxMs: 12 * 60 * 1000, tau: 40 };
const POLL_HQ = { intervalMs: 20_000, maxMs: 32 * 60 * 1000, tau: 90 };

const STAGES_STANDARD: ProcessingStage[] = [
  { at: 0, label: "Reusing the audio you just converted" },
  { at: 5, label: "Analyzing frequencies" },
  { at: 15, label: "Isolating vocals" },
  { at: 40, label: "Rendering vocals and instrumental" },
];

const STAGES_HQ: ProcessingStage[] = [
  { at: 0, label: "Running the studio-quality model" },
  { at: 30, label: "Isolating vocals" },
  { at: 90, label: "Rendering vocals and instrumental" },
];

const STEMS: StemType[] = ["vocals", "instrumental"];

type Phase = "offer" | "processing" | "complete" | "failed";

interface Props {
  url: string;
  title: string | null;
  /** Called with true while the result player is on screen, so the host card can widen. */
  onWide?: (wide: boolean) => void;
}

/**
 * The sales funnel on the YouTube-to-WAV/MP3 result screen. The file is
 * already cached server-side, so this is one click: free Standard run,
 * result in Forge Mixer, Studio Quality as the upsell through the same
 * UpgradeToHqCard the separation pages use.
 */
export function YouTubeVocalFunnel({ url, title, onWide }: Props) {
  const { enabled: paywallOn } = useCredits();
  const sharedLimit = useSharedLimit("youtube/separate");

  const [phase, setPhase] = useState<Phase>("offer");
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultTitle, setResultTitle] = useState<string | null>(null);
  const [isHq, setIsHq] = useState(false);
  const [billing, setBilling] = useState<SubmitBilling | null>(null);
  const [error, setError] = useState<FormError | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const pollRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const startedAtRef = useRef(0);
  const activeJobRef = useRef<string | null>(null);
  const onWideRef = useRef(onWide);

  useEffect(() => {
    onWideRef.current = onWide;
  }, [onWide]);

  useEffect(() => {
    trackCredits("funnel_vocal_offered");
  }, []);

  useEffect(() => {
    onWideRef.current?.(phase === "complete");
  }, [phase]);

  useEffect(() => {
    if (phase !== "processing") return;
    const id = window.setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      cancelledRef.current = true;
      stopPolling();
      onWideRef.current?.(false);
    },
    [stopPolling]
  );

  const fail = useCallback(
    (failure: FormError, reason: string) => {
      stopPolling();
      setError(failure);
      setPhase("failed");
      trackCredits("funnel_vocal_failed", { reason });
    },
    [stopPolling]
  );

  const poll = useCallback(
    (id: string, hq: boolean) => {
      const timing = hq ? POLL_HQ : POLL_STANDARD;

      const tick = async () => {
        if (cancelledRef.current || activeJobRef.current !== id) return;

        if (Date.now() - startedAtRef.current > timing.maxMs) {
          fail({ title: "This is taking unusually long", hint: "The job may be stuck. Try again." }, "timeout");
          return;
        }

        try {
          const result = await getYoutubeSeparateStatus(id);
          if (cancelledRef.current || activeJobRef.current !== id) return;

          if (result.status === "complete") {
            stopPolling();
            setResultTitle(result.title);
            setPhase("complete");
            trackCredits("funnel_vocal_completed", { tier: hq ? "hq" : "standard" });
            return;
          }
          if (result.status === "failed") {
            fail(
              serverFailure(result.error, {
                title: "Vocal removal failed",
                hint: "Try again. If it keeps failing, this track may not be supported.",
              }),
              "job_failed"
            );
            return;
          }
        } catch (err) {
          if (cancelledRef.current) return;
          const terminal = terminalPollError(err);
          if (terminal) {
            fail(terminal, "poll_error");
            return;
          }
        }

        pollRef.current = window.setTimeout(() => void tick(), timing.intervalMs);
      };

      pollRef.current = window.setTimeout(() => void tick(), 1500);
    },
    [fail, stopPolling]
  );

  const start = async () => {
    trackCredits("funnel_vocal_clicked");
    setError(null);
    setIsHq(false);
    setBilling(null);
    setElapsed(0);
    startedAtRef.current = Date.now();
    setPhase("processing");

    try {
      const res = await submitYoutubeSeparate(url, "standard");
      if (cancelledRef.current) return;
      activeJobRef.current = res.job_id;
      setJobId(res.job_id);
      poll(res.job_id, false);
    } catch (err) {
      if (cancelledRef.current) return;
      if (err instanceof ApiError && err.isRateLimit) {
        fail(
          {
            title: "You've hit the vocal remover limit",
            hint: sharedLimit.hintFor(err) || "Wait a while, then try again.",
          },
          "rate_limited"
        );
        return;
      }
      if (err instanceof ApiError && err.isServerBusy) {
        fail(
          {
            title: "The separation queue is full right now",
            hint: "Your converted file is still above. Try the vocal remover again in a minute.",
          },
          "queue_full"
        );
        return;
      }
      fail(
        {
          title: "Vocal removal couldn't start",
          hint: err instanceof ApiError ? err.message : "Try again in a moment.",
        },
        "submit_error"
      );
    }
  };

  const handleCancel = () => {
    const id = activeJobRef.current;
    stopPolling();
    activeJobRef.current = null;
    setPhase("offer");
    if (id) void cancelJob(id);
  };

  const handleUpgraded = (newJobId: string, upgradeBilling?: SubmitBilling | null) => {
    trackCredits("funnel_vocal_upgraded", { charged: upgradeBilling?.charged ?? "unknown" });
    if (upgradeBilling !== undefined) setBilling(upgradeBilling);
    setIsHq(true);
    setElapsed(0);
    startedAtRef.current = Date.now();
    activeJobRef.current = newJobId;
    setJobId(newJobId);
    setPhase("processing");
    poll(newJobId, true);
  };

  if (phase === "offer") {
    return (
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary">Remove the vocals from this track</p>
            <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
              Free, no re-upload. Get the instrumental and the isolated vocals in about a minute.
            </p>
          </div>
          <Button variant="primary" size="md" onClick={() => void start()} className="shrink-0">
            <Mic2 />
            Remove vocals
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "failed" && error) {
    return (
      <div className="space-y-3">
        <ErrorPanel error={error} />
        <Button variant="outline" size="sm" onClick={() => setPhase("offer")}>
          Back
        </Button>
      </div>
    );
  }

  if (phase === "processing") {
    const stages = isHq ? STAGES_HQ : STAGES_STANDARD;
    let stageIndex = 0;
    for (let i = 0; i < stages.length; i += 1) {
      if (elapsed >= stages[i].at) stageIndex = i;
    }
    return (
      <WorkingPanel
        stageLabel={stages[stageIndex]?.label ?? "Separating vocals"}
        stages={stages}
        stageIndex={stageIndex}
        showStageList
        elapsedSeconds={elapsed}
        progress={easedProgress(elapsed, isHq ? POLL_HQ.tau : POLL_STANDARD.tau)}
        expectedRange={isHq ? "1 to 2 min" : "30 sec to 1 min"}
        chargedRun={isHq}
        onCancel={handleCancel}
        waveform={<Waveform />}
        theater={<SeparationTheater lanes={["Vocals", "Instrumental"]} />}
      />
    );
  }

  if (phase === "complete" && jobId) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-text-primary">
            {isHq ? "Studio Quality vocals and instrumental" : "Vocals and instrumental"}
          </p>
          {isHq && <StudioQualityTag />}
        </div>

        <StemMixer
          key={jobId}
          stems={STEMS.map((name) => ({
            name: name === "vocals" ? "Vocals" : "Instrumental",
            url: getYoutubeSeparatePreviewUrl(jobId, name),
            downloadName: `${name}.wav`,
            icon:
              name === "vocals" ? (
                <Mic2 className="h-4 w-4" aria-hidden />
              ) : (
                <Music4 className="h-4 w-4" aria-hidden />
              ),
          }))}
          onDownload={(display) => {
            const raw: StemType = display === "Vocals" ? "vocals" : "instrumental";
            triggerDownload(getYoutubeSeparateDownloadUrl(jobId, raw));
          }}
          onDownloadAll={() =>
            triggerDownloadsStaggered(STEMS.map((n) => getYoutubeSeparateDownloadUrl(jobId, n)))
          }
          sourceTitle={resultTitle ?? title}
        />

        {isHq ? (
          <CreditReceipt billing={billing} />
        ) : (
          paywallOn && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-amber-400">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Hear the Studio Quality difference
              </div>
              <DemoQualityStrip standardSrc={DEMO_STANDARD} studioSrc={DEMO_STUDIO} />
              <UpgradeToHqCard family="separate" jobId={jobId} onUpgraded={handleUpgraded} />
            </div>
          )
        )}
      </div>
    );
  }

  return null;
}