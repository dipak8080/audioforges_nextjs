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

const guide = getGuideBySlug("removing-background-noise-from-recordings")!;

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

export default function NoiseRemovalGuidePage() {
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
            Background noise removal isn&apos;t magic — it&apos;s a tradeoff
            between how much noise gets pulled out and how much of the wanted
            audio gets damaged in the process. Understanding that tradeoff is what
            separates a clean result from one that sounds worse than the noise you
            started with.
          </p>

          <h2 id="how-it-works">How FFT-based noise reduction works</h2>
          <p>
            Most denoisers, including FFT-based ones, work by analyzing the
            audio&apos;s frequency content over time and identifying a noise
            profile — the frequencies where hiss, hum, or static consistently sit.
            It then reduces energy at those frequencies throughout the file, on
            the assumption that steady background noise occupies roughly the same
            frequency range the whole way through, while the wanted audio (voice,
            instruments) moves around more.
          </p>
          <p>
            That assumption is usually solid for genuinely steady noise — tape
            hiss, fan hum, electrical buzz. It breaks down when the noise overlaps
            heavily with frequencies your wanted audio also uses, which is exactly
            what happens when you push reduction strength too far.
          </p>

          <h2 id="warbling">Why aggressive settings cause warbling</h2>
          <p>
            Warbling — a fluttery, underwater-sounding artifact — shows up when
            the denoiser starts removing energy from frequencies the wanted audio
            actually needs, not just the noise. At low-to-moderate strength, the
            algorithm can be conservative about where the line sits between noise
            and signal. Push it higher and it gets more aggressive about cutting
            anything resembling the noise profile, which starts carving into the
            wanted audio&apos;s own frequency content too — especially on music,
            where instruments and vocals legitimately occupy a wide frequency
            range that can overlap with the noise being targeted.
          </p>
          <p>
            This is why a default, moderate strength setting works well for most
            recordings, and why raising it should be a response to audibly
            remaining noise, not a default move toward &quot;more is better.&quot;
          </p>

          <h2 id="general-vs-speech">
            General denoising vs. a speech-specific preset
          </h2>
          <p>
            A general-purpose denoiser has to work across music, field recordings,
            and speech, which means it can&apos;t make assumptions specific to any
            one of them — you control the strength directly and accept the
            resulting tradeoff yourself. A speech-tuned preset can afford to be
            more targeted, since it only needs to preserve one type of signal: the
            human voice&apos;s frequency range. That lets it combine noise
            reduction with other speech-specific steps — like cutting
            low-frequency rumble and normalizing loudness — in a fixed chain
            that&apos;s already tuned for exactly that content.
          </p>
          <p>
            In practice: if your source is specifically a podcast, phone
            recording, or interview, a speech-tuned chain will usually outperform
            manually dialing in a general denoiser. If your source is music, a
            field recording, or anything else where the frequency content is less
            predictable, a general-purpose denoiser with direct strength control
            is the better fit.
          </p>

          <h2 id="approach">A practical approach</h2>
          <p>
            Start at the default strength and only increase it if noise is still
            clearly audible — don&apos;t jump straight to an aggressive setting
            expecting a cleaner result. If you hear warbling or a hollowed-out
            quality after processing, that&apos;s a sign the strength was pushed
            past what the source material could tolerate; back it off rather than
            trying to fix it with more processing.
          </p>
          <p>
            Our <Link href="/noise-remove">Noise Remover</Link> gives you direct
            control over reduction strength for music and general audio. For
            speech-only recordings, the{" "}
            <Link href="/voice-clean">Voice Cleaner</Link> runs a fixed,
            speech-optimized chain that usually needs no manual tuning at all.
          </p>
        </Prose>

        <div className="mt-10 flex flex-wrap gap-3 border-t border-graphite-800 pt-8">
          <Link href="/noise-remove" className={buttonStyles({ size: "lg" })}>
            Try the Noise Remover
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/voice-clean"
            className="inline-flex items-center gap-2 rounded-lg border border-graphite-700 px-6 py-3 font-medium text-text-primary transition-colors hover:border-amber-500/40"
          >
            Try the Voice Cleaner
          </Link>
        </div>
      </main>
    </>
  );
}