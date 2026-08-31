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

const guide = getGuideBySlug("why-m4a-extraction-is-instant")!;

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

export default function VideoToAudioGuidePage() {
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
            Extract audio from a video to M4A and it&apos;s done almost instantly,
            regardless of how long the video is. Pick WAV instead and suddenly
            there&apos;s real processing time involved. That asymmetry isn&apos;t
            a quirk — it comes down to what the two output formats actually
            require the tool to do, and understanding it also explains why WAV or
            FLAC output doesn&apos;t give you &quot;better&quot; audio than M4A
            did.
          </p>

          <h2 id="stream-copy">Why M4A/AAC extraction is nearly instant</h2>
          <p>
            Most video files already carry their audio track encoded as AAC —
            that&apos;s the standard audio codec inside an MP4 container, and
            it&apos;s common across MOV, MKV, and most other video formats too.
            When the requested output is M4A or AAC, the existing audio stream can
            simply be copied out of the video container and placed into an
            audio-only one, with no decoding or re-encoding involved at all. This
            is sometimes called a &quot;stream copy&quot; or &quot;remux&quot; —
            moving data between containers rather than transforming it. Since
            nothing about the audio itself is being processed, the operation
            finishes in about a second regardless of whether the source video is
            one minute or sixty.
          </p>

          <h2 id="re-encoding">Why other formats take real processing time</h2>
          <p>
            Requesting MP3, WAV, FLAC, OGG, or AIFF output means the original AAC
            audio has to be fully decoded back into raw audio samples, and then
            encoded again into the new target format. Both steps take real
            computation, and that computation scales with how long the video
            actually is — a 45-minute video takes proportionally longer to decode
            and re-encode than a 3-minute one, unlike the stream-copy path, which
            barely notices the difference.
          </p>

          <h2 id="no-restoration">
            Why WAV or FLAC doesn&apos;t restore lost quality
          </h2>
          <p>
            It&apos;s a reasonable assumption that a lossless format like WAV or
            FLAC should sound better than AAC — lossless formats generally do
            preserve more detail than lossy ones. But that assumption only holds
            when the lossless format is wrapping audio that was never compressed
            in the first place. If the video&apos;s original audio track was
            already AAC — which is the common case — that compression already
            happened, and it already discarded whatever detail AAC&apos;s encoding
            process discards. Converting that AAC audio into WAV or FLAC afterward
            doesn&apos;t undo any of that; it just repackages the identical,
            already-lossy audio data into a much larger file. You end up with more
            megabytes, not more fidelity.
          </p>

          <h2 id="when-lossless-helps">When lossless output actually helps</h2>
          <p>
            The exception is when the source video&apos;s audio track was itself
            uncompressed or losslessly encoded to begin with — something that
            shows up occasionally in professional camera footage or certain
            production workflows, though it&apos;s uncommon in typical phone
            videos, screen recordings, or downloaded clips. In that specific case,
            extracting to WAV or FLAC genuinely preserves everything the source
            had, where extracting to a lossy format like MP3 would introduce
            compression that wasn&apos;t there before. For the much more common
            case of AAC-encoded video audio, M4A or AAC output gives you the same
            audio quality as WAV or FLAC would, just faster and in a smaller file.
          </p>

          <h2 id="picking-output">Picking the right output for your use case</h2>
          <p>
            If you&apos;re just pulling audio for transcription, editing
            reference, or general listening, M4A or AAC is the faster choice with
            no real downside for typical video sources. If you&apos;re archiving
            audio for long-term storage or feeding it into a workflow that
            specifically requires WAV or FLAC, those formats work fine too —
            you&apos;re just not gaining fidelity over M4A in the process, only
            compatibility with whatever expects an uncompressed file.
          </p>
          <p>
            Our <Link href="/video-to-audio">Video to Audio Converter</Link> runs
            this exact process — upload MP4, MOV, MKV, or another supported video
            format, choose your output, and download the audio, no account or
            software install needed.
          </p>
        </Prose>

        <div className="mt-10 border-t border-graphite-800 pt-8">
          <Link href="/video-to-audio" className={buttonStyles({ size: "lg" })}>
            Try the Video to Audio Converter
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}