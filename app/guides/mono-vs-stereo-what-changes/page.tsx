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
          <p>
            It&apos;s easy to assume stereo is just "better" than mono, so
            converting a file to stereo must be an upgrade. It isn&apos;t —
            mono and stereo describe channel count, not quality, and
            converting between them doesn&apos;t add or remove any fidelity.
            What it actually does depends on which direction you&apos;re
            going, and it&apos;s worth understanding before you assume the
            result is what you expected.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              What mono and stereo actually are
            </h2>
            <p>
              Mono audio is a single channel — the same signal plays from
              every speaker. Stereo audio is two independent channels, left
              and right, which can carry different content to create a sense
              of width and position in the sound field. A stereo recording of
              a band, for example, might have the guitar sitting slightly
              left and the keys slightly right, because those are genuinely
              two different signals. A mono recording of the same performance
              has no such separation to begin with — there&apos;s only one
              signal, period.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              What happens converting stereo to mono
            </h2>
            <p>
              Converting stereo to mono combines the left and right channels
              into one. Whatever separation existed between them —
              instruments panned to one side, a wide stereo effect, anything
              placed off-center — collapses into a single centered signal.
              The result isn&apos;t damaged audio, but it is a genuinely
              different listening experience from the original: anything that
              relied on stereo separation to be heard clearly can end up
              sitting on top of everything else in the mix once there&apos;s
              only one channel left.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              What happens converting mono to stereo
            </h2>
            <p>
              This direction surprises people more often. Converting mono to
              stereo duplicates the identical signal onto both the left and
              right channels — it doesn&apos;t invent new stereo information
              that wasn&apos;t there. There&apos;s nothing to separate in a
              single-channel source, so the result is technically
              two-channel audio, but it sounds exactly as centered and
              "flat" as the mono original. If a platform requires stereo
              input, this satisfies that requirement; if you were hoping for
              actual stereo width, this conversion alone won&apos;t produce
              it, because true stereo width comes from having two genuinely
              different channels of content, not from doubling one channel.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why you'd actually want either direction
            </h2>
            <p>
              Converting to mono comes up most with voice content: phone
              systems, IVR prompts, and some podcast platforms expect or
              prefer single-channel audio, and a mono file is also smaller
              than its stereo equivalent for the same content. Converting to
              stereo comes up when an upload target rejects or mishandles
              mono files outright and simply needs two channels present,
              regardless of whether they carry different information — a
              formatting requirement rather than a creative choice.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              This isn't the same as adding stereo width
            </h2>
            <p>
              It&apos;s worth being clear about what this conversion can and
              can&apos;t do. Techniques that actually create a sense of stereo
              width — panning different elements to different sides,
              stereo-widening effects, genuine multi-mic recording — work by
              putting different content in the left and right channels.
              Converting a mono file to stereo doesn&apos;t do any of that;
              it's a format change, not a creative effect. If what you're
              after is width that wasn't in the source, this tool isn't the
              way to get there — it's the way to satisfy a channel-count
              requirement without altering how the audio actually sounds.
            </p>
            <p>
              Our{" "}
              <Link href="/mono-stereo-converter" className="text-amber-400 hover:underline">
                Mono/Stereo Converter
              </Link>{" "}
              runs this exact conversion in either direction — upload a file,
              pick the target, and download the result, no account or
              software install needed.
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