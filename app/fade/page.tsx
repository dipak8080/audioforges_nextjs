import type { Metadata } from "next";
import Link from "next/link";
import { FadeForm } from "@/components/converter/FadeForm";
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
 * NO FACTUAL ERROR ON THIS PAGE. 30 seconds per fade matches FADE_MAX_SECONDS
 * in FadeForm, 80MB is right, `keywords` was already absent and the HowTo
 * schema was already removed. Second page out of fifteen with nothing wrong on
 * it, after /video-to-audio.
 *
 * So this is the shared treatment only:
 *
 * 1. THE LENGTH LIMIT IS STATED. /fade isn't exempt and has no per-tool
 *    override, so it takes the audio_tools default of one hour. The page named
 *    the size cap and not the length one — not wrong, but the four pages that
 *    DID state a length all got it wrong, so silence was the safer failure and
 *    it's still worth closing.
 *
 * 2. RETENTION ANSWER ADDED, formats read from allowed_audio_formats, prefetch
 *    disabled on the tool grid, feature strip matched to the other pages.
 *
 * 3. One behavioural detail the page never mentioned: FadeForm clamps each
 *    fade against the track's own length, so a 30-second fade isn't available
 *    on a 20-second clip. Worth one sentence — someone with a short sample
 *    otherwise reads "up to 30 seconds" and finds the handle won't go there.
 */

const PAGE_TITLE = "Free Audio Fade In & Fade Out Online";
const PAGE_DESCRIPTION =
  "Add a smooth fade in and fade out to any MP3, WAV, FLAC, or other audio file online, free. Avoid clicks and hard cuts. No sign-up, no watermark.";

/**
 * The per-fade ceiling, from the same constant FadeForm enforces
 * (FADE_MAX_SECONDS). Not a backend limit — it's a client-side control range —
 * so there is nothing in /limits to read it from. If it changes, change it
 * there and here together.
 */
const MAX_FADE_SECONDS = 30;

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/fade` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/fade`,
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
// FadeForm/backend behavior. No performance, accuracy, or ranking claims.
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Audio Fade In/Out Tool",
  url: `${SITE_URL}/fade`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Independent fade in and fade out durations",
    `Up to ${MAX_FADE_SECONDS} seconds per fade`,
    "Output keeps the original file format",
    "No sign-up required",
    "No watermark",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Fade In/Out", item: `${SITE_URL}/fade` },
  ],
};
// NOTE: No HowTo schema — deprecated by Google (desktop since Sept 2023),
// no ranking or rich-result benefit remains.
// FAQPage schema is emitted by <FAQSection /> — do not duplicate it here.

