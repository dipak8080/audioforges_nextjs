import type { Metadata } from "next";
import Link from "next/link";
import { NoiseRemoveForm } from "@/components/converter/NoiseRemoveForm";
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
 * THE LENGTH LIMIT WAS UNDERSTATED BY FORTY MINUTES. Same sentence as
 * /echo-remove and /voice-clean, character for character:
 *
 *   "MP3, WAV, FLAC, M4A, AAC, OGG, and AIFF, up to 80MB and 20 minutes long."
 *
 * /noise-remove takes the audio_tools default of one hour. 80MB was right.
 * The 20 came from the transcription guide, where it's correct, and was copied
 * into six pages where it isn't.
 *
 * Also: HowTo schema and `keywords` removed, retention answer added, formats
 * read from allowed_audio_formats, prefetch disabled on the tool grid.
 */

const PAGE_TITLE = "Free Background Noise Remover — Denoise Any Audio File";
const PAGE_DESCRIPTION =
  "Remove background noise from audio online free. Eliminate hiss, hum, fan noise, and static from MP3, WAV, FLAC, AAC, M4A, OGG, and AIFF. No sign-up.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  /*
    `keywords` removed — ignored by Google since 2009. Target terms kept for
    reference:
      remove background noise from audio / background noise remover
      noise remover online / audio noise remover / denoise audio free
      audio denoiser / remove hiss from audio / remove static from audio
      remove hum from audio / audio noise reduction / remove microphone noise
      remove background hiss / remove fan noise from audio / remove white noise
      noise cancellation audio / audio cleanup tool / remove buzzing from audio
  */
  alternates: { canonical: `${SITE_URL}/noise-remove` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/noise-remove`,
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
  name: "Background Noise Remover",
  url: `${SITE_URL}/noise-remove`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Adjustable noise reduction strength",
    "Works on music or speech",
    "No sign-up required",
    "No watermark",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Noise Remover", item: `${SITE_URL}/noise-remove` },
  ],
};
// NOTE: No HowTo schema — deprecated by Google (desktop since Sept 2023), no
// ranking or rich-result benefit remains. Visible how-to steps stay.
// FAQPage schema is emitted by <FAQSection /> — do not duplicate it here.

export default async function NoiseRemovePage() {
  const relatedTools = getRelatedTools("noise-remove", 5);

  const limits = await getLimits();
  const durationCap = durationCapFor(limits, "noise-remove");
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const faqs = [
    {
      question: "What kind of noise does this remove?",
      answer:
        "Background hiss, hum, and static via an FFT-based denoiser. It's general-purpose, suitable for both music and speech.",
    },
    {
      question: "Does noise reduction affect audio quality?",
      answer:
        "At moderate strength, quality impact is minimal. Pushed too aggressively, it can introduce a warbling artifact by cutting into frequencies the wanted audio actually needs. Start at the default strength and only raise it if noise is still clearly audible.",
    },
    {
      question: "Should I use this or the Voice Cleaner for a podcast?",
      answer:
        "For speech-only recordings, the Voice Cleaner's fixed speech-tuned preset (rumble cut, denoise, loudness normalize) generally works better. Use this tool when you want direct control over reduction strength, or for music and non-speech audio.",
    },
    {
      question: "Is this really free?",
      answer: "Yes — completely free, no sign-up, no watermark on the output.",
    },
    {
      /*
        CORRECTED. Said "up to 80MB and 20 minutes long" — size right, length
        wrong by forty minutes. Both from /limits now.
      */
      question: "What formats are supported, and is there a size limit?",
      answer:
        durationCap === null
          ? `${formatList}, up to ${limits.maxUploadMb}MB per upload.`
          : `${formatList}, up to ${limits.maxUploadMb}MB and ${durationLabel(durationCap)} long.`,
    },
    {
      // ADDED: no retention answer existed.
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: "Should I denoise before or after boosting volume?",
      answer:
        "Denoise first, then boost volume. Boosting first raises the noise right along with everything else, which just means the denoiser has more to remove — cleaning it up before adjusting levels gives a clearer result.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free Background Noise Remover
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Strip background hiss, hum, and static from any recording, free, no
            sign-up, no watermark.
          </p>
        </header>

        <NoiseRemoveForm />

        {/* One bordered strip with hairline dividers, matching the other tool
            pages. */}
        <section className="grid divide-y divide-graphite-800 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { title: "Adjustable", desc: "Control exactly how aggressive the cleanup is." },
            { title: "Works on anything", desc: "Music, speech, or field recordings." },
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
          <h2 className="text-2xl font-bold text-text-primary">How to remove background noise from audio</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an {formatList} file.</li>
            <li>Leave the reduction strength at its default, or adjust it manually.</li>
            <li>Run the denoiser.</li>
            <li>Download the cleaned-up result.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What kind of noise this handles</h2>
          <p className="text-text-muted leading-relaxed">
            The denoiser targets steady, consistent background noise — tape hiss,
            fan or AC hum, electrical buzz, static, and general microphone
            self-noise. It works by identifying frequencies where that kind of
            noise sits consistently and reducing energy there throughout the
            file. Noise that&apos;s intermittent or highly variable — like gusty
            wind, a door slamming, or a dog barking — is a harder problem for any
            denoiser, since there&apos;s no single steady frequency profile to
            target; strength adjustments can help partially, but this isn&apos;t a
            tool built to isolate one-off transient sounds.
          </p>
          <p className="text-text-muted leading-relaxed">
            If you&apos;re also planning to adjust the volume, denoise first —
            boosting volume before cleanup just raises the noise right along
            with everything else, giving the denoiser more to remove and a
            messier starting point than cleaning it up first would.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Best uses</h2>
          <p className="text-text-muted leading-relaxed">
            Podcasts and voice recordings with hiss or hum, interviews recorded on
            a phone or in an untreated room, music demos with audible tape or
            preamp noise, lecture recordings, and any audio pulled from a video
            call or field recorder where background hum crept in.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">This tool vs. Voice Cleaner</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              This is a general-purpose denoiser that works on any audio — music,
              field recordings, or speech — with a strength slider you control
              directly.
            </p>
            <p>
              If your source is specifically speech (a podcast, phone recording, or
              interview), the{" "}
              <Link href="/voice-clean" className="text-amber-400 hover:underline">
                Voice Cleaner
              </Link>{" "}
              runs a fixed chain tuned just for that — rumble cut, speech-optimized
              denoise, and loudness normalization in one pass — and will usually
              outperform manually tuning this tool for voice content.
            </p>
            <p>
              Want the full explanation of how FFT-based denoising works and why
              pushing strength too high causes warbling?{" "}
              <Link href="/guides/removing-background-noise-from-recordings" className="text-amber-400 hover:underline">
                Read How to Remove Background Noise from Audio
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