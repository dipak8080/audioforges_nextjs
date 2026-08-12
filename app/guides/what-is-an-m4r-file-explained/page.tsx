import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";

const guide = getGuideBySlug("what-is-an-m4r-file-explained")!;

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

export default function RingtoneGuidePage() {
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
            "Ringtone maker" sounds like it should involve some special
            format or process, but the actual mechanism behind an iPhone
            ringtone is almost anticlimactic: it&apos;s the same AAC audio as
            any other M4A file, just saved with a different file extension.
            Once you know that, most of what seems mysterious about making
            and installing one stops being mysterious.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              What an M4R file actually is
            </h2>
            <p>
              There&apos;s no separate "ringtone codec." An M4R is AAC audio,
              identical to what's inside a standard M4A file, with the
              extension changed from .m4a to .m4r. That extension alone is
              what tells iOS&apos;s Tones system to treat the file as a
              ringtone rather than a regular song — the audio data itself
              isn&apos;t processed any differently.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why the 30-second limit exists
            </h2>
            <p>
              This isn&apos;t an arbitrary restriction — it&apos;s Apple&apos;s
              own maximum length for a ringtone. A clip longer than 30
              seconds isn&apos;t a valid ringtone on iOS no matter how it was
              created or what tool made it, so any ringtone maker worth using
              caps length at that limit rather than handing you a file that
              simply won&apos;t work once you try to add it.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Picking a good section of a song
            </h2>
            <p>
              With 30 seconds to work with, the chorus or hook of a song
              usually makes a better ringtone than the intro, since intros
              are often quieter or slower to get going — not ideal for
              something that needs to grab attention immediately when a call
              comes in. It&apos;s also worth avoiding a cut that lands
              mid-word in a vocal or mid-beat in a rhythmic section, since
              that kind of cut is far more noticeable on a short, looping
              ringtone than it would be in the middle of a full song.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Smoothing the start or end with a fade
            </h2>
            <p>
              Cutting a clip out of the middle of a song means the start and
              end points weren&apos;t originally silent, which can produce a
              small click or pop right at the cut — an abrupt jump in the
              waveform's amplitude rather than a clean edge. A short fade in
              and/or fade out smooths that over. Since a ringtone often plays
              on a loop while a call rings, a clean loop point matters more
              here than it does for a one-off playback.
            </p>
            <p>
              Make the ringtone first, then run the downloaded file through
              the{" "}
              <Link href="/fade" className="text-amber-400 hover:underline">
                Fade In/Out
              </Link>{" "}
              tool if the cut points need smoothing.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Ringtones on Android
            </h2>
            <p>
              Android doesn&apos;t require the .m4r extension or the 30-second
              cap the way iOS does — a standard MP3 works as a notification
              or ringtone sound without any special formatting. The{" "}
              <Link href="/convert" className="text-amber-400 hover:underline">
                Audio Converter
              </Link>{" "}
              handles exporting a clip to MP3 for that purpose.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Getting it onto your iPhone without iTunes
            </h2>
            <p>
              On a Mac running Catalina or later, Finder replaced iTunes for
              syncing — add the .m4r file to your device&apos;s Tones section
              there. Directly on the phone, newer iOS versions let you import
              a file through the Files app and share sheet, or via
              GarageBand&apos;s ringtone export workflow, without touching a
              computer at all. Apple changes the exact steps between iOS
              versions fairly often, so if a particular method doesn&apos;t
              match what you see on your device, searching your specific iOS
              version usually turns up the current process.
            </p>
            <p>
              Our{" "}
              <Link href="/ringtone-maker" className="text-amber-400 hover:underline">
                Ringtone Maker
              </Link>{" "}
              handles the trimming and .m4r conversion — upload a track, pick
              your start point and length, and download the result, no
              iTunes or account needed.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-graphite-800">
          <Link
            href="/ringtone-maker"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 text-graphite-950 font-medium px-6 py-3 hover:bg-amber-400 transition-colors"
          >
            Try the Ringtone Maker
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}