import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";

const guide = getGuideBySlug("removing-background-noise-from-recordings")!;

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
  author: { "@type": "Person", name: "AudioForges" },
};

export default function NoiseRemovalGuidePage() {
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
            Background noise removal isn&apos;t magic — it&apos;s a tradeoff
            between how much noise gets pulled out and how much of the wanted
            audio gets damaged in the process. Understanding that tradeoff is
            what separates a clean result from one that sounds worse than the
            noise you started with.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              How FFT-based noise reduction works
            </h2>
            <p>
              Most denoisers, including FFT-based ones, work by analyzing the
              audio&apos;s frequency content over time and identifying a noise
              profile — the frequencies where hiss, hum, or static consistently
              sit. It then reduces energy at those frequencies throughout the
              file, on the assumption that steady background noise occupies
              roughly the same frequency range the whole way through, while the
              wanted audio (voice, instruments) moves around more.
            </p>
            <p>
              That assumption is usually solid for genuinely steady noise —
              tape hiss, fan hum, electrical buzz. It breaks down when the noise
              overlaps heavily with frequencies your wanted audio also uses,
              which is exactly what happens when you push reduction strength
              too far.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why aggressive settings cause warbling
            </h2>
            <p>
              Warbling — a fluttery, underwater-sounding artifact — shows up
              when the denoiser starts removing energy from frequencies the
              wanted audio actually needs, not just the noise. At low-to-moderate
              strength, the algorithm can be conservative about where the line
              sits between noise and signal. Push it higher and it gets more
              aggressive about cutting anything resembling the noise profile,
              which starts carving into the wanted audio&apos;s own frequency
              content too — especially on music, where instruments and vocals
              legitimately occupy a wide frequency range that can overlap with
              the noise being targeted.
            </p>
            <p>
              This is why a default, moderate strength setting works well for
              most recordings, and why raising it should be a response to
              audibly remaining noise, not a default move toward &quot;more is
              better.&quot;
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              General denoising vs. a speech-specific preset
            </h2>
            <p>
              A general-purpose denoiser has to work across music, field
              recordings, and speech, which means it can&apos;t make assumptions
              specific to any one of them — you control the strength directly and
              accept the resulting tradeoff yourself. A speech-tuned preset can
              afford to be more targeted, since it only needs to preserve one
              type of signal: the human voice&apos;s frequency range. That lets
              it combine noise reduction with other speech-specific steps — like
              cutting low-frequency rumble and normalizing loudness — in a fixed
              chain that&apos;s already tuned for exactly that content.
            </p>
            <p>
              In practice: if your source is specifically a podcast, phone
              recording, or interview, a speech-tuned chain will usually
              outperform manually dialing in a general denoiser. If your source
              is music, a field recording, or anything else where the frequency
              content is less predictable, a general-purpose denoiser with
              direct strength control is the better fit.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              A practical approach
            </h2>
            <p>
              Start at the default strength and only increase it if noise is
              still clearly audible — don&apos;t jump straight to an aggressive
              setting expecting a cleaner result. If you hear warbling or a
              hollowed-out quality after processing, that&apos;s a sign the
              strength was pushed past what the source material could tolerate;
              back it off rather than trying to fix it with more processing.
            </p>
            <p>
              Our{" "}
              <Link href="/noise-remove" className="text-amber-400 hover:underline">
                Noise Remover
              </Link>{" "}
              gives you direct control over reduction strength for music and
              general audio. For speech-only recordings, the{" "}
              <Link href="/voice-clean" className="text-amber-400 hover:underline">
                Voice Cleaner
              </Link>{" "}
              runs a fixed, speech-optimized chain that usually needs no manual
              tuning at all.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-graphite-800 flex flex-wrap gap-3">
          <Link
            href="/noise-remove"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 text-graphite-950 font-medium px-6 py-3 hover:bg-amber-400 transition-colors"
          >
            Try the Noise Remover
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/voice-clean"
            className="inline-flex items-center gap-2 rounded-lg border border-graphite-700 text-text-primary font-medium px-6 py-3 hover:border-amber-500/40 transition-colors"
          >
            Try the Voice Cleaner
          </Link>
        </div>
      </main>
    </>
  );
}