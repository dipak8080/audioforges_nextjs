import { buttonStyles } from "@/components/ui/Button";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";

const guide = getGuideBySlug("how-audio-to-midi-transcription-works")!;

export const metadata: Metadata = {
  title: guide.title,
  description: guide.description,
  alternates: { canonical: `${SITE_URL}/guides/${guide.slug}` },
  openGraph: {
    title: guide.title,
    description: guide.description,
    url: `${SITE_URL}/guides/${guide.slug}`,
    siteName: "AudioForges",
    type: "article",
    images: [
      {
        url: "/images/og-default.png",
        width: 1200,
        height: 630,
        alt: "AudioForges",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: guide.title,
    description: guide.description,
    images: ["/images/og-default.png"],
  },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: guide.title,
  description: guide.description,
  datePublished: guide.publishedDate,
  dateModified: guide.updatedDate,
  author: { "@type": "Organization", name: "AudioForges" },
  publisher: { "@type": "Organization", name: "AudioForges" },
  image: `${SITE_URL}/images/og-default.png`,
  mainEntityOfPage: `${SITE_URL}/guides/${guide.slug}`,
};

export default function AudioToMidiGuidePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-10">
        <header className="space-y-3">
          <Link href="/guides" className="text-sm text-amber-400 hover:underline">
            ← All guides
          </Link>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl text-text-primary">
            {guide.title}
          </h1>
        </header>

        <GuideByline publishedDate={guide.publishedDate} updatedDate={guide.updatedDate} />

        <div className="space-y-6 text-text-muted leading-relaxed">
          <p>
            A MIDI file doesn&apos;t contain any sound at all — no waveform, no
            samples, nothing you could play back on its own. It&apos;s a list of
            instructions: which note, how loud, when it starts, and how long
            it lasts. Converting audio to MIDI means pulling that note-and-timing
            information back out of a finished recording that never had it
            attached in the first place, which is a fundamentally different,
            much harder problem than converting between two audio formats.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              What audio-to-MIDI transcription actually does
            </h2>
            <p>
              An audio file is a waveform — a record of air pressure over
              time. A MIDI file is closer to sheet music: a sequence of
              note-on and note-off events, each with a pitch, a velocity, and
              a timestamp. Audio-to-MIDI transcription analyzes a waveform
              and detects what that underlying note sequence probably was —
              reconstructing the score from the performance, in effect,
              rather than reading the score directly.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              How a note gets detected
            </h2>
            <p>
              The detector scans the audio for two related signals: an{" "}
              <strong className="text-text-primary">onset</strong> — a sudden
              rise in energy at a particular pitch, which usually marks the
              start of a note — and a{" "}
              <strong className="text-text-primary">sustained frame</strong> of
              energy at that same pitch, which marks the note continuing to
              ring out. Two threshold settings control how sensitive each
              check is. A lower onset threshold catches quieter or more subtle
              note starts, but also picks up more false positives from noise
              or bleed. A lower frame threshold holds notes open longer and
              catches quieter sustain, at the same trade-off. There&apos;s no
              single correct setting — it&apos;s a real trade-off between missing
              genuine notes and registering ones that were never played, and
              the right balance depends on the source recording.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why a single melody transcribes cleaner than a full mix
            </h2>
            <p>
              Detecting "when did a note start and at what pitch" is a much
              easier job when there&apos;s one clear pitch to track at a time.
              A solo vocal line, a single instrument, or an isolated melody
              gives the detector an unambiguous signal. A dense mix with
              multiple instruments overlapping in the same frequency range,
              or a chord where several notes ring simultaneously, means
              disentangling overlapping energy at once — a genuinely harder
              detection problem, not just a matter of turning the sensitivity
              up. This is also why a stem-separated track (an isolated vocal
              or bass line, for example) transcribes far more reliably than
              the same part still buried in a full mix — thinning out the
              signal before transcription starts makes a real difference.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              What the minimum and maximum frequency filters are for
            </h2>
            <p>
              These two settings simply tell the detector to ignore anything
              outside a pitch range before it starts listening. Setting a
              minimum frequency filters out low rumble or bleed from a bass
              or kick drum that isn&apos;t the part you&apos;re trying to capture.
              Setting a maximum frequency filters out hiss, cymbals, or
              high-frequency noise. Narrowing the range to just where your
              actual melody sits reduces false positives from everything
              outside it, without touching the onset or frame sensitivity at
              all.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              What a minimum note length filters out
            </h2>
            <p>
              Short spurious blips — a transient click, a bit of noise that
              briefly crosses the onset threshold — can register as extremely
              short "notes" that were never actually played. Raising the
              minimum note length discards anything shorter than that
              duration, which cleans up a lot of stray notes at the cost of
              also discarding any genuinely fast, short notes in the source
              performance. Fast melodic runs need a shorter minimum than a
              slow, sustained vocal line.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              What a transcribed MIDI file is actually useful for
            </h2>
            <p>
              A resulting MIDI file isn&apos;t a substitute for the original
              recording — it&apos;s a starting point. Producers use it to pull a
              melody or bassline out of a reference track and reassign it to
              a different instrument or synth patch in a DAW. It works as a
              rough first pass for building sheet music or a lead sheet in
              notation software, saving the slower work of transcribing by
              ear from scratch. And it lets you study or rework a melodic
              idea's timing and pitch independent of the original
              performance&apos;s tone or production.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Where it still struggles
            </h2>
            <p>
              Dense chords, fast polyphonic passages, and full-band mixes
              remain genuinely hard for any automatic transcription approach,
              not just this one — that&apos;s an open problem in audio
              processing generally, not a limitation specific to one
              implementation. Drums and unpitched percussion don&apos;t
              transcribe meaningfully at all, since the whole approach is
              built around tracking pitch over time. The most reliable
              results come from a single clear instrument or vocal melody
              with minimal competing sound in the same frequency range.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              How AudioForges uses these settings
            </h2>
            <p>
              AudioForges exposes onset sensitivity, frame sensitivity,
              minimum note length, and frequency range directly, plus a set
              of presets — vocal, piano, bass, guitar, and fast passages —
              that start from a sensible combination of these for common
              sources. Pick the closest preset, or adjust the controls above
              manually if the default result isn&apos;t quite right. For a
              practical example, open the{" "}
              <Link href="/audio-to-midi" className="text-amber-400 hover:underline">
                Audio to MIDI Converter
              </Link>{" "}
              and expand Advanced Settings.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-graphite-800">
          <Link
            href="/audio-to-midi"
            className={buttonStyles({ size: "lg" })}
          >
            Try the Free Audio to MIDI Converter
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}