import type { Metadata } from "next";
import Link from "next/link";
import { PitchForm } from "@/components/converter/PitchForm";
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
 * 1. THE FAQ UNDERSTATED THE LIMIT BY 40%. It said "3 requests per 5 minutes",
 *    typed as a literal. rate-limits.ts raised `pitch` from 3 to 5 on
 *    2026-08-22, and the reason it was raised is exactly the reason this
 *    sentence matters: pitch and tempo are the only ITERATIVE tools on the
 *    site — the real workflow is +2, listen, +3, listen — so someone reading
 *    "3" plans a smaller experiment than they're actually allowed.
 *
 * 2. THE HowTo SCHEMA IS GONE. Google deprecated HowTo rich results on desktop
 *    in September 2023; no ranking or rich-result benefit remains.
 *
 * 3. THE `keywords` META IS GONE. Ignored by Google since 2009.
 *
 * 4. THE PAGE NEVER STATED ITS OWN LIMITS. PitchForm blocks submission over
 *    the duration cap and validateAudioFile rejects over the size cap — but
 *    neither number appeared anywhere a visitor could read BEFORE choosing a
 *    file.
 *
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 5. THE RETENTION ANSWER IS NOW WRITTEN, and the note this file used to carry
 *    is exactly why it wasn't before:
 *
 *      "NOT ADDED: a retention answer. Nobody has told me what happens to a
 *       pitch job's file, and the lesson from /vocal-remover is that a
 *       retention claim written on an assumption is worse than none — it
 *       shipped wrong there and sat wrong for weeks. Ask, then write it."
 *
 *    That was the right call, and the asking is done. The backend published a
 *    retention block on 2026-08-30: pitch is an `audio_tools` job, so the
 *    input is deleted when the job ends and the output is held an hour. The
 *    sentences come from retentionSentences() rather than from prose, so this
 *    one can't drift the way /vocal-remover's did.
 *
 * 6. ALL THREE LIMITS NOW READ FROM /limits rather than the hand tables. The
 *    figures don't change — they were corrected in the earlier pass — but the
 *    source does, which is what stops a literal creeping back in.
 */

