import type { Metadata } from "next";
import Link from "next/link";
import { LoudnormForm } from "@/components/converter/LoudnormForm";
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
 * FACTUALLY CLEAN. 80MB is right, the three presets match LoudnormForm, and
 * the two-pass description matches what the backend actually does. Third page
 * out of nineteen with nothing wrong in the copy.
 *
 * 1. FOUR UNESCAPED APOSTROPHES WOULD FAIL LINT. Raw ' inside JSX text —
 *    "Spotify's and YouTube's own", "since it's close to" — trips
 *    react/no-unescaped-entities under Next's default config, which fails the
 *    build rather than warning. Every other apostrophe on the page is
 *    correctly &apos;, so these were added in a later edit and missed. Same
 *    class as the one already fixed on /tempo.
 *
 * 2. The length limit is now stated (one hour, the audio_tools default). This
 *    page needs it more than most: a mastered track is often the longest file
 *    someone uploads anywhere on the site, and a DJ set can run well past it.
 *
 * 3. Retention answer added, formats read from allowed_audio_formats, prefetch
 *    disabled on the tool grid, feature strip matched to the other pages.
 */

const PAGE_TITLE = "Free LUFS Loudness Normalizer – Normalize Audio Online";
const PAGE_DESCRIPTION =
  "Normalize a track to streaming, club, or broadcast loudness (LUFS) online, free. Two-pass accurate normalization. No sign-up, no watermark.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/loudness-normalizer` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/loudness-normalizer`,
    siteName: SITE_NAME,
    type: "website",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630, alt: "AudioForges" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/images/og-default.png"],
  },
};

// WebApplication schema — every claim below is checked against the actual
// LoudnormForm/backend behavior. Preset labels only, not asserted as
// universal cross-platform standards (see visible copy for the caveat).
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "LUFS Loudness Normalizer",
  url: `${SITE_URL}/loudness-normalizer`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Two-pass accurate loudness normalization",
    "Streaming, club, and broadcast loudness presets",
    "Custom LUFS target",
    "No sign-up required",
    "No watermark",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Loudness Normalizer", item: `${SITE_URL}/loudness-normalizer` },
  ],
};
// NOTE: No HowTo schema — deprecated by Google (desktop since Sept 2023),
// no ranking or rich-result benefit remains. Visible how-to steps stay.
// FAQPage schema is emitted by <FAQSection /> — do not duplicate it here.

