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

const guide = getGuideBySlug("splitting-a-recording-into-separate-tracks")!;

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

export default function SplittingRecordingGuidePage() {
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
            If you have one long MP3 or WAV file that&apos;s really several tracks
            back to back — a recorded DJ set, a digitized vinyl side, a voice memo
            covering a few different ideas — there are three ways to turn it into
            separate files. You can mark exact timestamps by hand in an audio
            editor. You can divide it into equal-length chunks regardless of
            what&apos;s actually in them. Or, if the recording has real quiet gaps
            at the points that matter, you can let a silence detector find those
            boundaries automatically. This guide covers the third approach — how
            it actually works, where it holds up, and where it doesn&apos;t.
          </p>

          <h2 id="manual-vs-auto">Manual vs. automatic audio splitting</h2>
          <p>
            Manually cutting audio means opening the file in an editor and marking
            exact start and end points yourself. It&apos;s precise — you decide
            exactly where every cut lands — but slow for anything with more than a
            couple of boundaries, and it works regardless of whether the recording
            has any silence in it at all.
          </p>
          <p>
            Automatic silence-based splitting trades some of that precision for
            speed: instead of you finding every boundary, the tool scans the whole
            file and treats any sufficiently long quiet stretch as a cut point.
            This works well specifically when the source material already has real
            pauses between its natural sections — it doesn&apos;t work when
            there&apos;s no genuine silence to find, no matter how obvious the
            boundary might sound to a human ear.
          </p>

          <h2 id="detection">How silence detection finds track boundaries</h2>
          <p>
            Two settings control everything. <strong>Silence threshold</strong> is
            a decibel level — audio quieter than this counts as potentially
            silent. A more negative number (like -50dB) demands a quieter moment
            before it qualifies; a less negative number (like -20dB) is more
            lenient and will pick up quieter background noise as well.{" "}
            <strong>Minimum gap length</strong> is how long that quiet stretch has
            to last before it&apos;s treated as a genuine boundary rather than a
            brief pause. A tool scans the whole recording; any stretch that stays
            below the threshold for at least the minimum gap length becomes a
            split point, and everything between two split points becomes its own
            output file.
          </p>
          <p>
            There&apos;s no single correct combination of these two settings — it
            depends on how the specific recording was made. A default like -30dB
            threshold with a 0.5 second minimum gap is a reasonable starting point
            for a lot of material, but a noisier recording or one with unusually
            short pauses may need adjustment.
          </p>

          <h2 id="dj-mix">How to split a DJ mix into tracks</h2>
          <p>
            This works when the mix has genuine quiet moments between songs — some
            mixing styles leave a brief gap or a clean cut between tracks, and
            those gaps are exactly what silence detection is looking for. It
            doesn&apos;t work reliably on a continuously crossfaded mix, where one
            track blends directly into the next with the music never actually
            stopping. A crossfade is a musical transition, not an acoustic silence
            — there&apos;s nothing quiet for the detector to find, so no amount of
            threshold or gap-length tuning will manufacture a boundary that
            isn&apos;t acoustically there.
          </p>

          <h2 id="vinyl">How to split a vinyl rip into individual songs</h2>
          <p>
            A full side ripped as one continuous file often has natural pauses
            between songs, which makes it a reasonably good fit for this approach.
            Two things can get in the way: surface noise and turntable rumble can
            keep an otherwise-quiet gap from reading as silence, since the
            detector is measuring actual loudness, not judging musical structure —
            lowering the threshold usually helps recover those gaps. And very
            short intros or outros on a track can occasionally get caught up with
            the wrong neighboring section if the pause around them is brief.
          </p>

          <h2 id="speech">
            Splitting long voice recordings, podcasts, and interviews
          </h2>
          <p>
            The same technique applies to voice memos, interviews, lectures, and
            podcast recordings, but speech has a wrinkle music often doesn&apos;t:
            ordinary pauses between sentences are usually far shorter than a real
            segment boundary. If the minimum gap length is set too short, normal
            conversational pauses can get treated as split points, fragmenting the
            recording in ways you didn&apos;t want. Setting a longer minimum gap
            length — long enough to exceed a typical breath or pause but short
            enough to catch the actual boundary you&apos;re after — is usually the
            fix.
          </p>

          <h2 id="limitations">What automatic splitting can&apos;t do</h2>
          <p>
            It&apos;s worth being direct about this: silence detection identifies
            quiet gaps based on loudness and duration — it doesn&apos;t know song
            titles, artists, chapter markers, or musical structure. It can&apos;t
            recognize &quot;this is where the second song starts&quot; except by
            measuring that the audio actually went quiet at that point. Continuous
            mixes without real silence, recordings with constant background noise,
            and anything that fades directly from one section into the next
            without a true gap will all resist clean automatic splitting, because
            there&apos;s no acoustic boundary underneath for the detector to find.
          </p>

          <h2 id="troubleshooting">Fixing too many or too few splits</h2>
          <dl>
            <dt>Too many tracks?</dt>
            <dd>
              Increase the minimum gap length so only longer silences count, and
              check whether background noise in the recording is preventing
              otherwise-quiet moments from registering as silence in the first
              place.
            </dd>

            <dt>Missing gaps you expected?</dt>
            <dd>
              Lower the threshold toward something like -50dB to catch quieter
              transitions, or shorten the minimum gap length if the real pauses in
              your recording are brief.
            </dd>

            <dt>Nothing splits at all?</dt>
            <dd>
              If the file has no stretch that meets your current threshold and
              gap-length settings, there&apos;s nothing to split. On a
              continuously crossfaded mix or a recording with constant background
              noise, this is expected — adjusting settings only helps if
              there&apos;s genuine silence somewhere to find. If there isn&apos;t,
              manual cutting is the more reliable option.
            </dd>
          </dl>

          <h2 id="split-vs-remove">Splitting vs. removing silence</h2>
          <p>
            Both approaches detect the same thing — quiet stretches in a recording
            — and do opposite things with them. Splitting keeps every segment
            between the gaps as its own file, useful when those gaps represent
            real boundaries you want preserved as separate tracks. Removing
            silence instead deletes those same gaps and stitches what&apos;s left
            into one continuous file, useful when you want a single recording
            tightened up rather than divided.
          </p>
        </Prose>

        <div className="mt-10 border-t border-graphite-800 pt-8">
          <Link href="/silence-split" className={buttonStyles({ size: "lg" })}>
            Try the Silence Splitter
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}