import type { Metadata } from "next";
import Link from "next/link";
import { TrimForm } from "@/components/converter/TrimForm";
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
 * Wired to /limits, following /convert. This page proves the other branch:
 * /convert is exempt and renders "no length limit", while /trim takes the
 * 3600 default and has to render a real figure.
 *
 * TWO REAL ERRORS, and the first is the more interesting kind.
 *
 * 1. THE LENGTH LIMIT WAS UNDERSTATED BY FORTY MINUTES. The FAQ said "up to 20
 *    minutes". /trim is not in exempt_tools and has no per-tool override, so
 *    it takes audio_tools_default_seconds — one hour.
 *
 *    Nobody was rejected by this. Someone with a 35-minute interview read
 *    "20 minutes", concluded the tool couldn't help, and left. That failure
 *    produces no error, no log line and no support ticket — it is strictly
 *    worse than the pitch/tempo case, where at least the rejection tells you
 *    something is wrong.
 *
 *    Where 20 came from is a guess, but it matches the transcription cap
 *    exactly, which is the sort of copy-paste that a derived number prevents.
 *
 * 2. THE PAGE SAID A TOOL DOESN'T EXIST THAT DOES. "Worth distinguishing from
 *    splitting... that's a different operation we don't currently offer as a
 *    dedicated tool." /silence-split is live — it's in RATE_LIMITS at 3 per 5
 *    minutes, runs through MultiOutputToolForm, and has its own segment-limit
 *    handling. Splitting one file into several pieces is precisely what it
 *    does.
 *
 *    So the page took someone who wanted exactly that, told them we don't do
 *    it, and sent them elsewhere. It now links to the tool.
 *
 * ALSO: retention answer added (this page had none), HowTo schema and
 * `keywords` meta removed, prefetch disabled on the tool grid, feature strip
 * matched to the other pages.
 */

export const metadata: Metadata = {
  title: "Free Audio Trimmer — Cut Any Track Online",
  description:
    "Trim or cut audio files online free. Cut MP3, WAV, FLAC, AAC, M4A, OGG, and AIFF with a precise start and end point. No sign-up, no watermark.",
  // `keywords` removed: ignored by Google since 2009, and no other tool page
  // on the site carries it any more.
  alternates: { canonical: `${SITE_URL}/trim` },
  openGraph: {
    title: "Free Audio Trimmer — Cut Any Track Online",
    description:
      "Trim or cut audio files online free. Cut MP3, WAV, FLAC, AAC, M4A, OGG, and AIFF with a precise start and end point. No sign-up, no watermark.",
    url: `${SITE_URL}/trim`,
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
    title: "Free Audio Trimmer — Cut Any Track Online",
    description:
      "Trim or cut audio files online free. Cut MP3, WAV, FLAC, AAC, M4A, OGG, and AIFF with a precise start and end point. No sign-up, no watermark.",
    images: ["/images/og-default.png"],
  },
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Audio Trimmer",
  url: `${SITE_URL}/trim`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Cut audio to any start/end point",
    "Keeps original format and quality",
    "No sign-up required",
    "No watermark",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Audio Trimmer", item: `${SITE_URL}/trim` },
  ],
};

// NOTE: No HowTo schema — deprecated by Google (desktop since Sept 2023), no
// ranking or rich-result benefit remains. Visible how-to steps stay. This
// matches /convert, /stems, /vocal-remover, /pitch and /tempo.
// FAQPage schema is emitted by <FAQSection /> — do not duplicate it here.

