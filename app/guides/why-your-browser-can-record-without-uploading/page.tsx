import { buttonStyles } from "@/components/ui/Button";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";

const guide = getGuideBySlug("why-your-browser-can-record-without-uploading")!;

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

export default function VoiceRecorderGuidePage() {
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
            Almost every other tool on AudioForges works the same basic way:
            you upload a file, a server does the actual processing, and you
            download the result. The Voice Recorder breaks that pattern
            entirely — nothing gets uploaded, because nothing needs to be.
            The reason comes down to what the browser itself is capable of
            doing on its own.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              How browser-based recording actually works
            </h2>
            <p>
              Modern browsers expose two built-in capabilities that make this
              possible without any server involved. One gives a webpage
              permission to access your microphone and receive a live audio
              stream from it. The other takes that stream and encodes it into
              a playable audio file in real time, directly in the browser,
              as you record. Everything AudioForges' other tools need a
              server for — decoding, processing, re-encoding — either isn&apos;t
              necessary here or is handled by the browser&apos;s own built-in
              recording capability instead. There&apos;s no heavy lifting like
              AI separation or format conversion happening during recording,
              so there&apos;s nothing that requires sending your audio
              anywhere.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why the output format depends on your browser
            </h2>
            <p>
              Each browser&apos;s built-in recording capability supports
              different audio formats natively, and that choice isn&apos;t
              something a website running in the browser gets to override.
              Chrome, Firefox, and Edge typically produce WebM; Safari
              typically produces M4A. This isn&apos;t inconsistency on
              AudioForges&apos; part — it reflects a genuine difference in what
              each browser has built in. If you need a specific format like
              MP3 or WAV afterward, that&apos;s a separate conversion step
              once the recording is already saved.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Getting a cleaner recording
            </h2>
            <p>
              A few basics make a noticeable difference before you even hit
              record: a quiet room without a fan, air conditioner, or other
              constant background noise; the microphone positioned
              consistently close to the source rather than drifting nearer
              and farther as you speak; and headphones if you&apos;re
              monitoring playback at the same time, since speaker output
              feeding back into an open microphone is one of the more common
              causes of an unexpectedly muddy or echoing recording.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              What to do after recording
            </h2>
            <p>
              If you need a different format than what your browser produced,
              the{" "}
              <Link href="/convert" className="text-amber-400 hover:underline">
                Audio Converter
              </Link>{" "}
              handles exporting the download to MP3, WAV, or another format.
              If background noise made it into the recording despite your
              best setup, the{" "}
              <Link href="/noise-remove" className="text-amber-400 hover:underline">
                Noise Remover
              </Link>{" "}
              or{" "}
              <Link href="/voice-clean" className="text-amber-400 hover:underline">
                Voice Cleaner
              </Link>{" "}
              can clean it up afterward.
            </p>
            <p>
              Our{" "}
              <Link href="/voice-recorder" className="text-amber-400 hover:underline">
                Online Voice Recorder
              </Link>{" "}
              handles the capture itself — tap the mic, speak, and download,
              with nothing ever leaving your device during the recording
              step.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-graphite-800">
          <Link
            href="/voice-recorder"
            className={buttonStyles({ size: "lg" })}
          >
            Try the Online Voice Recorder
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}