import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Prose } from "@/components/ui/Prose";
import { ogForGuide } from "@/lib/og";

const guide = getGuideBySlug("how-audio-to-sheet-music-works")!;

const OG_IMAGE = ogForGuide(guide);

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
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: guide.title,
    description: guide.description,
    images: [OG_IMAGE.url],
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
  url: `${SITE_URL}/guides/${guide.slug}`,
  mainEntityOfPage: `${SITE_URL}/guides/${guide.slug}`,
  image: `${SITE_URL}${OG_IMAGE.url}`,
  publisher: { "@type": "Organization", name: "AudioForges" },
};

export default function AudioToSheetMusicGuidePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <Breadcrumb
          items={[{ name: "Guides", href: "/guides" }, { name: guide.title }]}
          className="mb-8"
        />

        <header>
          <h1 className="measure-wide text-4xl font-bold leading-[1.06] tracking-[-0.02em] text-text-primary sm:text-5xl">
            {guide.title}
          </h1>
          <div className="mt-5">
            <GuideByline publishedDate={guide.publishedDate} updatedDate={guide.updatedDate} />
          </div>
        </header>

        <Prose className="mt-10">
          <p>
            Detecting the notes in a recording is only half the job. A pile of
            correct pitches with exact timestamps is a piano roll, not a score —
            and the two are not the same thing. Sheet music is a set of
            instructions a human sight-reads: notes grouped into beats and bars,
            in a key, at a tempo, with a time signature, and — for piano — split
            across two hands. Turning a performance into that is a harder, more
            opinionated problem than simply hearing the notes, and it&apos;s where
            most of the interesting decisions get made.
          </p>

          <h2 id="score-vs-midi">A score is not a MIDI file</h2>
          <p>
            The first stage of transcription produces something close to MIDI:
            every note&apos;s pitch, the millisecond it started, and how long it
            rang. That&apos;s enough to drive a synth or fill a piano roll, but
            it&apos;s not readable. A person can&apos;t sight-read &quot;C4, onset
            1.037s, duration 0.240s.&quot;
          </p>
          <p>
            Notation is the readable interpretation of that data. It rounds the
            messy human timing into clean note values, picks a key so the
            accidentals are spelled sensibly, groups notes into bars under a time
            signature, and — for piano — decides which hand plays what. MIDI keeps
            the raw performance; a score is the tidy, human-facing version of it.
            If you only need the notes in a DAW, our{" "}
            <Link href="/guides/how-audio-to-midi-transcription-works">
              guide to audio-to-MIDI
            </Link>{" "}
            covers that side; this one is about getting to a page you can put on a
            music stand.
          </p>

          <h2 id="the-pipeline">The four stages, and what each one decides</h2>
          <p>
            Every transcription moves through the same pipeline. Each stage makes
            a decision that shows up in the final score:
          </p>
          <dl>
            <dt>Transcribe</dt>
            <dd>
              A model listens to the recording and detects every note — pitch and
              timing. Piano is routed to a solo-piano specialist model, because a
              model trained on one instrument beats a generalist at that
              instrument.
            </dd>

            <dt>Analyze</dt>
            <dd>
              Tempo and key are estimated. Both matter: without a tempo there&apos;s
              no beat grid to place notes onto, and without a key every accidental
              would be spelled awkwardly — all sharps and no flats, or the reverse.
            </dd>

            <dt>Notate</dt>
            <dd>
              The raw timings snap to the beat grid, pitches are spelled for the
              detected key, a time signature goes in, and piano is split across a
              treble and bass staff into a grand staff. This is the step that turns
              data into music a person can read.
            </dd>

            <dt>Engrave</dt>
            <dd>
              The notation is typeset into a clean image — noteheads, stems, beams
              and barlines positioned by an engraving engine. This is the score you
              actually see and print.
            </dd>
          </dl>

          <h2 id="quantization">Quantization is where faithful meets readable</h2>
          <p>
            The hardest decision in the whole pipeline is the one in the Notate
            stage: how hard to snap the timing to the grid. A human never plays
            exactly on the beat — they push ahead of it and lag behind it, and
            that push-and-pull is most of what makes a performance feel human.
          </p>
          <p>
            Quantize hard and you get a clean, readable score that flattens the
            feel. Quantize loosely and you get a faithful score that&apos;s an
            unreadable thicket of tied thirty-second notes and odd tuplets. Every
            transcription tool picks a point on that spectrum, and no single point
            is right for every recording. This is the real reason an automatic
            transcription is a first draft rather than a finished engraving: the
            machine had to guess where you meant the beat to be, and sometimes it
            guesses wrong.
          </p>

          <h2 id="why-piano">Why piano transcribes best</h2>
          <p>
            Piano is about the friendliest instrument you can hand a transcription
            model. The pitches are discrete and fixed, the onsets are sharp, and
            there&apos;s no pitch bend, slide or continuous glide to confuse the
            note boundaries — a key is either down or it isn&apos;t. Pair that with
            a model trained specifically on solo piano and the results come back
            close to right.
          </p>
          <p>
            Everything that makes music expressive makes it harder to transcribe.
            Dense mixes bury notes under other notes. Polyphonic guitar and
            overlapping vocal lines force the model to separate sounds that arrive
            at once. Vibrato and slides smear a single pitch across a range. And
            rubato — deliberately bending the tempo for effect — attacks the beat
            grid the notation depends on. That&apos;s why clean, single-instrument
            recordings transcribe closest to usable, and a full band track comes
            back as a rough scaffold.
          </p>

          <h2 id="formats">PDF, MusicXML, MIDI — which one to keep</h2>
          <p>
            A good transcription tool hands you the same result in a few formats,
            each for a different job:
          </p>
          <dl>
            <dt>PDF</dt>
            <dd>The finished score to read or print. Not editable — it&apos;s the output, not the source.</dd>

            <dt>MusicXML</dt>
            <dd>
              The editable score. Open it in MuseScore (free) or Sibelius or Dorico
              to fix wrong notes, re-beam, and add dynamics. This is the file to
              keep if you plan to touch the result at all.
            </dd>

            <dt>MIDI</dt>
            <dd>
              The performance data, for a DAW. No notation, but you can drop it into
              a piano roll and re-voice or re-quantize it by hand.
            </dd>
          </dl>

          <h2 id="cleanup">How to clean up the result</h2>
          <p>
            Treat an automatic transcription as an accurate first draft, not a
            hand-engraved final. The fastest workflow is to download the MusicXML
            and open it in a free editor like MuseScore, then:
          </p>
          <dl>
            <dt>Fix the handful of wrong notes</dt>
            <dd>Play the recording alongside the score and correct the few pitches the model misheard, usually in the busiest passages.</dd>

            <dt>Check the time signature</dt>
            <dd>If the bars don&apos;t line up with where you hear the downbeat, the tool guessed the meter wrong — reset it and the bars re-flow.</dd>

            <dt>Re-beam and tidy rhythm</dt>
            <dd>Runs that got split across beats oddly are quick to re-group, and any spurious ultra-short notes from a dense moment can be deleted.</dd>
          </dl>
          <p>
            Fifteen minutes of cleanup on a solid transcription still beats an hour
            of entering notes by hand from a blank staff.
          </p>

          <h2 id="expectations">Realistic expectations</h2>
          <p>
            On a clean solo-piano recording, expect something close to playable
            with light edits. On a full mix or a very expressive performance, treat
            the output as a scaffold — the pitches and the overall shape are a large
            head start, but the rhythm and voicing will want your ear. As always
            with detection, trust the recording over the tag: if a bar reads wrong
            on the page but sounds right in your ears, believe your ears and fix the
            page.
          </p>

          <p>
            If you want to try it on your own audio, our{" "}
            <Link href="/audio-to-sheet-music">Audio to Sheet Music</Link> tool runs
            this whole pipeline — transcription, analysis, notation and engraving —
            and shows you the engraved score before you download anything. Clips of
            30 seconds or less are free, so you can check the quality on your own
            recording first.
          </p>
        </Prose>

        <div className="mt-12 border-t border-graphite-800 pt-8">
          <Link href="/audio-to-sheet-music" className={buttonStyles({ size: "lg" })}>
            Try Audio to Sheet Music
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}