import type { Metadata } from "next";
import Link from "next/link";
import { EchoRemoveForm } from "@/components/converter/EchoRemoveForm";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Free Echo Reducer — Tame Echo & Slap-Back in Recordings",
  description:
    "Reduce echo in speech or music recordings free, no sign-up. Best for mild room echo and slap-back — upload, process, and download in seconds.",
  keywords: [
    "reduce echo audio",
    "remove echo from recording",
    "echo reducer online",
    "fix echo in audio free",
    "slap echo remover",
  ],
  alternates: { canonical: `${SITE_URL}/echo-remove` },
  openGraph: {
    title: "Free Echo Reducer — Tame Echo & Slap-Back in Recordings",
    description: "Reduce echo in speech or music recordings free, no sign-up.",
    url: `${SITE_URL}/echo-remove`,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Echo Reducer — Tame Echo & Slap-Back in Recordings",
    description: "Reduce echo in speech or music recordings free, no sign-up.",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Does this fully remove echo?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "It reduces mild room echo and repeated slap-back echo well, but it doesn't perform full acoustic dereverberation — heavy reverb from a large or empty room won't be fully eliminated.",
      },
    },
    {
      "@type": "Question",
      name: "What kind of echo does this work best on?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Mild room echo on speech recordings and repeated/slap echo. It's not designed for cleaning heavy reverb from concert halls or large empty spaces.",
      },
    },
    {
      "@type": "Question",
      name: "Is this really free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — completely free, no sign-up, no watermark on the output.",
      },
    },
    {
      "@type": "Question",
      name: "What formats are supported?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "MP3, WAV, FLAC, M4A, AAC, OGG, and AIFF, up to 50MB and 20 minutes long.",
      },
    },
  ],
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Echo Reducer",
  url: `${SITE_URL}/echo-remove`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Reduces mild room echo",
    "Reduces repeated/slap echo",
    "No sign-up required",
    "No watermark",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Echo Reducer", item: `${SITE_URL}/echo-remove` },
  ],
};

export default function EchoRemovePage() {
  const relatedTools = getRelatedTools("echo-remove", 2);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free Echo Reducer
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Tame mild room echo and slap-back in a recording — free, no sign-up, no
            watermark.
          </p>
        </header>

        <EchoRemoveForm />

        <section className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
          <h2 className="font-semibold text-text-primary">What this does (and doesn&apos;t) fix</h2>
          <p className="text-sm text-text-muted leading-relaxed">
            This tool reduces mild room echo and repeated/slap-back echo well. It does
            not perform full acoustic dereverberation — heavy reverb from a large or
            empty room won&apos;t be fully eliminated. Think &quot;reduce,&quot; not
            &quot;remove completely.&quot;
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "One click", desc: "No settings to tune — just upload." },
            { title: "Fast", desc: "Most files process in a few seconds." },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <h3 className="font-semibold text-text-primary">{f.title}</h3>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">When to use this</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              Good fits: a phone recording made in a tiled bathroom or hallway, a voice
              memo with a faint repeat, or an interview recorded in a slightly echoey
              room. This works by gating out the quiet trailing reflections that create
              the echo sensation.
            </p>
            <p>
              For speech recordings that also have background noise or inconsistent
              loudness alongside the echo, try the{" "}
              <Link href="/voice-clean" className="text-amber-400 hover:underline">
                Voice Cleaner
              </Link>{" "}
              first — it handles denoising and normalization in the same pass.
            </p>
          </div>
        </section>

        {relatedTools.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-text-primary">More free tools</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {relatedTools.map((tool) => (
                <Link
                  key={tool.slug}
                  href={`/${tool.slug}`}
                  className="rounded-xl border border-graphite-800 bg-graphite-900 p-4 hover:border-amber-500/40 transition-colors"
                >
                  <h3 className="font-semibold text-text-primary">{tool.name}</h3>
                  <p className="text-sm text-text-muted mt-1">{tool.shortDescription}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Frequently asked questions</h2>
          <div className="space-y-5 text-text-muted leading-relaxed">
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Does this fully remove echo?</h3>
              <p>
                It reduces mild room echo and repeated slap-back echo well, but it
                doesn&apos;t perform full acoustic dereverberation — heavy reverb from a
                large or empty room won&apos;t be fully eliminated.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">What kind of echo does this work best on?</h3>
              <p>
                Mild room echo on speech recordings and repeated/slap echo. It&apos;s not
                designed for cleaning heavy reverb from concert halls or large empty
                spaces.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Is this really free?</h3>
              <p>Yes — completely free, no sign-up, no watermark on the output.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">What formats are supported?</h3>
              <p>MP3, WAV, FLAC, M4A, AAC, OGG, and AIFF, up to 50MB and 20 minutes long.</p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}