export default async function LoudnessNormalizerPage() {
  const relatedTools = getRelatedTools("loudness-normalizer", 5);

  const limits = await getLimits();
  const durationCap = durationCapFor(limits, "loudness-normalizer");
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const faqs = [
    {
      question: "What is LUFS?",
      answer:
        "Loudness Units relative to Full Scale — a standardized way of measuring perceived loudness across an entire track, rather than just peak level. It's the measurement streaming platforms and broadcasters actually use to normalize playback volume.",
    },
    {
      question: "What LUFS should I master to for Spotify?",
      answer:
        "Spotify's default normalization target is -14 LUFS integrated. Mastering at or near that level means Spotify applies little or no correction on playback, so your track keeps the dynamics you intended rather than getting turned down.",
    },
    {
      question: "Why does this matter for streaming platforms?",
      answer:
        "Streaming services normalize playback loudness rather than playing tracks at whatever level they were mastered, but the exact target isn't identical everywhere. Spotify normalizes to -14 LUFS. Apple Music normalizes closer to -16 LUFS, a bit quieter. A track mastered significantly louder than a platform's target gets turned down on playback and can end up sounding flatter or less punchy than one that was already close to target.",
    },
    {
      question: "What's the difference between the presets?",
      answer:
        "Streaming (-14 LUFS) is a reasonable single target if you're releasing to multiple platforms at once, close to what Spotify normalizes to. Club (-9 LUFS) is louder, matching typical club/DJ mastering conventions. Broadcast (-23 LUFS) follows the EBU R128 / ATSC A/85 standard used in TV and radio.",
    },
    {
      question: "Why two-pass normalization instead of one pass?",
      answer:
        "A single pass estimates the correction in real time as it streams through the file, which can miss the target by a full LU or more on tracks with uneven dynamics. Two-pass first measures the track's actual loudness, true peak, and dynamic range in a dedicated analysis pass, then applies the exact correction needed — the result lands on target far more reliably.",
    },
    {
      question: "Will this affect the dynamic range of my track?",
      answer:
        "Normalization adjusts overall level to hit the target loudness; it doesn't compress or limit the track's internal dynamics beyond what's needed to stay under the true peak ceiling.",
    },
    {
      /*
        The length half was never stated. It matters here: a finished master is
        often the longest file someone uploads anywhere on the site, and a DJ
        set can run well past the cap.
      */
      question: "Is there a size or length limit?",
      answer:
        durationCap === null
          ? `Yes, ${limits.maxUploadMb}MB per upload, with no length limit.`
          : `Yes — ${limits.maxUploadMb}MB per upload, and up to ${durationLabel(durationCap)} of audio. A long DJ set can run past that; splitting it first is the workaround.`,
    },
    {
      // ADDED: no retention answer existed.
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: "Is this really free?",
      answer: "Yes — completely free, no sign-up, no watermark on the output.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free LUFS Loudness Normalizer
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Normalize a track to streaming, club, or broadcast loudness (LUFS),
            free, no sign-up, no watermark.
          </p>
        </header>

        {/* Tool stays first — SEO content supports it, doesn't bury it */}
        <LoudnormForm />

        {/* One bordered strip with hairline dividers, matching the other tool
            pages. */}
        <section className="grid divide-y divide-graphite-800 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { title: "Two-pass accurate", desc: "Measures actual loudness first, then corrects precisely." },
            { title: "3 presets + custom", desc: "Streaming, club, broadcast, or your own LUFS target." },
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
          <h2 className="text-2xl font-bold text-text-primary">How to normalize loudness</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an {formatList} file.</li>
            <li>Choose Streaming, Club, Broadcast, or set a custom LUFS target.</li>
            <li>Download the result — measured and corrected in two passes for accuracy.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Why loudness matching matters for streaming</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              Streaming platforms don&apos;t play tracks at whatever level
              they were mastered — each one normalizes playback to its own
              target, turning louder tracks down to match it. The exact
              target isn&apos;t identical everywhere, though: Spotify&apos;s
              default normalization level is -14 LUFS integrated, and YouTube
              sits in the same neighborhood, while Apple Music normalizes
              closer to -16 LUFS — a bit quieter than the other two. A track
              mastered significantly louder than a platform&apos;s target gets
              turned down on playback and can end up sounding flatter or less
              punchy relative to a track that was already close to it.
            </p>
            <p>
              Mastering with a platform&apos;s target in mind ahead of time
              means the platform has less (or no) correction to apply,
              preserving more of the intended dynamics and impact. -14 LUFS is
              a reasonable single target if you&apos;re releasing to more than
              one platform at once, since it&apos;s close to what Spotify and
              YouTube both normalize toward.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What LUFS level should you use?</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              <strong className="text-text-primary">-14 LUFS (Streaming):</strong>{" "}
              a reasonable single target for releasing to multiple streaming
              platforms at once — close to Spotify&apos;s and YouTube&apos;s own
              normalization level.
            </p>
            <p>
              <strong className="text-text-primary">-9 LUFS (Club):</strong>{" "}
              louder, matching common club and DJ mastering conventions where
              the material is played through a system built for a loud room
              rather than normalized playback.
            </p>
            <p>
              <strong className="text-text-primary">-23 LUFS (Broadcast):</strong>{" "}
              the EBU R128 / ATSC A/85 standard used in TV and radio delivery —
              considerably quieter than either streaming or club targets.
            </p>
            <p>
              <strong className="text-text-primary">Custom:</strong> useful
              when a specific platform, client, or delivery spec gives you an
              exact LUFS target that doesn&apos;t match any of the presets
              above.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Why two passes instead of one</h2>
          <p className="text-text-muted leading-relaxed">
            A single-pass loudness correction estimates the needed adjustment
            in real time as it streams through the file — a reasonable
            approximation, but one that can miss the actual target by a
            noticeable margin on tracks with uneven loudness throughout. This
            tool always runs two passes: the first measures the track&apos;s
            true integrated loudness, peak, and dynamic range with the whole
            file already analyzed; the second applies the exact correction
            those measurements call for. The cost is one extra decode pass;
            the benefit is a result that actually lands on the target you
            asked for.
          </p>
          <p className="text-text-muted leading-relaxed">
            Want the fuller breakdown of LUFS vs. peak level, and why
            different platforms genuinely target different loudness levels?{" "}
            <Link href="/guides/what-is-lufs-loudness-explained" className="text-amber-400 hover:underline">
              Read What Is LUFS, and Why Does Streaming Loudness Matter?
            </Link>
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common uses</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              Preparing a track for upload to Spotify, YouTube, or Apple
              Music at a competitive loudness level; mastering a DJ set or
              club track to a louder, dancefloor-appropriate level;
              delivering audio to broadcast at the EBU R128 standard; and
              matching loudness across a batch of tracks so a playlist
              doesn&apos;t have jarring volume jumps between songs.
            </p>
            <p>
              Working from a raw mix that&apos;s too quiet or too loud
              overall before normalizing? The{" "}
              <Link href="/volume" prefetch={false} className="text-amber-400 hover:underline">
                Volume Booster
              </Link>{" "}
              adjusts gain by a fixed decibel amount instead of a
              loudness-standard target, which is a simpler tool if you just
              need a quick gain change rather than accurate LUFS matching.
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