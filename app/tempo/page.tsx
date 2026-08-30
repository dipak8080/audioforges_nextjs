import type { Metadata } from "next";
import Link from "next/link";
import { TempoForm } from "@/components/converter/TempoForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import {
  getLimits,
  windowFor,
  rateLimitLabel,
  durationCapFor,
  durationLabel,
  retentionSentences,
} from "@/lib/api/limits";

/**
 * ── EARLIER PASS (kept for the record) ─────────────────────────────────
 *
 * I came here expecting the "3 requests per 5 minutes" error that was on
 * /pitch, since both limits were raised in the same commit. It wasn't here.
 * The problem was the opposite one: this page stated NONE of its own limits —
 * a rate limit, a duration cap that blocks submission in the browser, and an
 * 80MB file cap, none of them mentioned. The first time a visitor learned
 * about any of them was when the button refused to run.
 *
 * That's worse here than on most tools. Speed changing is ITERATIVE — the
 * documented reason the limit was raised from 3 to 5 — so someone planning
 * "try 90%, then 85%, then 80%" needs the budget before they start.
 *
 * The HowTo schema, the `keywords` meta and an unescaped apostrophe in "a
 * track's tempo" were all fixed in the same pass.
 *
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * ALL THREE LIMITS NOW COME FROM /limits, and so does the retention answer.
 *
 * The retention paragraph was written by hand from a backend description, and
 * it was CORRECT — but it was three sentences of prose describing two numbers,
 * which is exactly the shape that went wrong on /vocal-remover. It now renders
 * from retentionSentences(), so if a TTL moves, this page moves with it rather
 * than needing someone to remember it exists.
 *
 * The duration cap is the figure worth watching: tempo is one of only two
 * per-tool overrides (900s), wired up on the backend the morning of
 * 2026-08-30. Before that it silently took the 3600 default.
 */

