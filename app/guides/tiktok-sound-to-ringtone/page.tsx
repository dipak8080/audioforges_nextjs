import { buttonStyles } from "@/components/ui/Button";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";

const guide = getGuideBySlug("tiktok-sound-to-ringtone")!;

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

export default function TikTokSoundToRingtoneGuidePage() {
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
            A TikTok sound makes a good ringtone for the same reason it works on
            TikTok: it&apos;s short, front-loaded, and recognisable in about two
            seconds. Getting one onto your phone is four steps of actual audio
            work and one step of phone admin — and the phone admin is the part
            most guides skip, which is why people end up with a perfect 25-second
            clip sitting in their Downloads folder doing nothing.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Start with the audio, not the video
            </h2>
            <p>
              Pull the sound out first with the{" "}
              <Link href="/tiktok-to-mp3" className="text-amber-400 hover:underline">
                TikTok to MP3 converter
              </Link>{" "}
              — paste the share link and you get the audio on its own. Working
              from the MP3 rather than a screen recording matters here: a
              recording captures your phone&apos;s speaker, room noise and all,
              and a ringtone is the one file where that gets played at full
              volume in a quiet room.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Pick the hook, not the beginning
            </h2>
            <p>
              A ringtone plays for four or five seconds before someone reaches
              the phone. If the first four seconds are a build-up, an intro, or a
              spoken lead-in, the ringtone is those four seconds — the part you
              actually wanted never arrives. Find the moment the sound becomes
              recognisable and start a beat or two before it.
            </p>
            <p>
              The{" "}
              <Link href="/trim" className="text-amber-400 hover:underline">
                Audio Trimmer
              </Link>{" "}
              shows the waveform, so the hook is usually visible as the point
              where the shape gets denser. Drag the handles around it, preview,
              and adjust — most sounds take two or three attempts to land on the
              right entry point.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              How long to make it
            </h2>
            <p>
              iPhone caps ringtones at{" "}
              <strong className="text-text-primary">30 seconds</strong> and
              text tones at 30 seconds as well; Android has no hard limit but
              stops the ringtone when you answer, so length past about 30 seconds
              is theoretical either way. In practice 15 to 25 seconds is the
              useful range: long enough not to loop awkwardly while the phone
              rings out, short enough that the whole clip is the good part.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Fade the ends, or you&apos;ll hear a click
            </h2>
            <p>
              Cutting audio at an arbitrary point almost always lands
              mid-waveform, and the jump from that value to silence is a sharp
              transient your speaker reproduces as a click or pop. On a ringtone
              it&apos;s especially obvious, because the clip loops — so the click
              repeats every time round.
            </p>
            <p>
              A{" "}
              <Link href="/fade" className="text-amber-400 hover:underline">
                fade in and out
              </Link>{" "}
              of 20 to 50 milliseconds at each end removes it without being
              audible as a fade.{" "}
              <Link
                href="/guides/why-audio-needs-a-fade-in-out"
                className="text-amber-400 hover:underline"
              >
                Read Why Trimmed Audio Clips Need a Fade In and Out
              </Link>{" "}
              for what&apos;s actually happening at that cut point.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Make it loud enough to hear
            </h2>
            <p>
              Ringtones play through a phone&apos;s bottom-firing speaker,
              usually from a pocket or a table across the room. A clip that
              sounds fine in headphones can be inaudible there. TikTok audio is
              often already loud, but if yours came from a quiet source, run it
              through the{" "}
              <Link href="/volume" className="text-amber-400 hover:underline">
                Volume Booster
              </Link>{" "}
              or the{" "}
              <Link href="/loudness-normalizer" className="text-amber-400 hover:underline">
                Loudness Normalizer
              </Link>{" "}
              before exporting. Normalising to a consistent loudness also stops
              one ringtone being twice as loud as the next when you switch.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Export the right format
            </h2>
            <p>
              Android takes the MP3 as-is. iPhone needs{" "}
              <strong className="text-text-primary">M4R</strong>, which is AAC
              audio with a different extension — the{" "}
              <Link href="/ringtone-maker" className="text-amber-400 hover:underline">
                Ringtone Maker
              </Link>{" "}
              handles the trim and the M4R export in one step, so you can skip
              straight there if your clip doesn&apos;t need loudness work.{" "}
              <Link
                href="/guides/what-is-an-m4r-file-explained"
                className="text-amber-400 hover:underline"
              >
                Read What Is an M4R File? iPhone Ringtone Explained
              </Link>{" "}
              if you want the detail on why iOS insists on it.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Getting it onto the phone
            </h2>
            <p>
              This is where most guides stop short, so to be direct about it:{" "}
              <strong className="text-text-primary">
                an M4R in your Files app does not become a ringtone on its own
              </strong>
              . iOS doesn&apos;t let a downloaded file register itself as a
              system sound. You need either GarageBand on the phone — import the
              file into a project, then Share → Ringtone — or a computer, with
              the phone connected and the M4R dragged into the device&apos;s
              Tones section in Finder or iTunes. Both work; neither is one tap,
              and any site promising otherwise on iOS is overselling.
            </p>
            <p>
              Android is genuinely simple: move the MP3 into the Ringtones folder
              on internal storage, then pick it under Settings → Sound → Phone
              ringtone. Some launchers also let you set it directly from a file
              manager&apos;s share menu.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              One thing worth checking first
            </h2>
            <p>
              Most sounds on TikTok are commercial music licensed to TikTok, not
              to the person who posted them. For a ringtone on your own phone
              that&apos;s a non-issue — personal use of audio you&apos;ve
              legitimately obtained is the least contentious case there is. It
              matters if you plan to distribute the file, sell a ringtone pack,
              or use the clip in something monetised. Keep it personal and
              there&apos;s nothing to think about.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-graphite-800 flex flex-wrap gap-3">
          <Link href="/tiktok-to-mp3" className={buttonStyles({ size: "lg" })}>
            Get the TikTok audio
            <ArrowRight />
          </Link>
          <Link
            href="/ringtone-maker"
            className={buttonStyles({ variant: "outline", size: "lg" })}
          >
            Open the Ringtone Maker
          </Link>
        </div>
      </main>
    </>
  );
}