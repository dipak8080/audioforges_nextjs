import Link from "next/link";
import { CompareTable } from "@/components/tools/CompareTable";
import { TRANSCRIPTION_MODEL } from "@/lib/api/transcription";

export function transcriptionCost(metered: boolean) {
  return metered
    ? {
        meta: "Free monthly runs",
        proofValue: "Free runs monthly, then 1 credit",
        proofNote: "No subscription, credits never expire, a failed run refunds itself. Exports are never paywalled.",
        short: "free monthly runs, then 1 credit per transcript",
        sentence:
          "Every visitor gets free runs each month, and the tool shows how many are left before you start. After that a transcript costs 1 credit, about 20 to 30 cents, with no subscription.",
      }
    : {
        meta: "Free",
        proofValue: "Free, no account",
        proofNote: "Rate-limited per IP so it stays free for everyone.",
        short: "free",
        sentence: "It is free, with a per-file length cap and a rate limit that keep the queue moving.",
      };
}

export function modelProof() {
  return {
    label: "Model",
    value: TRANSCRIPTION_MODEL,
    note: "Named so you can check it. Runs on a GPU, not in your browser.",
  };
}

export function ExportFormats() {
  return (
    <>
      <CompareTable
        columns={["Use it for", "Timing"]}
        highlight={-1}
        gridClass="sm:grid-cols-[minmax(4rem,0.5fr)_1.6fr_1.4fr]"
        rows={[
          {
            label: "TXT",
            cells: [{ text: "Reading, searching, pasting into notes" }, { text: "None" }],
          },
          {
            label: "SRT",
            cells: [
              { text: "Video editors, YouTube, most caption uploads" },
              { text: "Numbered blocks, comma before ms", mono: true },
            ],
          },
          {
            label: "VTT",
            cells: [
              { text: "HTML5 video through a <track> element" },
              { text: "WEBVTT header, period before ms", mono: true },
            ],
          },
        ]}
      />
      <p className="mt-4 text-sm leading-relaxed text-text-muted">
        That comma versus period is the most common reason a caption file loads with nothing on screen. Check it
        first.
      </p>
    </>
  );
}

export function LanguageModes() {
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {[
        ["Detect automatically", "Clear speech in one language, longer than a minute."],
        ["Set it yourself", "Short clips, strong accents, or two languages mixed."],
        ["Translate to English", "Any source language, in the same pass. English is the only target."],
      ].map(([t, d]) => (
        <li key={t} className="rounded-xl border border-graphite-800 bg-graphite-900 p-4">
          <p className="font-medium text-text-primary">{t}</p>
          <p className="mt-1 text-sm leading-relaxed text-text-muted">{d}</p>
        </li>
      ))}
    </ul>
  );
}

export function TranscriptionLimits({ items }: { items: Array<[string, React.ReactNode]> }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map(([t, d]) => (
        <li key={t} className="rounded-xl border border-graphite-800 bg-graphite-900 p-4">
          <p className="font-medium text-text-primary">{t}</p>
          <p className="mt-1 text-sm leading-relaxed text-text-muted">{d}</p>
        </li>
      ))}
    </ul>
  );
}

export function NoSpeakerLabels() {
  return (
    <>
      An interview comes back as one continuous transcript, not Speaker 1 and Speaker 2. Overlapping voices are the
      hardest case for any engine.
    </>
  );
}

export function NoisyAudio() {
  return (
    <>
      Nothing cleans the recording first. Running it through the{" "}
      <Link href="/voice-clean" prefetch={false} className="text-amber-400 hover:underline">
        Voice Cleaner
      </Link>{" "}
      helps the transcript more than any setting here.
    </>
  );
}