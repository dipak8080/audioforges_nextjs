"use client";

import { useEffect, useState } from "react";
import {
  Piano,
  Guitar,
  Sparkles,
  Layers,
  FileText,
  Music4,
  FileAudio,
  Download,
  ExternalLink,
} from "lucide-react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { OptionCards, type CardOption } from "@/components/converter/ToolControls";
import { FreeTierBadge } from "@/components/credits/FreeTierBadge";
import { cn } from "@/lib/utils/cn";
import {
  getAudioToSheetResult,
  getSheetPreviewUrl,
  getSheetDownloadUrl,
  type SheetResult,
  type SheetFormat,
  isAbortError,
} from "@/lib/api/railway";

/**
 * AUDIO TO SHEET MUSIC — the paid notation tool.
 *
 * Wraps the shared JobToolForm engine (upload -> poll -> credit gate) exactly
 * like every other tool, with two tool-specific pieces bolted on:
 *
 *   1. An instrument picker. `piano` routes to Transkun on the backend (a
 *      solo-piano specialist); everything else falls back to YourMT3. Piano also
 *      gets a two-staves (grand staff) toggle. These map 1:1 to the backend form
 *      fields `instrument` and `hand_split`.
 *
 *   2. A rich renderResult. Unlike MIDI, this tool's output can be SHOWN — the
 *      engraved SVG score is the whole selling point and the free-tier
 *      quality-proof surface — so the complete state is a framed white "sheet of
 *      paper" score preview plus a four-format download toolbar (PDF, MusicXML,
 *      MIDI, SVG), not a lone download button.
 *
 * hidePreview is set because JobToolForm's default <AudioPlayer> is meaningless
 * here (the output isn't audio), same as audio-to-midi.
 */

type Instrument = "piano" | "auto" | "guitar" | "mix";

const INSTRUMENTS: {
  value: Instrument;
  title: string;
  detail: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "piano",
    title: "Piano",
    detail: "Solo piano specialist (Transkun AI). The most accurate option.",
    icon: <Piano className="h-4 w-4" aria-hidden />,
  },
  {
    value: "guitar",
    title: "Guitar",
    detail: "Single-note guitar lines. Clean recordings transcribe best.",
    icon: <Guitar className="h-4 w-4" aria-hidden />,
  },
  {
    value: "auto",
    title: "Auto",
    detail: "Let the model pick. Good for vocals, leads and unknown sources.",
    icon: <Sparkles className="h-4 w-4" aria-hidden />,
  },
  {
    value: "mix",
    title: "Full mix",
    detail: "A full song. Notation is a rougher draft on dense material.",
    icon: <Layers className="h-4 w-4" aria-hidden />,
  },
];

const TOOL_COPY = {
  submitLabel: "Transcribe to sheet music",
  toolLabel: "Audio to Sheet Music",
  toolMeta: "PDF · MusicXML · MIDI",
  processingLabel: "Transcribing & engraving",
  expectedRange: "under a minute for most songs",
  resultVerb: "Engraved",
};

export function AudioToSheetForm() {
  const [instrument, setInstrument] = useState<Instrument>("piano");
  const [handSplit, setHandSplit] = useState(true);

  const isPiano = instrument === "piano";

  const instrumentOptions: CardOption<Instrument>[] = INSTRUMENTS.map((o) => ({
    value: o.value,
    title: o.title,
    titleBefore: o.icon,
    detail: o.detail,
    meta: o.value === "piano" ? "Best quality" : undefined,
    metaTone: o.value === "piano" ? "good" : "default",
  }));

  return (
    <JobToolForm
      // Remount when the instrument changes so nothing stale carries over,
      // matching how audio-to-midi keys on its tier.
      key={instrument}
      endpoint="audio-to-sheet"
      metered
      icon={Music4}
      submitLabel={TOOL_COPY.submitLabel}
      toolLabel={TOOL_COPY.toolLabel}
      toolMeta={TOOL_COPY.toolMeta}
      processingLabel={TOOL_COPY.processingLabel}
      expectedRange={TOOL_COPY.expectedRange}
      resultVerb={TOOL_COPY.resultVerb}
      // Sheet jobs run a GPU transcription + engrave; give the progress curve a
      // realistic time constant and the submit room to absorb a cold start.
      progressTau={35}
      submitTimeoutMs={120_000}
      pollIntervalMs={3_000}
      // MIDI-family input set (audio + opus/webm). The backend enforces the
      // real list; this only filters the picker dialog.
      fileAccept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.aiff,.opus,.webm"
      hidePreview
      renderResult={(jobId) => <SheetResultPanel key={jobId} jobId={jobId} />}
      buildExtraFields={() => ({
        instrument,
        // Only meaningful for piano; harmless elsewhere, but only send it where
        // it applies so the request reads honestly.
        ...(isPiano ? { hand_split: String(handSplit) } : {}),
      })}
      renderControls={(_file, disabled) => (
        <div className="space-y-5">
          <OptionCards
            label="Instrument"
            options={instrumentOptions}
            value={instrument}
            onChange={setInstrument}
            columns={4}
            disabled={disabled}
          />

          {isPiano && (
            <label
              className={cn(
                "flex items-start gap-3 rounded-lg border border-graphite-700 bg-graphite-850 px-4 py-3",
                disabled && "opacity-60"
              )}
            >
              <input
                type="checkbox"
                checked={handSplit}
                onChange={(e) => setHandSplit(e.target.checked)}
                disabled={disabled}
                className="mt-0.5 h-4 w-4 accent-amber-500"
              />
              <span className="text-sm">
                <span className="font-medium text-text-primary">
                  Split into two hands (grand staff)
                </span>
                <span className="mt-0.5 block text-text-muted">
                  Separates the notes onto treble and bass staves — the way piano
                  music is normally written. Turn off for a single-staff lead sheet.
                </span>
              </span>
            </label>
          )}

          <p className="flex items-center gap-2 text-xs text-text-subtle">
            <FreeTierBadge tool="audio-to-sheet" />
            <span>Clips of 30 seconds or less are always free. Longer songs include a couple of free runs each month, then 3 credits per song.</span>
          </p>
        </div>
      )}
    />
  );
}

