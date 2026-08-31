import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Prose } from "@/components/ui/Prose";
import { ogForGuide } from "@/lib/og";

const guide = getGuideBySlug("what-is-an-m4r-file-explained")!;

const OG_IMAGE = ogForGuide(guide);

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
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: guide.title,
    description: guide.description,
    images: [OG_IMAGE.url],
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
  url: `${SITE_URL}/guides/${guide.slug}`,
  mainEntityOfPage: `${SITE_URL}/guides/${guide.slug}`,
  image: `${SITE_URL}${OG_IMAGE.url}`,
  publisher: { "@type": "Organization", name: "AudioForges" },
};

export default function RingtoneGuidePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <Breadcrumb
          items={[{ name: "Guides", href: "/guides" }, { name: guide.title }]}
          className="mb-8"
        />

        <header>
          <h1 className="measure-wide text-4xl font-bold leading-[1.06] tracking-[-0.02em] text-text-primary sm:text-5xl">
            {guide.title}
          </h1>
          <div className="mt-5">
            <GuideByline publishedDate={guide.publishedDate} updatedDate={guide.updatedDate} />
          </div>
        </header>

        <Prose className="mt-10">
          <p>
            &quot;Ringtone maker&quot; sounds like it should involve some special
            format or process, but the actual mechanism behind an iPhone ringtone
            is almost anticlimactic: it&apos;s the same AAC audio as any other M4A
            file, just saved with a different file extension. Once you know that,
            most of what seems mysterious about making and installing one stops
            being mysterious.
          </p>

          <h2 id="what-is-m4r">What an M4R file actually is</h2>
          <p>
            There&apos;s no separate &quot;ringtone codec.&quot; An M4R is AAC
            audio, identical to what&apos;s inside a standard M4A file, with the
            extension changed from .m4a to .m4r. That extension alone is what
            tells iOS&apos;s Tones system to treat the file as a ringtone rather
            than a regular song — the audio data itself isn&apos;t processed any
            differently.
          </p>

          <h2 id="30-seconds">Why the 30-second limit exists</h2>
          <p>
            This isn&apos;t an arbitrary restriction — it&apos;s Apple&apos;s own
            maximum length for a ringtone. A clip longer than 30 seconds
            isn&apos;t a valid ringtone on iOS no matter how it was created or
            what tool made it, so any ringtone maker worth using caps length at
            that limit rather than handing you a file that simply won&apos;t work
            once you try to add it.
          </p>

          <h2 id="picking-a-section">Picking a good section of a song</h2>
          <p>
            With 30 seconds to work with, the chorus or hook of a song usually
            makes a better ringtone than the intro, since intros are often quieter
            or slower to get going — not ideal for something that needs to grab
            attention immediately when a call comes in. It&apos;s also worth
            avoiding a cut that lands mid-word in a vocal or mid-beat in a
            rhythmic section, since that kind of cut is far more noticeable on a
            short, looping ringtone than it would be in the middle of a full song.
          </p>

          <h2 id="fades">Smoothing the start or end with a fade</h2>
          <p>
            Cutting a clip out of the middle of a song means the start and end
            points weren&apos;t originally silent, which can produce a small click
            or pop right at the cut — an abrupt jump in the waveform&apos;s
            amplitude rather than a clean edge. A short fade in and/or fade out
            smooths that over. Since a ringtone often plays on a loop while a call
            rings, a clean loop point matters more here than it does for a one-off
            playback.
          </p>
          <p>
            Make the ringtone first, then run the downloaded file through the{" "}
            <Link href="/fade">Fade In/Out</Link> tool if the cut points need
            smoothing.
          </p>

          <h2 id="android">Ringtones on Android</h2>
          <p>
            Android doesn&apos;t require the .m4r extension or the 30-second cap
            the way iOS does — a standard MP3 works as a notification or ringtone
            sound without any special formatting. The{" "}
            <Link href="/convert">Audio Converter</Link> handles exporting a clip
            to MP3 for that purpose.
          </p>

          <h2 id="without-itunes">Getting it onto your iPhone without iTunes</h2>
          <p>
            On a Mac running Catalina or later, Finder replaced iTunes for syncing
            — add the .m4r file to your device&apos;s Tones section there.
            Directly on the phone, newer iOS versions let you import a file
            through the Files app and share sheet, or via GarageBand&apos;s
            ringtone export workflow, without touching a computer at all. Apple
            changes the exact steps between iOS versions fairly often, so if a
            particular method doesn&apos;t match what you see on your device,
            searching your specific iOS version usually turns up the current
            process.
          </p>
          <p>
            Our <Link href="/ringtone-maker">Ringtone Maker</Link> handles the
            trimming and .m4r conversion — upload a track, pick your start point
            and length, and download the result, no iTunes or account needed.
          </p>
        </Prose>

        <div className="mt-10 border-t border-graphite-800 pt-8">
          <Link href="/ringtone-maker" className={buttonStyles({ size: "lg" })}>
            Try the Ringtone Maker
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}