export default async function FadePage() {
  const relatedTools = getRelatedTools("fade", 5);

  const limits = await getLimits();
  const durationCap = durationCapFor(limits, "fade");
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const faqs = [
    {
      question: "What is an audio fade?",
      answer:
        "A fade is a gradual change in volume over a short span, rather than an instant jump. A fade in ramps up from silence; a fade out ramps down to silence. Both smooth out what would otherwise be an abrupt start or stop.",
    },
    {
      question: "Do I need both a fade in and a fade out?",
      answer:
        "No — turn on just one if that's all you need. At least one of the two has to be enabled to submit, but they're otherwise independent.",
    },
    {
      question: "Can a fade prevent clicks and pops?",
      answer:
        "It addresses the most common cause: a hard cut at a point where the waveform isn't at zero, which produces a sudden jump in amplitude your speakers reproduce as a click. A fade ramps the volume down to (or up from) zero instead, removing that jump. It won't fix clicks caused by something else, like a corrupted file or a bad recording.",
    },
    {
      question: "How long should a fade be?",
      answer: `It depends on the use. A loop point usually wants a very short fade, since anything long enough to be noticeable also changes how the loop sounds on repeat. A podcast outro or the end of a voice recording can take a longer, more deliberate fade without feeling abrupt. Up to ${MAX_FADE_SECONDS} seconds is available for either fade.`,
    },
    {
      /*
        ADDED. FadeForm clamps each fade against the track's own length — two
        fades can never overlap past the end of the file — so the ceiling on a
        short clip is the clip, not the 30 seconds the page advertises.
        Someone with a 20-second sample otherwise reads "up to 30 seconds" and
        finds the handle refuses to go there.
      */
      question: `Why won't my fade go to ${MAX_FADE_SECONDS} seconds?`,
      answer: `Because the clip is shorter than that, or the other fade is using the room. Each fade is capped at ${MAX_FADE_SECONDS} seconds OR whatever the track's length leaves after the other one — a 20-second clip can't hold two 15-second fades, so the handles stop where they'd collide. The limit you hit on a short file is the file, not the tool.`,
    },
    {
      question: "What's the difference between a fade and a volume adjustment?",
      answer:
        "A volume adjustment changes the loudness of the whole file by a fixed amount. A fade changes loudness progressively, over a duration you set, specifically at the start and/or end — the rest of the file is untouched either way.",
    },
    {
      question: "What's the difference between a fade and trimming?",
      answer:
        "Trimming cuts a file down to a specific start and end point, removing everything outside that range. A fade doesn't remove any audio — it smooths the volume at whatever start and end points you already have.",
    },
    {
      question: "Does fading reduce audio quality?",
      answer:
        "No — a fade only adjusts the volume envelope at the start and/or end of the file. The output keeps the same format as the file you uploaded.",
    },
    {
      question: "Will this change my file format?",
      answer: "No — the output keeps the same format as the file you uploaded.",
    },
    {
      question: "What audio formats are supported?",
      answer: `${formatList}.`,
    },
    {
      // The length half was never stated. /fade takes the audio_tools default.
      question: "Is there a file size or length limit?",
      answer:
        durationCap === null
          ? `Yes, ${limits.maxUploadMb}MB per upload, with no length limit.`
          : `Yes — ${limits.maxUploadMb}MB per upload, and up to ${durationLabel(durationCap)} of audio.`,
    },
    {
      question: "Can I trim my file first and then add a fade?",
      answer:
        "Yes — trim it down with the Audio Trimmer first, then run the result through this tool to add a fade to the trimmed clip.",
      answerNode: (
        <>
          Yes — trim it down with the{" "}
          <Link href="/trim" className="text-amber-400 hover:underline">
            Audio Trimmer
          </Link>{" "}
          first, then run the result through this tool to add a fade to the
          trimmed clip.
        </>
      ),
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
            Free Audio Fade In &amp; Fade Out Online
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Add a smooth fade in and/or fade out to an MP3, WAV, FLAC, M4A,
            AAC, OGG, or AIFF file, free, no sign-up, no watermark.
          </p>
        </header>

        {/* Tool stays first — SEO content supports it, doesn't bury it */}
        <FadeForm />

        {/* One bordered strip with hairline dividers, matching the other tool
            pages. */}
        <section className="grid divide-y divide-graphite-800 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { title: "Independent fades", desc: "Fade in and fade out lengths set separately." },
            { title: `Up to ${MAX_FADE_SECONDS}s each`, desc: "Plenty of range for a gentle or dramatic fade." },
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
          <h2 className="text-2xl font-bold text-text-primary">What is an audio fade?</h2>
          <p className="text-text-muted leading-relaxed">
            An audio fade is a gradual change in volume over a short span,
            rather than an instant jump from silence to full level or back.
            Instead of a track starting or stopping abruptly, the volume ramps
            up or down over a duration you choose. It&apos;s a small edit, but
            it shows up constantly across music, podcasts, voice recordings,
            and samples — anywhere a clip starts or ends somewhere other than
            a natural pause.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Fade in vs. fade out</h2>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-sm text-left text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">
                    <span className="sr-only">Comparison</span>
                  </th>
                  <th className="px-4 py-3 font-semibold">Fade In</th>
                  <th className="px-4 py-3 font-semibold">Fade Out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Direction</td>
                  <td className="px-4 py-3">Silence → full volume</td>
                  <td className="px-4 py-3">Full volume → silence</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Applied at</td>
                  <td className="px-4 py-3">Start of the file</td>
                  <td className="px-4 py-3">End of the file</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Typical use</td>
                  <td className="px-4 py-3">Easing into a track that begins mid-waveform</td>
                  <td className="px-4 py-3">Smoothing a cut point at the end of a clip</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-text-muted leading-relaxed">
            They&apos;re independent settings — plenty of clips only need one.
            A recording that already starts cleanly from silence might only
            need a fade out where it was trimmed; a clip pulled from the
            middle of a longer file might want both. The one place they
            interact is length: the two together can&apos;t exceed the track,
            so on a short clip each handle stops before it would collide with
            the other.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to fade audio online</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an {formatList} file.</li>
            <li>Turn on fade in and/or fade out and set how many seconds each should last.</li>
            <li>Download the result.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How long should an audio fade be?</h2>
          <p className="text-text-muted leading-relaxed">
            It depends on what the fade is covering for. A loop point
            generally wants a very short fade — anything long enough to be
            noticeable also changes how the loop sounds each time it repeats.
            A podcast outro or the end of a voice recording can usually take a
            longer, more deliberate fade without feeling abrupt. The general
            trade-off: too short and a loud, sudden waveform might still
            produce an audible click; too long and the fade itself becomes an
            obvious part of the audio rather than an invisible fix. Either
            fade can run up to {MAX_FADE_SECONDS} seconds here, or as long as
            the track leaves once the other fade has its share.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Why audio clicks at hard cuts</h2>
          <p className="text-text-muted leading-relaxed">
            When a clip is cut at a point where the waveform isn&apos;t sitting
            at zero, the sudden jump in amplitude produces an audible click or
            pop right at the cut. A fade ramps the volume to (or from) zero
            over a short span instead of jumping instantly, which removes
            that discontinuity. This is why trimmed clips, exported loops, and
            podcast intros/outros almost always use one at the edges.
          </p>
          <p className="text-text-muted leading-relaxed">
            Want the fuller explanation of why this happens and how to judge
            fade length for different situations?{" "}
            <Link href="/guides/why-audio-needs-a-fade-in-out" className="text-amber-400 hover:underline">
              Read Why Trimmed Audio Clips Need a Fade In and Out
            </Link>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common uses</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              Smoothing the start and end of a trimmed clip, giving a podcast
              intro or outro a professional finish, avoiding a click at a loop
              point in a sample, softening the end of a ringtone or
              notification sound, easing into or out of a voice-over
              recording, and cleaning up the audio track under a video
              transition.
            </p>
            <p>
              Making a ringtone specifically? The{" "}
              <Link href="/ringtone-maker" className="text-amber-400 hover:underline">
                Ringtone Maker
              </Link>{" "}
              trims a clip to length in one step — fade it afterward here if
              you want a softer start or end.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Fade vs. volume adjustment</h2>
          <p className="text-text-muted leading-relaxed">
            A volume adjustment changes the loudness of the entire file by a
            fixed amount — the whole track gets louder or quieter, uniformly.
            A fade changes loudness progressively, over a duration you choose,
            specifically at the start and/or end of the file. If what you
            actually need is the whole track louder or quieter throughout, the{" "}
            <Link href="/volume" className="text-amber-400 hover:underline">
              Volume Booster
            </Link>{" "}
            is the right tool instead.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Fade vs. trim</h2>
          <p className="text-text-muted leading-relaxed">
            Trimming cuts a file down to a specific start and end point,
            removing everything outside that range. Fading doesn&apos;t remove
            any audio — it smooths the volume at whatever start and end points
            already exist. The two pair naturally: trim a clip out of a longer
            recording with the{" "}
            <Link href="/trim" className="text-amber-400 hover:underline">
              Audio Trimmer
            </Link>{" "}
            first, then run the trimmed result through this tool if the new
            cut points need a fade to sound clean.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Supported formats</h2>
          {/* Rendered from the backend's allowed_audio_formats rather than a
              hand-written array — the mechanism that left AIFF off /stems. */}
          <div className="flex flex-wrap gap-2">
            {formats.map((format) => (
              <span
                key={format}
                className="rounded-lg border border-graphite-700 bg-graphite-850 px-3 py-1.5 font-mono text-sm font-semibold text-amber-400"
              >
                {format}
              </span>
            ))}
          </div>
          <p className="text-text-muted leading-relaxed">
            Upload any of the formats above, up to {limits.maxUploadMb}MB per file
            {durationCap !== null ? ` and ${durationLabel(durationCap)} long` : ""}. The
            output keeps the same format you uploaded.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Does fading affect audio quality?</h2>
          <p className="text-text-muted leading-relaxed">
            No — a fade only adjusts the volume envelope at the start and/or
            end of the file; it doesn&apos;t alter the rest of the content, and
            the output keeps the same format as what you uploaded rather than
            converting to something else.
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