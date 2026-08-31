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

const guide = getGuideBySlug("tiktok-audio-quality-explained")!;

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
  // Organization, not Person — AudioForges is a brand, not an individual.
  author: { "@type": "Organization", name: "AudioForges" },
  url: `${SITE_URL}/guides/${guide.slug}`,
  mainEntityOfPage: `${SITE_URL}/guides/${guide.slug}`,
  image: `${SITE_URL}${OG_IMAGE.url}`,
  publisher: { "@type": "Organization", name: "AudioForges" },
};

export default function TikTokAudioQualityGuidePage() {
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
            Search for a TikTok downloader and you&apos;ll find a dozen of them
            promising 320 kbps MP3. It&apos;s a compelling number, and it is
            almost entirely meaningless — because the audio inside a TikTok video
            was never anywhere near that quality to begin with. Knowing
            what&apos;s actually in the file changes what you should expect from
            it, and what you should do with it afterwards.
          </p>

          <h2 id="what-tiktok-stores">What TikTok actually stores</h2>
          <p>
            We measured the audio streams inside two unrelated TikTok posts in
            August 2026. Both came back at roughly <strong>64 kbps AAC</strong> —
            64,208 bps on one, 64,544 on the other. That&apos;s not a fluke or a
            bad sample: TikTok is a mobile-first video platform serving enormous
            volumes of traffic, and aggressive audio compression is a sensible
            engineering decision when most playback happens on a phone speaker.
          </p>
          <p>
            For comparison, a Spotify stream sits around 160 to 320 kbps, and a
            CD-quality WAV runs about 1,411 kbps. TikTok audio is a fraction of
            either. Anything that comes out of a TikTok video carries that ceiling
            with it, no matter what you convert it to next.
          </p>

          <h2 id="why-320-fails">Why 320 kbps can&apos;t add anything back</h2>
          <p>
            Lossy compression discards audio information permanently. When AAC
            encoding decided which frequency content to throw away at 64 kbps,
            that content stopped existing in the file. Encoding the result to a
            320 kbps MP3 gives the encoder more room to store what it receives —
            but what it receives is already the reduced version. There is nothing
            left to recover.
          </p>
          <p>
            This is the same principle behind{" "}
            <Link href="/guides/lossless-vs-lossy-audio-formats">
              why converting an MP3 to WAV doesn&apos;t restore quality
            </Link>
            . A bigger container doesn&apos;t refill itself. What a 320 kbps
            export of TikTok audio produces is a file two and a half times larger
            than necessary, containing bit-for-bit the same audible content — and
            anyone can verify that by opening it in Audacity or running ffprobe.
          </p>

          <h2 id="why-128">So why encode at 128 kbps at all?</h2>
          <p>
            Every lossy re-encode is a generation loss: the second encoder makes
            its own decisions about what to discard, working from material that
            has already been through that process once. Encoding at 128 kbps —
            double the source rate — gives the MP3 encoder enough headroom that it
            isn&apos;t forced to throw away anything the source still contains.
            The result is transparent to the original, at a file size that matches
            what&apos;s actually in it.
          </p>
          <p>
            Going higher wouldn&apos;t sound better. It would just be a larger
            file making a bolder claim.
          </p>

          <h2 id="what-matters">
            What actually affects how a TikTok sound holds up
          </h2>
          <p>
            Bitrate is the wrong thing to worry about here. What genuinely varies
            from one TikTok to the next is how the audio got there in the first
            place. A sound uploaded from a producer&apos;s export is in far better
            shape than the same sound recorded off a laptop speaker on a phone
            microphone, or one that&apos;s been duetted and re-uploaded through
            several accounts — each pass adding another round of compression and,
            often, another layer of room noise.
          </p>
          <p>
            Loudness processing is the other factor. TikTok normalizes playback,
            and many uploads are already heavily limited before they get there,
            which flattens dynamics in a way no conversion step can undo.
          </p>

          <h2 id="when-it-shows">When the source quality actually shows</h2>
          <p>
            For most uses — a ringtone, a reference clip, a sound you want to
            listen back to — 64 kbps source audio is completely fine. You will not
            hear the difference on a phone or laptop speaker, which is where it
            was designed to be heard.
          </p>
          <p>
            It shows up when you process it hard. Pitch shifting and time
            stretching both expose compression artifacts, because they
            redistribute frequency content that the encoder had already thinned
            out — the smearing that was masked at original speed becomes audible
            once it&apos;s stretched. Heavy EQ boosts in the high end can do the
            same, since that region is the first thing a low-bitrate encoder
            sacrifices. If you&apos;re sampling a TikTok sound into a track and
            plan to manipulate it significantly, budget for that.
          </p>

          <h2 id="usable-file">Getting a usable file</h2>
          <p>
            Our <Link href="/tiktok-to-mp3">TikTok to MP3 converter</Link> pulls
            the audio track straight out of the video and encodes it once at 128
            kbps — no upscaling, no inflated claims, no account. From there, most
            TikTok sounds want the same two steps:{" "}
            <Link href="/trim">trim</Link> the clip to just the part you need, and
            add a short <Link href="/fade">fade in and out</Link> so the cut
            doesn&apos;t click.
          </p>
          <p>
            If you&apos;re building around the sound rather than just keeping it,
            run it through the{" "}
            <Link href="/key-finder">Key &amp; BPM Finder</Link> before you drop
            it into a session — a sound that fights your project&apos;s key is a
            far bigger problem than 64 kbps ever was. And if it&apos;s headed for
            a phone, the <Link href="/ringtone-maker">Ringtone Maker</Link>{" "}
            handles the 30-second cap and the M4R format iPhones expect —{" "}
            <Link href="/guides/tiktok-sound-to-ringtone">
              read How to Make a Ringtone from a TikTok Sound
            </Link>{" "}
            for the full walkthrough, including the part where iOS won&apos;t let
            a downloaded file become a ringtone by itself.
          </p>
        </Prose>

        <div className="mt-10 flex flex-wrap gap-3 border-t border-graphite-800 pt-8">
          <Link href="/tiktok-to-mp3" className={buttonStyles({ size: "lg" })}>
            Try the TikTok to MP3 converter
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/trim"
            className="inline-flex items-center gap-2 rounded-lg border border-graphite-700 px-6 py-3 font-medium text-text-primary transition-colors hover:border-amber-500/40"
          >
            Trim your clip
          </Link>
        </div>
      </main>
    </>
  );
}