/* ------------------------------------------------------------------ *
 * The result panel — the framed score preview + download toolbar.
 *
 * This is the whole product. It fetches the summary once (note/page counts,
 * detected key/tempo, which formats exist), shows the engraved SVG as a bright
 * sheet of paper against the dark page, and offers the four downloads.
 * ------------------------------------------------------------------ */

const FORMAT_BUTTONS: {
  format: SheetFormat;
  label: string;
  hint: string;
  icon: React.ReactNode;
  primary?: boolean;
}[] = [
  { format: "pdf", label: "PDF", hint: "Print & share", icon: <FileText className="h-4 w-4" aria-hidden />, primary: true },
  { format: "musicxml", label: "MusicXML", hint: "Edit in MuseScore", icon: <Music4 className="h-4 w-4" aria-hidden /> },
  { format: "midi", label: "MIDI", hint: "Open in any DAW", icon: <FileAudio className="h-4 w-4" aria-hidden /> },
  { format: "svg", label: "SVG", hint: "Vector image", icon: <FileText className="h-4 w-4" aria-hidden /> },
];

function SheetResultPanel({ jobId }: { jobId: string }) {
  const [result, setResult] = useState<SheetResult | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getAudioToSheetResult(jobId, { signal: controller.signal })
      .then(setResult)
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(true);
      });
    return () => controller.abort();
  }, [jobId]);

  const availableFormats = new Set(result?.formats ?? ["pdf", "musicxml", "midi", "svg"]);

  return (
    <div className="mt-5 space-y-4">
      {/* Stats strip — the proof it worked, in the brand's mono/amber voice. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
        {result ? (
          <>
            <Stat value={result.n_notes.toLocaleString()} label="notes" />
            <Dot />
            <Stat value={String(result.n_pages)} label={result.n_pages === 1 ? "page" : "pages"} />
            {result.key && (
              <>
                <Dot />
                <Stat value={result.key} label="" />
              </>
            )}
            <Dot />
            <Stat value={`${Math.round(result.tempo_bpm)}`} label="BPM" />
            <Dot />
            <span className="font-mono uppercase tracking-wide text-text-subtle">
              {result.engine === "transkun" ? "Transkun AI" : "AI transcription"}
            </span>
          </>
        ) : error ? (
          <span className="text-text-subtle">Your score is ready to download below.</span>
        ) : (
          <span className="text-text-subtle">Reading the score…</span>
        )}
      </div>

      {/* The score — a bright sheet of paper glowing against the dark page. */}
      <div className="overflow-hidden rounded-xl border border-amber-500/30 bg-white shadow-[0_8px_40px_-12px_rgba(232,162,61,0.35)]">
        <object
          data={getSheetPreviewUrl(jobId)}
          type="image/svg+xml"
          aria-label="Engraved sheet music preview"
          className="block max-h-[70vh] w-full"
        >
          {/* Fallback if the browser won't inline the SVG in <object>. */}
          <img
            src={getSheetPreviewUrl(jobId)}
            alt="Engraved sheet music preview"
            className="block w-full"
          />
        </object>
      </div>

      {result && result.n_pages > 1 && (
        <p className="text-center text-xs text-text-subtle">
          Preview shows page 1 of {result.n_pages}. The PDF has all pages.
        </p>
      )}

      {/* Download toolbar — four formats. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FORMAT_BUTTONS.map((b) => {
          const enabled = availableFormats.has(b.format);
          return (
            <a
              key={b.format}
              href={enabled ? getSheetDownloadUrl(jobId, b.format) : undefined}
              aria-disabled={!enabled}
              className={cn(
                "group flex flex-col items-start gap-1 rounded-lg border px-3.5 py-3 transition-colors",
                b.primary
                  ? "border-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
                  : "border-graphite-700 bg-graphite-850 hover:border-graphite-600 hover:bg-graphite-800",
                !enabled && "pointer-events-none opacity-40"
              )}
            >
              <span
                className={cn(
                  "flex items-center gap-2 text-sm font-medium",
                  b.primary ? "text-amber-300" : "text-text-primary"
                )}
              >
                {b.icon}
                {b.label}
                <Download className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-70" aria-hidden />
              </span>
              <span className="text-xs text-text-subtle">{b.hint}</span>
            </a>
          );
        })}
      </div>

      {/* Honest expectation-setting — turns a limitation into a feature (edit in MuseScore). */}
      <p className="flex items-start gap-2 text-xs text-text-muted">
        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-subtle" aria-hidden />
        <span>
          An accurate first draft, not a hand-engraved final. For anything tricky,
          download the <span className="text-text-body">MusicXML</span> and fine-tune
          it in a free editor like MuseScore.
        </span>
      </p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="text-text-body">
      <span className="font-medium text-text-primary">{value}</span>
      {label && <span className="ml-1 text-text-muted">{label}</span>}
    </span>
  );
}

function Dot() {
  return <span className="text-graphite-600" aria-hidden>·</span>;
}