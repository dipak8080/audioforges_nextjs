import { buttonStyles } from "@/components/ui/Button";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";

const guide = getGuideBySlug("podcast-audio-cleanup-checklist")!;

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
};

export default function PodcastCleanupChecklistPage() {
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
            Most rough podcast recordings share the same three problems: a
            low-frequency rumble from handling noise or AC hum, a steady hiss or
            hum sitting under the voice, and loudness that jumps around between
            takes or speakers. The fixes are simple individually, but the order
            you apply them in actually matters — doing it out of order makes
            each later step work harder and perform worse.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Step 1: Cut low-frequency rumble first
            </h2>
            <p>
              Rumble — the low, muddy energy from handling noise, desk vibration,
              HVAC hum, or a mic stand picking up footsteps — sits well below the
              range of the human voice. Cutting it is a high-pass filter, not a
              denoiser: it removes a whole frequency band rather than trying to
              distinguish noise from signal. Doing this first matters because
              rumble can otherwise confuse a denoising step in the next
              stage — some of that low-end energy can get mistaken for part of
              the noise profile, making the denoiser work less precisely than it
              would on a recording that&apos;s already had the rumble cut clean.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Step 2: Apply speech-tuned noise reduction
            </h2>
            <p>
              With rumble already removed, a denoiser tuned specifically for
              speech can focus entirely on the noise that&apos;s actually left —
              hiss, hum, background static — without needing to also account for
              low-end rumble it would otherwise have to work around. A
              speech-specific preset can be more targeted than a general
              denoiser precisely because it only has to protect one type of
              signal: the frequency range of a human voice, not the much wider
              range music or field recordings can occupy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Step 3: Normalize loudness last
            </h2>
            <p>
              Loudness normalization should come after cleanup, not before.
              Normalizing first means you&apos;re setting levels based on a
              recording that still has rumble and noise contributing to its
              overall level — the normalization ends up calibrated against
              content you&apos;re about to remove. Normalizing after cleanup sets
              the final loudness based on what will actually ship, giving a more
              accurate and consistent result, especially across multiple takes
              or speakers recorded at different levels.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why order matters more than it seems
            </h2>
            <p>
              Each of these three steps changes the input the next step sees.
              Skip the rumble cut and the denoiser has to work around low-end
              energy it wasn&apos;t designed to prioritize. Normalize before
              cleanup and you&apos;re calibrating loudness against noise
              you&apos;re about to strip out. The fixed order — rumble, then
              denoise, then normalize — exists because each stage performs
              better when it&apos;s only solving the problem it&apos;s actually
              built for, not compensating for a step that should have happened
              earlier.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Doing it in one pass
            </h2>
            <p>
              Running these three steps manually with separate tools means
              getting the order right yourself every time. Our{" "}
              <Link href="/voice-clean" className="text-amber-400 hover:underline">
                Voice Cleaner
              </Link>{" "}
              runs this exact chain — rumble cut, speech-tuned denoise, loudness
              normalization — in the correct order automatically, with nothing
              to configure. It&apos;s built specifically for speech content:
              podcasts, interviews, phone recordings, and voice memos. If
              you&apos;re working with music or need to control noise reduction
              strength directly instead, the{" "}
              <Link href="/noise-remove" className="text-amber-400 hover:underline">
                Noise Remover
              </Link>{" "}
              is the better fit.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-graphite-800 flex flex-wrap gap-3">
          <Link
            href="/voice-clean"
            className={buttonStyles({ size: "lg" })}
          >
            Try the Voice Cleaner
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/noise-remove"
            className="inline-flex items-center gap-2 rounded-lg border border-graphite-700 text-text-primary font-medium px-6 py-3 hover:border-amber-500/40 transition-colors"
          >
            Try the Noise Remover
          </Link>
        </div>
      </main>
    </>
  );
}