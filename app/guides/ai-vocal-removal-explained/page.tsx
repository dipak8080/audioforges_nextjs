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

const guide = getGuideBySlug("ai-vocal-removal-explained")!;

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

export default function AiVocalRemovalGuidePage() {
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
            &quot;Vocal remover&quot; covers two genuinely different technologies
            that happen to share a name. One is a decades-old trick that works on
            a narrow assumption about how a mix is built; the other is a learned
            model that actually recognizes what a voice sounds like. Knowing which
            one you&apos;re using changes what result you should expect.
          </p>

          <h2 id="center-channel">The old method: center-channel filtering</h2>
          <p>
            A center-channel filter works on one assumption: in a typical stereo
            mix, the lead vocal is panned dead-center, while other elements are
            spread left and right. The filter cancels out whatever&apos;s
            identical in both channels — which, if the vocal really is centered,
            removes it. The catch is that other things are often centered too:
            kick drum, bass, snare. Cancel the center channel and you don&apos;t
            just lose the vocal, you lose or thin out everything else sitting
            there with it. And if the vocal isn&apos;t perfectly centered —
            doubled vocals, wide harmonies, certain mix styles — a meaningful
            amount of it survives as audible bleed.
          </p>

          <h2 id="source-separation">The newer method: AI source separation</h2>
          <p>
            AI source separation doesn&apos;t rely on stereo positioning at all. A
            model trained on large amounts of mixed and unmixed audio learns the
            general characteristics that distinguish a human voice from other
            instruments — timbre, harmonic structure, the way pitch and formants
            move over time — and uses that learned pattern to separate a track
            into stems regardless of where anything sits in the stereo field. This
            is why it works on mixes a center-channel filter would fail on
            entirely, and why it produces a cleaner instrumental with far less
            bleed.
          </p>

          <h2 id="limitations">Where separation still struggles</h2>
          <p>
            AI separation is much better than center-channel filtering, but
            it&apos;s not flawless on every source. Dense mixes with many
            overlapping instruments give the model less clear signal to work from.
            Heavy reverb or delay on a vocal blurs the boundary between voice and
            the rest of the mix, since some of that trailing sound genuinely
            resembles other instrumentation. Doubled or heavily harmonized vocals
            can also leave faint traces in the instrumental, since the model has
            more vocal-like content to separate out cleanly. Simpler mixes — a
            clear lead vocal over a straightforward band arrangement — tend to
            separate the most cleanly.
          </p>

          <h2 id="instrumental-vs-acapella">
            Instrumental vs. acapella: same process, opposite stem
          </h2>
          <p>
            Both outputs come from the same separation pass — an{" "}
            <strong>instrumental</strong> keeps everything except the vocal, and
            an <strong>acapella</strong> keeps only the vocal and discards the
            rest. Which one you want depends on what you&apos;re building: karaoke
            and cover practice call for the instrumental, while sampling a vocal
            hook or building a mashup usually calls for the acapella.
          </p>

          {/* This heading had a raw apostrophe in JSX text, which fails
              react/no-unescaped-entities. `next build` doesn't run ESLint, so it
              only surfaces on a lint run. */}
          <h2 id="why-slower">Why it&apos;s slower than other audio tools</h2>
          <p>
            Source separation is genuinely more computationally demanding than a
            format conversion or a simple filter — it&apos;s running a full model
            over the entire track rather than applying a fixed transformation.
            That&apos;s why a separation tool typically takes longer and is
            rate-limited more strictly than something like a converter or a
            trimmer; it&apos;s solving a fundamentally harder problem.
          </p>
          <p>
            Our <Link href="/vocal-remover">AI Vocal Remover</Link> runs this exact
            process — upload a track and get back a separated instrumental or
            acapella, no account or software install needed.
          </p>
        </Prose>

        <div className="mt-10 border-t border-graphite-800 pt-8">
          <Link href="/vocal-remover" className={buttonStyles({ size: "lg" })}>
            Try the AI Vocal Remover
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}