export default async function TrimPage() {
  const relatedTools = getRelatedTools("trim", 5);

  const limits = await getLimits();

  // Bare lowercase from the API ("mp3"); uppercase is a display choice.
  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", and $1");

  /*
    NOT null here, unlike /convert. /trim has no per-tool override and isn't
    exempt, so this resolves to audio_tools_default_seconds — one hour. The
    hand-written FAQ said twenty minutes, which matched nothing on the backend
    and quietly cost every user with a longer file.
  */
  const durationCap = durationCapFor(limits, "trim");
  const retention = retentionSentences(limits.retention.audio_tools);

  const faqs = [
    {
      question: "Does trimming change the audio quality?",
      answer:
        "No — trimming just cuts the selected range and keeps your original format, with no quality loss beyond the format's normal characteristics.",
    },
    {
      question: "What's the difference between trimming and cutting?",
      answer:
        "For this tool, they mean the same thing — selecting a start and end point and keeping only what's in between. \"Trim\" and \"cut\" are just different words people use for the same operation.",
    },
    {
      question: "Can I remove silence throughout a track, not just the ends?",
      answer:
        "That's a separate tool. Trim cuts to a single start and end point; the Silence Remover strips silent gaps everywhere in the file, not just the edges.",
      answerNode: (
        <>
          That&apos;s a separate tool. Trim cuts to a single start and end
          point; the{" "}
          <Link href="/silence-remove" className="text-amber-400 hover:underline">
            Silence Remover
          </Link>{" "}
          strips silent gaps everywhere in the file, not just the edges.
        </>
      ),
    },
    {
      question: "Is this really free?",
      answer: "Yes — completely free, no sign-up, no watermark on the output.",
    },
    {
      /*
        CORRECTED. Said "up to 20 minutes long and 80MB" — the 20 was wrong by
        forty minutes and matched nothing on the backend. Both figures now come
        from /limits, so neither can drift again.
      */
      question: "Is there a size or length limit?",
      answer:
        durationCap === null
          ? `Uploads are limited to ${limits.maxUploadMb}MB per file, with no length limit.`
          : `The source file can be up to ${durationLabel(durationCap)} long and ${limits.maxUploadMb}MB.`,
    },
    {
      question: "Can I convert the trimmed clip to a different format too?",
      answer:
        "Trim keeps the original format by design. Run the trimmed result through the Format Converter afterward if you need a different format.",
    },
    {
      question: "Can I trim audio on my phone?",
      answer: "Yes — it works in any mobile browser on iPhone or Android, no app install required.",
    },
    {
      question: "Can I trim multiple files at once?",
      answer: "One file at a time — there's currently no batch upload option.",
    },
    {
      question: "Can I undo a trim?",
      answer:
        "There's no undo history — this is a stateless upload-process-download tool with nothing saved between visits. Re-upload the original file if you need to cut it differently.",
    },
    {
      // ADDED: this page had no retention answer. Built from the backend's own
      // retention block rather than written by hand.
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: "Does trimming reduce the file size?",
      answer:
        "Yes, proportionally to how much you cut — a shorter clip has less audio data, so the file comes out smaller than the original.",
    },
    {
      question: "Does it work on stereo audio?",
      answer:
        "Yes — trimming only cuts the time range, so it doesn't affect channel layout. Stereo files stay stereo.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free Audio Trimmer
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Cut any audio file down to just the part you need, free, no sign-up, no
            watermark.
          </p>
        </header>

        <TrimForm />

        {/* One bordered strip with hairline dividers, matching the other tool
            pages — three floating boxes under the tool read as three more
            things to deal with. */}
        <section className="grid divide-y divide-graphite-800 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { title: "Precise", desc: "Drag to pick your exact start and end point." },
            { title: "No quality loss", desc: "Output keeps your original format." },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
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
          <h2 className="text-2xl font-bold text-text-primary">Why trim audio?</h2>
          <p className="text-text-muted leading-relaxed">
            Trimming removes unwanted sections without touching playback
            speed, pitch, or format — it&apos;s just a clean cut to exactly
            the part you want. That covers a lot of ordinary needs: shortening
            a clip before sharing it, cutting silence off the start or end of
            a recording, pulling a short sample out of a longer track, or
            preparing a file for somewhere with its own length limits.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to trim or cut an audio file</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an {formatList} file.</li>
            <li>Drag the start marker along the timeline to where you want the clip to begin.</li>
            <li>Drag the end marker to where you want the clip to end.</li>
            <li>Download the trimmed clip — same format as your upload.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Trim vs. cut: same thing, different word</h2>
          <p className="text-text-muted leading-relaxed">
            &quot;Trim&quot; and &quot;cut&quot; describe the same operation here —
            selecting a start and end point and keeping only what&apos;s between
            them. Some people search for an &quot;audio cutter,&quot; others for an
            &quot;audio trimmer&quot;; either way, this tool does exactly that: one
            clean cut, original format preserved.
          </p>
          {/*
            CORRECTED. This paragraph used to end "that's a different operation
            we don't currently offer as a dedicated tool" — about splitting.
            /silence-split does exactly that and has been live for months, so
            the page was turning away the people it described.
          */}
          <p className="text-text-muted leading-relaxed">
            Worth distinguishing from &quot;splitting,&quot; which means breaking
            one file into several separate pieces rather than keeping a single
            section. That&apos;s a different tool:{" "}
            <Link href="/silence-split" className="text-amber-400 hover:underline">
              Split by Silence
            </Link>{" "}
            cuts a long recording into separate tracks wherever it finds a gap —
            useful for a live set, a vinyl rip, or a batch of takes recorded in
            one pass.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common uses</h2>
          <ul className="list-disc list-inside space-y-1.5 text-text-muted leading-relaxed">
            <li>Cutting a podcast segment down to a shareable clip</li>
            <li>Pulling a sample, intro, or hook from a longer track</li>
            <li>Trimming dead air off the start or end of a voice memo</li>
            <li>Grabbing just the chorus of a song for quick reference</li>
            <li>Making a ringtone-length clip from a longer recording</li>
            <li>Cutting a short section out of a field recording for a sample library</li>
            <li>Preparing a clip for a social media post or video edit</li>
          </ul>
          <p className="text-text-muted leading-relaxed">
            Need the clip in a different format too? Trim keeps the original format
            by design — run the result through the{" "}
            <Link href="/convert" className="text-amber-400 hover:underline">
              Format Converter
            </Link>{" "}
            afterward if you need something else. Need to strip silence throughout
            the whole file, not just cut one section? The{" "}
            <Link href="/silence-remove" className="text-amber-400 hover:underline">
              Silence Remover
            </Link>{" "}
            handles that instead.
          </p>
          <p className="text-text-muted leading-relaxed">
            Want to know why a bad cut point can cause a click or pop, and how
            lossless vs. lossy formats handle trimming differently?{" "}
            <Link href="/guides/how-to-trim-audio-without-losing-quality" className="text-amber-400 hover:underline">
              Read How to Trim Audio Without Losing Quality
            </Link>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Which tool do you actually need?</h2>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-sm text-left text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">You want to...</th>
                  <th className="px-4 py-3 font-semibold">Use</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3">Keep one specific section, cut the rest</td>
                  <td className="px-4 py-3">Trim (this tool)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Strip silent gaps throughout the whole file</td>
                  <td className="px-4 py-3">
                    <Link href="/silence-remove" className="text-amber-400 hover:underline">
                      Silence Remover
                    </Link>
                  </td>
                </tr>
                {/* Added with the correction above — the row that was missing
                    while the prose claimed the tool didn't exist. */}
                <tr>
                  <td className="px-4 py-3">Break one long file into several tracks</td>
                  <td className="px-4 py-3">
                    <Link href="/silence-split" className="text-amber-400 hover:underline">
                      Split by Silence
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Change the file format after trimming</td>
                  <td className="px-4 py-3">
                    <Link href="/convert" className="text-amber-400 hover:underline">
                      Audio Converter
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
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
                  // prefetch disabled on bulk tool links, matching the other
                  // tool pages.
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