const PAGE_TITLE = "Free Audio Speed Changer | Tempo Changer";
const PAGE_DESCRIPTION =
  "Speed up or slow down audio free, no sign-up, from 50% to 200% speed, pitch stays the same. Works on MP3, WAV, FLAC, and more.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  // `keywords` removed: ignored by Google since 2009, and no other tool page
  // on the site carries it any more.
  alternates: { canonical: `${SITE_URL}/tempo` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/tempo`,
    siteName: SITE_NAME,
    type: "website",
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
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/images/og-default.png"],
  },
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Audio Speed Changer",
  url: `${SITE_URL}/tempo`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Change speed from 50% to 200%",
    "Independent of pitch",
    "No sign-up required",
    "No watermark",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Speed Changer", item: `${SITE_URL}/tempo` },
  ],
};

// NOTE: No HowTo schema — deprecated by Google (desktop since Sept 2023), no
// ranking or rich-result benefit remains. Visible how-to steps stay.
// FAQPage schema is emitted by <FAQSection /> — do not duplicate it here.

export default async function TempoPage() {
  const relatedTools = getRelatedTools("tempo", 5);

  const limits = await getLimits();

  const rateLimitText = rateLimitLabel(limits.rateLimits.tempo ?? 5, windowFor(limits, "tempo"));

  // 900s — one of only two per-tool duration overrides, wired up on the
  // backend the morning of 2026-08-30. Before that, tempo silently took the
  // 3600 default.
  const durationCap = durationCapFor(limits, "tempo");
  const maxDurationLabel = durationCap === null ? null : durationLabel(durationCap);
  const maxUploadLabel = `${limits.maxUploadMb}MB`;

  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const faqs = [
    {
      question: "Does changing speed affect the pitch?",
      answer:
        "No — tempo is changed independently of pitch, so the key stays the same, only speed and duration change.",
    },
    {
      question: "Does changing tempo reduce audio quality?",
      answer:
        "Small changes near the original speed are close to transparent. Pushing further toward half or double speed can introduce artifacts — transients like drum hits or plucks may sound slightly smeared, since the engine is reconstructing more of the waveform to hit the new duration.",
    },
    {
      question: "What's the difference between tempo and playback speed?",
      answer:
        "They're the same thing in this context — how fast the audio plays back. A simple playback-speed change also shifts pitch; this tool changes speed while keeping pitch fixed.",
    },
    {
      question: "What speed range is available?",
      answer: "From 50% (half speed) to 200% (double speed).",
    },
    {
      // The tool blocks both of these before anything uploads, and neither
      // number appeared anywhere on the page.
      question: "Is there a size or length limit?",
      answer: maxDurationLabel
        ? `Yes — up to ${maxUploadLabel} per file, and up to ${maxDurationLabel} of audio. Longer files are caught in your browser before anything uploads, so you're not left waiting on a transfer that gets rejected at the end.`
        : `Yes — up to ${maxUploadLabel} per file.`,
    },
    {
      /*
        This page had no rate-limit answer at all, on a tool people use
        iteratively. Read from /limits rather than typed — /pitch had this same
        answer with the number written as a literal, and it had been wrong for
        months after the limit was raised.
      */
      question: "How many files can I process?",
      answer: `Time-stretching is more CPU-intensive than a simple conversion, so it's limited to ${rateLimitText}. That's deliberately generous for a tool people use iteratively — try a speed, listen, adjust.`,
    },
    {
      /*
        Was three sentences of hand-written prose. The prose was CORRECT — it
        was written from a verified backend description — but it described two
        numbers in a paragraph, which is exactly the shape that went wrong on
        /vocal-remover. It renders from the backend's retention block now, so a
        TTL change carries through rather than needing someone to remember this
        page exists.
      */
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: "Will the output file be a different length?",
      answer:
        "Yes — speeding up to 200% halves the duration, slowing to 50% doubles it. That's expected, not an error.",
    },
    {
      question: "Is this really free?",
      answer: "Yes — completely free, no sign-up, no watermark on the output.",
    },
    {
      question: "Does changing speed also change the BPM?",
      answer:
        "Yes, effectively — since this changes an already-recorded audio file rather than a MIDI tempo track, speeding it up compresses the time between beats, which raises its audible BPM proportionally. A 120 BPM track played at 200% speed sounds like roughly 240 BPM.",
    },
    {
      question: "Does it work on mobile?",
      answer: "Yes — it works in any mobile browser on iPhone or Android, no app install required.",
    },
    {
      question: "Can I restore the original speed later?",
      answer:
        "There's no saved history — this is a stateless upload-process-download tool. Re-upload the original file if you need a different speed afterward.",
    },
    {
      question: "Does this affect stereo audio?",
      answer:
        "No — time-stretching processes the channels without changing the stereo layout. Stereo files stay stereo.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free Audio Speed Changer
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Speed up or slow down a track without changing its pitch, free, no
            sign-up, no watermark.
          </p>
        </header>

        <TempoForm />

        {/* One bordered strip with hairline dividers, matching /vocal-remover,
            /stems and /pitch. */}
        <section className="grid divide-y divide-graphite-800 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { title: "50%–200%", desc: "Half speed to double speed." },
            { title: "Pitch unaffected", desc: "Key stays the same, only speed changes." },
            {
              title: "No sign-up",
              desc: maxDurationLabel
                ? `No account, no watermark. Up to ${maxUploadLabel} and ${maxDurationLabel}.`
                : `No account, no watermark. Up to ${maxUploadLabel} per file.`,
            },
          ].map((f) => (
            <div key={f.title} className="space-y-1.5 p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-400">
                {f.title}
              </p>
              <p className="text-sm leading-relaxed text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How it works</h2>
          <p className="text-text-muted leading-relaxed">
            Simply playing a file faster or slower changes its pitch along
            with its speed — that&apos;s how a turntable or tape sounds
            higher-pitched when sped up. This tool uses{" "}
            <strong className="text-text-primary">Rubberband</strong>, a
            time-stretching engine that analyzes the waveform and
            reconstructs it at the new duration while holding pitch steady,
            rather than just playing the same data back faster or slower.
            That&apos;s what makes it possible to change speed and pitch
            completely independently of each other.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to change audio speed</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an {formatList} file.</li>
            <li>Move the slider anywhere from 50% (half speed) to 200% (double speed).</li>
            <li>Apply the change.</li>
            <li>Download the result — pitch unchanged, speed and duration adjusted.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Tempo Changer vs. Pitch Shifter</h2>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-sm text-left text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">
                    <span className="sr-only">Comparison</span>
                  </th>
                  <th className="px-4 py-3 font-semibold">Tempo Changer</th>
                  <th className="px-4 py-3 font-semibold">Pitch Shifter</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Changes</td>
                  <td className="px-4 py-3">Playback speed</td>
                  <td className="px-4 py-3">Musical key / pitch</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Stays the same</td>
                  <td className="px-4 py-3">Pitch and key</td>
                  <td className="px-4 py-3">Tempo and duration</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Range</td>
                  <td className="px-4 py-3">50%–200% speed</td>
                  <td className="px-4 py-3">±1 octave (12 semitones)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-text-muted leading-relaxed">
            One nuance worth knowing if you work in a DAW: in a MIDI or
            multi-track project, &quot;tempo&quot; (the BPM setting) and
            &quot;playback speed&quot; of an audio file are genuinely
            different things — changing a project&apos;s tempo doesn&apos;t
            necessarily change an audio clip&apos;s speed unless it&apos;s
            warped to follow. But for an already-rendered audio file like
            what this tool processes, speeding it up does proportionally
            raise its audible BPM, so &quot;tempo&quot; and
            &quot;speed&quot; end up meaning the same practical thing here.
          </p>
          <p className="text-text-muted leading-relaxed">
            Want the deeper explanation of why tempo and pitch are usually linked,
            and how much you can push a tempo change before it starts sounding
            artificial?{" "}
            <Link href="/guides/dj-tempo-matching-without-pitch-shift" className="text-amber-400 hover:underline">
              Read How to Match Tempo Without Changing Pitch
            </Link>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Why extreme speed changes sound different</h2>
          <p className="text-text-muted leading-relaxed">
            Moderate speed changes — within roughly 10–20% of the original —
            tend to sound close to transparent, since the engine only has to
            reconstruct a small amount of extra or missing waveform data.
            Pushing further toward the 50% or 200% ends of the range means
            reconstructing much more of the signal, and that&apos;s where
            artifacts start showing up: sharp transients like drum hits or
            plucked strings can smear slightly, since a single instant in the
            original has to be stretched or compressed across a different
            span of time. It&apos;s not a flaw so much as the inherent
            tradeoff of asking a time-stretching algorithm to do more work —
            staying closer to 100% keeps results cleaner, and pushing toward
            the extremes trades some fidelity for the bigger change.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common uses</h2>
          <ul className="list-disc list-inside space-y-1.5 text-text-muted leading-relaxed">
            <li>Slowing a track down to learn a fast guitar solo, drum pattern, or piano passage note-by-note</li>
            <li>Speeding up a lecture, audiobook, or podcast to save time</li>
            {/* &apos; rather than a bare apostrophe — react/no-unescaped-entities
                errors on the raw form, and next build doesn't run ESLint, so it
                would only surface on a lint run. */}
            <li>Nudging a track&apos;s tempo to match another for a DJ mashup or beatmatch, without shifting the key</li>
            <li>Slowing down choreography or dance reference audio for practice</li>
            <li>Slowing speech down for language-learning or transcription accuracy</li>
            <li>Speeding through recorded meetings or interviews to skim faster</li>
          </ul>
          <p className="text-text-muted leading-relaxed">
            Want to know the key before you start matching tempos? Run the track
            through the{" "}
            <Link href="/key-finder" prefetch={false} className="text-amber-400 hover:underline">
              Key &amp; BPM Finder
            </Link>{" "}
            first.
          </p>
          <p className="text-text-muted leading-relaxed">
            Need to change key without affecting speed? Use the{" "}
            <Link href="/pitch" prefetch={false} className="text-amber-400 hover:underline">
              Pitch Shifter
            </Link>{" "}
            instead — same engine, applied to pitch rather than speed.
          </p>
        </section>

        {relatedTools.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-text-primary">More free tools</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {relatedTools.map((tool) => (
                <Link
                  key={tool.slug}
                  href={`/${tool.slug}`}
                  prefetch={false}
                  className="rounded-xl border border-graphite-800 bg-graphite-900 p-4 hover:border-amber-500/40 transition-colors"
                >
                  <h3 className="font-semibold text-text-primary">{tool.name}</h3>
                  <p className="text-sm text-text-muted mt-1">{tool.shortDescription}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <FAQSection faqs={faqs} />
      </main>
    </>
  );
}