const PAGE_TITLE = "Free Pitch Shifter — Change Key Without Changing Speed";
const PAGE_DESCRIPTION =
  "Change audio pitch or transpose music online for free. Shift MP3, WAV, FLAC, AAC, M4A, OGG, and AIFF up or down by up to 12 semitones without changing tempo.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  // `keywords` removed: ignored by Google since 2009, and no other tool page
  // on the site carries it.
  alternates: { canonical: `${SITE_URL}/pitch` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/pitch`,
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
  name: "Pitch Shifter",
  url: `${SITE_URL}/pitch`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Shift pitch up to 1 octave either direction",
    "Independent of tempo",
    "No sign-up required",
    "No watermark",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Pitch Shifter", item: `${SITE_URL}/pitch` },
  ],
};

// NOTE: No HowTo schema — deprecated by Google (desktop since Sept 2023), no
// ranking or rich-result benefit remains. Visible how-to steps stay.
// FAQPage schema is emitted by <FAQSection /> — do not duplicate it here.

export default async function PitchPage() {
  const relatedTools = getRelatedTools("pitch", 5);

  const limits = await getLimits();

  /*
    The rate limit is the figure that was wrong here: the FAQ typed "3 per 5
    minutes" while the config had allowed 5 since 2026-08-22 — a 40%
    understatement on the one tool where the workflow is genuinely iterative.
  */
  const rateLimitText = rateLimitLabel(limits.rateLimits.pitch ?? 5, windowFor(limits, "pitch"));

  /*
    900s — one of only two per-tool duration overrides, and both were wired up
    on the backend the morning of 2026-08-30. Before that, pitch silently took
    the 3600 default, so a page saying "an hour" was right the day before and
    rejects real uploads now.
  */
  const durationCap = durationCapFor(limits, "pitch");
  const maxDurationLabel = durationCap === null ? null : durationLabel(durationCap);
  const maxUploadLabel = `${limits.maxUploadMb}MB`;

  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const faqs = [
    {
      question: "Does pitch shifting change the tempo?",
      answer:
        "No — pitch is shifted independently of tempo, so the duration and speed of the track stay exactly the same, only the pitch moves.",
    },
    {
      question: "How much can I shift the pitch?",
      answer: "Up to 12 semitones in either direction — a full octave up or down.",
    },
    {
      question: "Will shifting pitch affect audio quality?",
      answer:
        "Small shifts of a semitone or two are close to transparent. Larger shifts toward a full octave start to noticeably affect timbre, since formants — the resonances that give a voice or instrument its characteristic tone — shift along with the pitch.",
    },
    {
      question: "What's the difference between pitch and key?",
      answer:
        "Pitch is the raw frequency of a sound; key is the overall tonal center a piece of music is built around. Shifting a track's pitch by a fixed number of semitones effectively transposes it into a new key.",
    },
    {
      // The tool blocks both of these before anything uploads, and neither
      // number appeared anywhere on the page — so the first time a visitor
      // learned the limit was when the button refused to run.
      question: "Is there a size or length limit?",
      answer: maxDurationLabel
        ? `Yes — up to ${maxUploadLabel} per file, and up to ${maxDurationLabel} of audio. Longer files are caught in your browser before anything uploads, so you're not left waiting on a transfer that gets rejected at the end.`
        : `Yes — up to ${maxUploadLabel} per file.`,
    },
    {
      // Was "3 requests per 5 minutes", typed as a literal, while the config
      // has said 5 since 2026-08-22 — raised deliberately BECAUSE this tool is
      // iterative and three locked people out mid-decision.
      question: "Why is there a stricter limit on this tool?",
      answer: `Pitch shifting is more CPU-intensive than a simple conversion, so it's limited to ${rateLimitText} to keep it available for everyone. That's deliberately higher than the older limit, because transposing is usually iterative — shift, listen, adjust.`,
    },
    {
      /*
        ADDED. This page deliberately carried no retention answer, with a note
        saying to ask the backend first rather than assume — because the
        assumed version on /vocal-remover shipped wrong and sat wrong for
        weeks. The backend answered on 2026-08-30, so it can be written now,
        from its block rather than from a guess.
      */
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: "Is this really free?",
      answer: "Yes — completely free, no sign-up, no watermark on the output.",
    },
    {
      question: "Can I change the key of a song without changing its speed?",
      answer:
        "Yes. This tool shifts pitch independently of tempo, so you can transpose a song into a different key while keeping its original duration.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free Pitch Shifter
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Shift a track&apos;s pitch up or down without touching its tempo, free, no
            sign-up, no watermark.
          </p>
        </header>

        <PitchForm />

        {/* One bordered strip with hairline dividers rather than three floating
            cards. Three separate boxes directly under the tool read as three
            more things to deal with; divided cells read as one row of facts
            about the thing above them. */}
        <section className="grid divide-y divide-graphite-800 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { title: "±1 octave", desc: "Shift up to 12 semitones either way." },
            { title: "Tempo unaffected", desc: "Duration and speed stay identical." },
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
          <h2 className="text-2xl font-bold text-text-primary">How to shift pitch</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an {formatList} file.</li>
            <li>Move the slider to your target shift — a semitone or two for subtle retuning, up to a full octave for a dramatic change.</li>
            <li>Apply the shift.</li>
            <li>Download the result — same tempo, new pitch.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Semitones and octaves explained</h2>
          <p className="text-text-muted leading-relaxed">
            Pitch is usually adjusted in semitones. Twelve semitones make one
            octave, so shifting a track by +12 moves every note one octave
            higher, while -12 moves everything one octave lower. Smaller
            adjustments of one or two semitones are commonly used to match a
            singer&apos;s vocal range or transpose a song into a more
            comfortable key.
          </p>
          <p className="text-text-muted leading-relaxed">
            Large pitch shifts are possible, but bigger changes naturally
            sound less realistic because voices and instruments take on
            different tonal characteristics as they move farther from their
            original range.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Pitch Shifter vs. Tempo Changer</h2>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-sm text-left text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">
                    <span className="sr-only">Comparison</span>
                  </th>
                  <th className="px-4 py-3 font-semibold">Pitch Shifter</th>
                  <th className="px-4 py-3 font-semibold">Tempo Changer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Changes</td>
                  <td className="px-4 py-3">Musical key / pitch</td>
                  <td className="px-4 py-3">Playback speed</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Stays the same</td>
                  <td className="px-4 py-3">Tempo and duration</td>
                  <td className="px-4 py-3">Pitch and key</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Range</td>
                  <td className="px-4 py-3">±1 octave (12 semitones)</td>
                  <td className="px-4 py-3">50%–200% speed</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-text-muted leading-relaxed">
            Want the deeper explanation of why these are two separate operations,
            and how a time-stretching engine keeps one variable fixed while
            changing the other?{" "}
            <Link href="/guides/pitch-shifting-vs-key-changing" className="text-amber-400 hover:underline">
              Read Pitch Shifting Explained: Semitones &amp; Musical Keys
            </Link>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Who uses a pitch shifter?</h2>
          <p className="text-text-muted leading-relaxed">
            Pitch shifting comes up for singers practicing in a different key,
            musicians transposing a backing track, DJs preparing harmonically
            compatible mixes, producers building vocal effects, and content
            creators nudging background music to better fit a project.
            Because tempo stays fixed, everything stays synchronized — only
            the musical key changes.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common uses</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              Transpose a track into a more comfortable vocal range for practice,
              change the key of a karaoke track to match your own range, test how a
              sample sounds in a different key before dropping it into a session, or
              create a pitched-up or pitched-down variation for a remix — all without
              the tempo shifting along with it, which is what a simple speed change
              would do instead. It&apos;s also useful for DJ mashups where two tracks
              need to sit in the same key, and for instrument practice when you want
              to play along in a different range.
            </p>
            <p>
              Not sure what key your source track is already in? Run it through the{" "}
              <Link href="/key-finder" prefetch={false} className="text-amber-400 hover:underline">
                Key &amp; BPM Finder
              </Link>{" "}
              first, then transpose it here to the key you need.
            </p>
            <p>
              Need to trim the audio before transposing it? Use the{" "}
              <Link href="/trim" prefetch={false} className="text-amber-400 hover:underline">
                Audio Trimmer
              </Link>{" "}
              first, then apply the pitch shift to only the section you need.
            </p>
            <p>
              Need to change speed without affecting pitch? Use the{" "}
              <Link href="/tempo" prefetch={false} className="text-amber-400 hover:underline">
                Tempo Changer
              </Link>{" "}
              instead — it&apos;s the same underlying approach, applied to speed
              rather than key.
            </p>
          </div>
        </section>

        {relatedTools.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-text-primary">More free tools</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {relatedTools.map((tool) => (
                <Link
                  key={tool.slug}
                  href={`/${tool.slug}`}
                  // prefetch disabled on bulk tool links — four edge requests
                  // per route adds up on a grid that renders on every tool page.
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