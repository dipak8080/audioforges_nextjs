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

const guide = getGuideBySlug("tiktok-sound-to-ringtone")!;

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

export default function TikTokSoundToRingtoneGuidePage() {
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
            A TikTok sound makes a good ringtone for the same reason it works on
            TikTok: it&apos;s short, front-loaded, and recognisable in about two
            seconds. Getting one onto your phone is four steps of actual audio
            work and one step of phone admin — and the phone admin is the part
            most guides skip, which is why people end up with a perfect 25-second
            clip sitting in their Downloads folder doing nothing.
          </p>

          <h2 id="start-with-audio">Start with the audio, not the video</h2>
          <p>
            Pull the sound out first with the{" "}
            <Link href="/tiktok-to-mp3">TikTok to MP3 converter</Link> — paste the
            share link and you get the audio on its own. Working from the MP3
            rather than a screen recording matters here: a recording captures your
            phone&apos;s speaker, room noise and all, and a ringtone is the one
            file where that gets played at full volume in a quiet room.
          </p>

          <h2 id="pick-the-hook">Pick the hook, not the beginning</h2>
          <p>
            A ringtone plays for four or five seconds before someone reaches the
            phone. If the first four seconds are a build-up, an intro, or a spoken
            lead-in, the ringtone is those four seconds — the part you actually
            wanted never arrives. Find the moment the sound becomes recognisable
            and start a beat or two before it.
          </p>
          <p>
            The <Link href="/trim">Audio Trimmer</Link> shows the waveform, so the
            hook is usually visible as the point where the shape gets denser. Drag
            the handles around it, preview, and adjust — most sounds take two or
            three attempts to land on the right entry point.
          </p>

          <h2 id="length">How long to make it</h2>
          <p>
            iPhone caps ringtones at <strong>30 seconds</strong> and text tones at
            30 seconds as well; Android has no hard limit but stops the ringtone
            when you answer, so length past about 30 seconds is theoretical either
            way. In practice 15 to 25 seconds is the useful range: long enough not
            to loop awkwardly while the phone rings out, short enough that the
            whole clip is the good part.
          </p>

          <h2 id="fade">Fade the ends, or you&apos;ll hear a click</h2>
          <p>
            Cutting audio at an arbitrary point almost always lands mid-waveform,
            and the jump from that value to silence is a sharp transient your
            speaker reproduces as a click or pop. On a ringtone it&apos;s
            especially obvious, because the clip loops — so the click repeats every
            time round.
          </p>
          <p>
            A <Link href="/fade">fade in and out</Link> of 20 to 50 milliseconds
            at each end removes it without being audible as a fade.{" "}
            <Link href="/guides/why-audio-needs-a-fade-in-out">
              Read Why Trimmed Audio Clips Need a Fade In and Out
            </Link>{" "}
            for what&apos;s actually happening at that cut point.
          </p>

          <h2 id="loudness">Make it loud enough to hear</h2>
          <p>
            Ringtones play through a phone&apos;s bottom-firing speaker, usually
            from a pocket or a table across the room. A clip that sounds fine in
            headphones can be inaudible there. TikTok audio is often already loud,
            but if yours came from a quiet source, run it through the{" "}
            <Link href="/volume">Volume Booster</Link> or the{" "}
            <Link href="/loudness-normalizer">Loudness Normalizer</Link> before
            exporting. Normalising to a consistent loudness also stops one
            ringtone being twice as loud as the next when you switch.
          </p>

          <h2 id="format">Export the right format</h2>
          <p>
            Android takes the MP3 as-is. iPhone needs <strong>M4R</strong>, which
            is AAC audio with a different extension — the{" "}
            <Link href="/ringtone-maker">Ringtone Maker</Link> handles the trim
            and the M4R export in one step, so you can skip straight there if your
            clip doesn&apos;t need loudness work.{" "}
            <Link href="/guides/what-is-an-m4r-file-explained">
              Read What Is an M4R File? iPhone Ringtone Explained
            </Link>{" "}
            if you want the detail on why iOS insists on it.
          </p>

          <h2 id="onto-the-phone">Getting it onto the phone</h2>
          <p>
            This is where most guides stop short, so to be direct about it:{" "}
            <strong>an M4R in your Files app does not become a ringtone on its
            own</strong>. iOS doesn&apos;t let a downloaded file register itself
            as a system sound. You need either GarageBand on the phone — import
            the file into a project, then Share &rarr; Ringtone — or a computer,
            with the phone connected and the M4R dragged into the device&apos;s
            Tones section in Finder or iTunes. Both work; neither is one tap, and
            any site promising otherwise on iOS is overselling.
          </p>
          <p>
            Android is genuinely simple: move the MP3 into the Ringtones folder on
            internal storage, then pick it under Settings &rarr; Sound &rarr;
            Phone ringtone. Some launchers also let you set it directly from a
            file manager&apos;s share menu.
          </p>

          <h2 id="rights">One thing worth checking first</h2>
          <p>
            Most sounds on TikTok are commercial music licensed to TikTok, not to
            the person who posted them. For a ringtone on your own phone
            that&apos;s a non-issue — personal use of audio you&apos;ve
            legitimately obtained is the least contentious case there is. It
            matters if you plan to distribute the file, sell a ringtone pack, or
            use the clip in something monetised. Keep it personal and there&apos;s
            nothing to think about.
          </p>
        </Prose>

        <div className="mt-10 flex flex-wrap gap-3 border-t border-graphite-800 pt-8">
          <Link href="/tiktok-to-mp3" className={buttonStyles({ size: "lg" })}>
            Get the TikTok audio
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/ringtone-maker"
            className="inline-flex items-center gap-2 rounded-lg border border-graphite-700 px-6 py-3 font-medium text-text-primary transition-colors hover:border-amber-500/40"
          >
            Open the Ringtone Maker
          </Link>
        </div>
      </main>
    </>
  );
}