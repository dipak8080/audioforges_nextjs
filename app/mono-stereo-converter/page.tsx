// app/guides/mono-vs-stereo-what-changes/page.tsx
import { buttonStyles } from "@/components/ui/Button";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";

const guide = getGuideBySlug("mono-vs-stereo-what-changes")!;

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

// No FAQPage schema here on purpose — /mono-stereo-converter already emits
// FAQPage for this topic. Two FAQPage blocks on the same subject across two
// URLs is the cannibalization we're trying to remove, not add to.
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

export default function MonoStereoGuidePage() {
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
          {/* Direct answer in the first 40 words — this is the paragraph
              Google lifts for a featured snippet, and the one a reader
              needs before deciding whether to keep reading. */}
          <p>
            <strong className="text-text-primary">
              Mono audio is one channel; stereo is two.
            </strong>{" "}
            That&apos;s the whole difference. Neither is higher quality than
            the other — stereo isn&apos;t a better version of mono, it&apos;s
            a different number of channels. What matters is what happens at
            the edges: a stereo mix can lose entire elements when it gets
            played back in mono, and that failure is silent until it
            happens in front of an audience.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              What mono and stereo actually are
            </h2>
            <p>
              Mono (monaural) is a single channel of audio. Every speaker
              plays the identical signal. There is no left and no right,
              because there is only one thing to play.
            </p>
            <p>
              Stereo is two independent channels. They can carry different
              content, and that difference is what produces the impression of
              width — a guitar sitting slightly left, keys slightly right, a
              reverb tail spreading outward. Crucially, the width lives in
              the <em>difference</em> between the channels. Two identical
              channels are stereo in file format and mono in every way that
              matters to your ears.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              The real reason this matters: phase cancellation
            </h2>
            <p>
              This is the part most explanations skip, and it&apos;s the only
              part with real consequences.
            </p>
            <p>
              When two channels are summed into one, they add together sample
              by sample. If the left and right channels contain the same
              sound but with opposite polarity — one pushing while the other
              pulls — the sum is silence. Not a quieter version. Silence.
              That sound disappears entirely from the mono result while
              sounding perfectly fine in stereo.
            </p>
            <p>
              Partial cancellation is more common than total cancellation and
              harder to notice. A sound that was full in stereo comes back
              thin, hollow, or noticeably quieter, and because nothing
              obviously broke, it&apos;s easy to blame the room or the
              speakers instead of the mix.
            </p>
            <p>The usual culprits:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong className="text-text-primary">
                  Stereo widening plugins.
                </strong>{" "}
                Many create width by phase-inverting part of one channel.
                That is exactly the condition that cancels on summing — the
                wider it sounds in stereo, the more it can vanish in mono.
              </li>
              <li>
                <strong className="text-text-primary">
                  Two microphones on one source.
                </strong>{" "}
                If the mics sit at different distances, the same sound
                arrives at each at a slightly different time. Some
                frequencies cancel when the channels are summed.
              </li>
              <li>
                <strong className="text-text-primary">
                  Haas-effect doubling.
                </strong>{" "}
                Delaying one side by a few milliseconds to fake width has the
                same problem — the delay becomes comb filtering the moment
                the channels combine.
              </li>
              <li>
                <strong className="text-text-primary">
                  Mid-side processing pushed too far.
                </strong>{" "}
                Boosting the side signal heavily means more of the mix lives
                in the difference between channels, and the difference is
                precisely what mono discards.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Where your music actually gets played in mono
            </h2>
            <p>
              Mono compatibility sounds like a legacy concern. It isn&apos;t.
              A large share of real-world listening is mono or effectively
              mono:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong className="text-text-primary">Club and PA systems.</strong>{" "}
                Many venues run their sub and often the whole system in mono,
                because stereo imaging is meaningless when the audience is
                spread across a room and most of them aren&apos;t standing in
                the sweet spot.
              </li>
              <li>
                <strong className="text-text-primary">Phone speakers.</strong>{" "}
                A single speaker is mono by definition. Even dual-speaker
                phones are so close together that separation barely
                registers.
              </li>
              <li>
                <strong className="text-text-primary">
                  Smart speakers and small Bluetooth speakers.
                </strong>{" "}
                Single-driver units sum everything to mono before it reaches
                the driver.
              </li>
              <li>
                <strong className="text-text-primary">Laptop speakers.</strong>{" "}
                Technically two, positioned centimetres apart, firing
                downward. Functionally mono.
              </li>
              <li>
                <strong className="text-text-primary">Anyone with one earbud in.</strong>{" "}
                Depending on the device, they get one channel only or a mono
                sum — either way, not what you mixed.
              </li>
            </ul>
            <p>
              A mix that only holds together in stereo is a mix that falls
              apart in most of the places it will actually be heard.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              How to check a mix in mono
            </h2>
            <p>
              Convert the mix to mono and listen to it against the stereo
              version. You are listening for things that <em>change level</em>,
              not things that sound narrower — narrower is expected and fine.
            </p>
            <p>Specifically:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                Does any element get quieter or disappear? That&apos;s
                cancellation, and it points straight at whatever you did to
                widen it.
              </li>
              <li>
                Does the low end lose weight? Bass content that isn&apos;t
                centred is the most common offender, and it&apos;s the most
                damaging on a club system.
              </li>
              <li>
                Do reverbs and pads go thin or hollow? Stereo reverb is a
                frequent partial-cancellation source.
              </li>
              <li>
                Does the vocal still sit forward? A vocal that only cuts
                through because everything else is panned away will get
                buried once nothing is panned anywhere.
              </li>
            </ul>
            <p>
              If something drops out, the fix is at the source: turn down the
              widener, check mic polarity, keep low frequencies centred, or
              build width by panning genuinely different content rather than
              phase-tricking one signal.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              When stereo actively makes things worse
            </h2>
            <p>
              Stereo isn&apos;t the safe default. For a single spoken voice —
              podcast, narration, interview — there is one sound source in
              one position, so there is nothing for two channels to
              represent. What you often get instead is stereo room reverb
              that sounds spacious on headphones and smeared on a phone
              speaker, plus double the file size for no added information.
            </p>
            <p>
              Mono is also more forgiving of listener position. A stereo mix
              has a sweet spot; step outside it and the balance shifts. Mono
              sounds the same everywhere in the room, which is why it&apos;s
              standard for public address and phone systems.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Converting mono to stereo adds nothing
            </h2>
            <p>
              Going the other direction is the most common misunderstanding.
              Converting a mono file to stereo copies the identical signal to
              both channels. The file is now two-channel, and it sounds
              exactly as it did before — because width comes from the
              difference between channels, and two copies of the same thing
              have no difference.
            </p>
            <p>
              That&apos;s still a legitimate operation when a platform
              rejects mono uploads and just needs two channels present. It is
              not a way to widen anything. Real width requires putting
              genuinely different content in each channel: panning separate
              elements, recording with multiple mics in different positions,
              or a stereo effect that generates new material rather than
              inverting existing material.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Running the conversion
            </h2>
            <p>
              The{" "}
              <Link
                href="/mono-stereo-converter"
                className="text-amber-400 hover:underline"
              >
                Mono/Stereo Converter
              </Link>{" "}
              converts in either direction — upload, pick the target, download.
              For a mono compatibility check, convert your stereo bounce to
              mono and A/B the two files.
            </p>
            <p>
              If a mono check reveals that low end is the thing losing
              weight, the{" "}
              <Link href="/loudness-normalizer" className="text-amber-400 hover:underline">
                Loudness Normalizer
              </Link>{" "}
              will show you how much level you actually lost between the two
              versions rather than leaving you guessing by ear.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-graphite-800">
          <Link
            href="/mono-stereo-converter"
            className={buttonStyles({ size: "lg" })}
          >
            Try the Mono/Stereo Converter
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}