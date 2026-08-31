import type { Metadata } from "next";
import Link from "next/link";
import { NoiseRemoveForm } from "@/components/converter/NoiseRemoveForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { ogForTool } from "@/lib/og";
import {
  getLimits,
  durationCapFor,
  durationLabel,
  retentionSentences,
} from "@/lib/api/limits";

const PAGE_TITLE = "Free Background Noise Remover — Denoise Any Audio File";
const PAGE_DESCRIPTION =
  "Remove background noise from audio online free. Eliminate hiss, hum, fan noise, and static from MP3, WAV, FLAC, AAC, M4A, OGG, and AIFF. No sign-up.";

const OG_IMAGE = ogForTool("noise-remove", "Free Background Noise Remover");

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/noise-remove` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/noise-remove`,
    siteName: SITE_NAME,
    type: "website",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE.url],
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

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.

// Every figure comes from /limits. The hand-written version said "up to 80MB
// and 20 minutes" — size right, length wrong by forty minutes. That sentence
// was true on the transcription guide and got copied into six pages where it
// wasn't.
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
      question: "What formats are supported, and is there a size limit?",
      answer:
        durationCap === null
          ? `${formatList}, up to ${limits.maxUploadMb}MB per upload.`
          : `${formatList}, up to ${limits.maxUploadMb}MB and ${durationLabel(durationCap)} long.`,
    },
    {
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

      <ToolPageShell
        breadcrumb={
          <Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Noise Remover" }]} />
        }
        title="Free Background Noise Remover"
        lede="Strip background hiss, hum, and static from any recording, free, no sign-up, no watermark."
        tool={<NoiseRemoveForm />}
      >
        <FeatureStrip
          features={[
            { title: "Adjustable", desc: "Control exactly how aggressive the cleanup is." },
            { title: "Works on anything", desc: "Music, speech, or field recordings." },
            {
              title: "No sign-up",
              desc:
                durationCap === null
                  ? `No account, no email, no watermark. Up to ${limits.maxUploadMb}MB per file.`
                  : `No account, no email, no watermark. Up to ${limits.maxUploadMb}MB and ${durationLabel(durationCap)}.`,
            },
          ]}
        />

        <ToolSection id="how-to" title="How to remove background noise from audio">
          <ol>
            <li>Upload an {formatList} file.</li>
            <li>Leave the reduction strength at its default, or adjust it manually.</li>
            <li>Run the denoiser.</li>
            <li>Download the cleaned-up result.</li>
          </ol>
        </ToolSection>

        <ToolSection id="what-it-handles" title="What kind of noise this handles">
          <p>
            The denoiser targets steady, consistent background noise — tape hiss,
            fan or AC hum, electrical buzz, static, and general microphone
            self-noise. It works by identifying frequencies where that kind of
            noise sits consistently and reducing energy there throughout the
            file. Noise that&apos;s intermittent or highly variable — like gusty
            wind, a door slamming, or a dog barking — is a harder problem for any
            denoiser, since there&apos;s no single steady frequency profile to
            target; strength adjustments can help partially, but this isn&apos;t
            a tool built to isolate one-off transient sounds.
          </p>
          <p>
            If you&apos;re also planning to adjust the volume, denoise first —
            boosting volume before cleanup just raises the noise right along with
            everything else, giving the denoiser more to remove and a messier
            starting point than cleaning it up first would.
          </p>
        </ToolSection>

        <ToolSection id="best-uses" title="Best uses">
          <p>
            Podcasts and voice recordings with hiss or hum, interviews recorded
            on a phone or in an untreated room, music demos with audible tape or
            preamp noise, lecture recordings, and any audio pulled from a video
            call or field recorder where background hum crept in.
          </p>
        </ToolSection>

        <ToolSection id="vs-voice-cleaner" title="This tool vs. Voice Cleaner">
          <p>
            This is a general-purpose denoiser that works on any audio — music,
            field recordings, or speech — with a strength slider you control
            directly.
          </p>
          <p>
            If your source is specifically speech (a podcast, phone recording, or
            interview), the <Link href="/voice-clean">Voice Cleaner</Link> runs a
            fixed chain tuned just for that — rumble cut, speech-optimized
            denoise, and loudness normalization in one pass — and will usually
            outperform manually tuning this tool for voice content.
          </p>
          <p>
            Want the full explanation of how FFT-based denoising works and why
            pushing strength too high causes warbling?{" "}
            <Link href="/guides/removing-background-noise-from-recordings">
              Read How to Remove Background Noise from Audio
            </Link>
            .
          </p>
        </ToolSection>

        <RelatedToolsGrid tools={relatedTools} />

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}