import type { Metadata } from "next";
import Link from "next/link";
import { ReverseForm } from "@/components/converter/ReverseForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import {
  getLimits,
  durationCapFor,
  durationLabel,
  retentionSentences,
} from "@/lib/api/limits";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. THE LENGTH LIMIT WAS UNDERSTATED BY FORTY MINUTES — the fourth page with
 *    this exact error, after /trim, /volume and (in the other direction)
 *    /pitch. "Files up to 80MB and 20 minutes long": the size was right, the
 *    length is one hour. And 20 minutes is the transcription cap again, which
 *    is where all three copied it from.
 *
 *    Worth naming the pattern rather than just fixing the instance: a length
 *    limit typed as a literal has been wrong on more than half the pages that
 *    state one, always downward, and never in a way that produces an error.
 *
 * 2. The HowTo schema and `keywords` removed, retention answer added, formats
 *    read from allowed_audio_formats, prefetch disabled on the tool grid.
 */

const PAGE_TITLE = "Free Audio Reverser — Play a Track Backwards";
const PAGE_DESCRIPTION =
  "Reverse MP3, WAV, FLAC, AAC, M4A, OGG, and AIFF files online for free. Create backwards audio instantly with no sign-up, no watermark, and no software required.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  /*
    `keywords` removed — ignored by Google since 2009. Target terms kept for
    reference:

      reverse audio / reverse audio online / audio reverser
      play audio backwards / reverse audio online free
      reverse mp3 / reverse wav / reverse song / reverse music
      backwards audio / flip audio track / reverse sound
      reverse recording / reverse voice recording
      reverse audio effect / backwards music
  */
  alternates: { canonical: `${SITE_URL}/reverse` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/reverse`,
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
  name: "Audio Reverser",
  url: `${SITE_URL}/reverse`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Reverse any audio file",
    "Keeps original format",
    "No sign-up required",
    "No watermark",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Audio Reverser", item: `${SITE_URL}/reverse` },
  ],
};
// NOTE: No HowTo schema — deprecated by Google (desktop since Sept 2023), no
// ranking or rich-result benefit remains. Visible how-to steps stay.
// FAQPage schema is emitted by <FAQSection /> — do not duplicate it here.

export default async function ReversePage() {
  const relatedTools = getRelatedTools("reverse", 5);

  const limits = await getLimits();
  const durationCap = durationCapFor(limits, "reverse");
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const faqs = [
    {
      question: "What does reversing audio do?",
      answer:
        "It flips the entire file so it plays back to front — the last sound becomes the first, and vice versa.",
    },
    {
      question: "Does reversing reduce audio quality?",
      answer:
        "No. Reversing changes the playback order only, not the underlying audio data. Since the output stays in your original format, there's no additional quality loss beyond that format's normal characteristics.",
    },
    {
      question: "Can I reverse just part of a track?",
      answer:
        "This tool reverses the entire file. If you only want a section reversed, trim the clip you want first, then reverse the trimmed result.",
    },
    {
      question: "Is this really free?",
      answer: "Yes — reversing audio is free, with no sign-up and no watermark on the output.",
    },
    {
      question: "What formats are supported?",
      answer: `${formatList}. The output keeps the same format as your upload.`,
    },
    {
      /*
        CORRECTED. Said "up to 80MB and 20 minutes long". The size was right;
        the length was wrong by forty minutes — /reverse takes the audio_tools
        default of one hour. Both figures now come from /limits.
      */
      question: "Is there a file size or length limit?",
      answer:
        durationCap === null
          ? `Files up to ${limits.maxUploadMb}MB are supported, with no length limit.`
          : `Files up to ${limits.maxUploadMb}MB and ${durationLabel(durationCap)} long are supported.`,
    },
    {
      // ADDED: no retention answer existed.
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: "Can I reverse a voice recording?",
      answer:
        "Yes. The tool works with voice recordings, podcasts, music, sound effects, and any other supported audio file.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free Audio Reverser
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Upload a track and get it back flipped backwards, free, no sign-up, no
            watermark.
          </p>
        </header>

        <ReverseForm />

        {/* One bordered strip with hairline dividers, matching the other tool
            pages. The third cell carries the limits — this page stated them
            only in the FAQ, and stated one of them wrongly. */}
        <section className="grid divide-y divide-graphite-800 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { title: "Fast", desc: "Most reversals finish in a few seconds." },
            { title: "One click", desc: "No settings to configure — just upload." },
            {
              title: "No sign-up",
              desc:
                durationCap === null
                  ? `No account, no email, no watermark. Up to ${limits.maxUploadMb}MB per file.`
                  : `No account, no email, no watermark. Up to ${limits.maxUploadMb}MB and ${durationLabel(durationCap)}.`,
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
          <h2 className="text-2xl font-bold text-text-primary">How to reverse an audio file</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an {formatList} file.</li>
            <li>Click Reverse — nothing to configure.</li>
            <li>Download the reversed file, same format as your upload.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Why reverse audio?</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              Reversed audio is a classic production trick — reversed cymbal swells and
              vocal chops are staples in melodic house, hip-hop, and cinematic sound
              design. It&apos;s also handy for spotting hidden or backmasked content in a
              recording, or just for creative sound experiments.
            </p>
            <p>
              The output keeps your original file format, so a WAV stays a WAV and an
              MP3 stays an MP3 — no extra conversion step needed.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Reverse audio vs. reverse playback</h2>
          <p className="text-text-muted leading-relaxed">
            Reversing an audio file here creates an actual new file with every
            sample rearranged in the opposite order — something you can
            download, share, edit, or drop straight into a DAW.
          </p>
          <p className="text-text-muted leading-relaxed">
            Reverse playback is a different thing entirely: some media
            players can temporarily play a file backwards while
            you&apos;re listening, without ever creating a new file — close
            the player and there&apos;s nothing saved. This tool does the
            former, permanently generating a reversed copy you can keep and
            use anywhere, not just a playback trick in one app.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Does reversing change quality?</h2>
          <p className="text-text-muted leading-relaxed">
            No. Reversing only changes the playback order of the audio — every
            sample stays exactly as it was, just read back to front. Since the
            output keeps your original format, there&apos;s no extra quality loss
            beyond whatever that format&apos;s normal characteristics already are.
            A reversed WAV is exactly as lossless as the WAV you uploaded.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common uses</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              <strong className="text-text-primary">Music production:</strong>{" "}
              reversed cymbal swells, risers, and vocal chops — staples in melodic
              house, hip-hop, and cinematic sound design.
            </p>
            <p>
              <strong className="text-text-primary">Sound design &amp; SFX:</strong>{" "}
              flip a recorded sound effect for a distinctive texture that a forward
              sound simply doesn&apos;t have. Need to change the speed of the
              reversed audio too? Run it through the{" "}
              <Link href="/tempo" className="text-amber-400 hover:underline">
                Audio Speed Changer
              </Link>{" "}
              afterward.
            </p>
            <p>
              <strong className="text-text-primary">Backmasking curiosity:</strong>{" "}
              check a track or recording for hidden or unintentional content by
              listening to it in reverse.
            </p>
            <p>
              <strong className="text-text-primary">Creative experiments:</strong>{" "}
              reverse a voice memo, a field recording, or anything else just to hear
              what it sounds like flipped.
            </p>
            <p>
              Only need part of a track reversed, not the whole file? Trim the
              section you want with the{" "}
              <Link href="/trim" className="text-amber-400 hover:underline">
                Audio Trimmer
              </Link>{" "}
              first, then reverse the trimmed clip.
            </p>
            <p>
              Want the deeper explanation of how reversed swells and vocal chops
              are actually built?{" "}
              <Link href="/guides/reversed-audio-in-music-production" className="text-amber-400 hover:underline">
                Read Reversed Audio: Creative Uses in Production
              </Link>.
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