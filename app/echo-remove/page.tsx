import type { Metadata } from "next";
import Link from "next/link";
import { EchoRemoveForm } from "@/components/converter/EchoRemoveForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Free Echo Remover — Reduce Echo & Slap-Back in Recordings",
  description:
    "Reduce or remove echo from audio recordings online free. Improve voice recordings, podcasts, and interviews by cutting room echo and slap-back. No sign-up.",
  keywords: [
    "remove echo from audio",
    "echo remover",
    "echo remover online",
    "remove echo from recording",
    "remove echo from voice recording",
    "reduce echo audio",
    "remove room echo",
    "fix echo in audio free",
    "slap echo remover",
    "audio echo remover",
    "remove echo from microphone",
    "remove echo from voice",
    "remove echo from podcast",
    "clean echo from recording",
  ],
  alternates: { canonical: `${SITE_URL}/echo-remove` },
  openGraph: {
    title: "Free Echo Remover — Reduce Echo & Slap-Back in Recordings",
    description:
      "Reduce or remove echo from audio recordings online free. Improve voice recordings, podcasts, and interviews by cutting room echo and slap-back. No sign-up.",
    url: `${SITE_URL}/echo-remove`,
    siteName: SITE_NAME,
    type: "website",
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
    title: "Free Echo Remover — Reduce Echo & Slap-Back in Recordings",
    description:
      "Reduce or remove echo from audio recordings online free. Improve voice recordings, podcasts, and interviews by cutting room echo and slap-back. No sign-up.",
    images: ["/images/og-default.png"],
  },
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Echo Remover",
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
    { "@type": "ListItem", position: 2, name: "Echo Remover", item: `${SITE_URL}/echo-remove` },
  ],
};

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Reduce Echo in a Recording",
  step: [
    { "@type": "HowToStep", name: "Upload", text: "Upload an MP3, WAV, FLAC, M4A, AAC, OGG, or AIFF file." },
    { "@type": "HowToStep", name: "Process", text: "The tool gates out the quiet trailing reflections that create the echo." },
    { "@type": "HowToStep", name: "Download", text: "Download the cleaned-up file." },
  ],
};

// Same 6 questions and answers as before, word-for-word.
const faqs = [
  {
    question: "Does this fully remove echo?",
    answer:
      "It reduces mild room echo and repeated slap-back echo well, but it doesn't perform full acoustic dereverberation — heavy reverb from a large or empty room won't be fully eliminated.",
  },
  {
    question: "What's the difference between echo, reverb, and slap-back?",
    answer:
      "Slap-back is a single, distinct repeat off a hard surface — common in small tiled or hard-walled rooms. Reverb is the accumulated wash of countless overlapping reflections in a larger space, without a single clear repeat. This tool handles slap-back and mild room echo well; it isn't designed for heavy reverb.",
  },
  {
    question: "Can I remove echo from Zoom or phone recordings?",
    answer:
      "Yes — phone recordings, Zoom calls, and voice memos with mild room echo are exactly the kind of source material this tool handles well.",
  },
  {
    question: "What kind of echo does this work best on?",
    answer:
      "Mild room echo on speech recordings and repeated/slap echo. It's not designed for cleaning heavy reverb from concert halls or large empty spaces.",
  },
  {
    question: "Is this really free?",
    answer: "Yes — completely free, no sign-up, no watermark on the output.",
  },
  {
    question: "What formats are supported?",
    answer: "MP3, WAV, FLAC, M4A, AAC, OGG, and AIFF, up to 80MB and 20 minutes long.",
  },
];

export default function EchoRemovePage() {
  const relatedTools = getRelatedTools("echo-remove", 5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free Echo Remover
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Reduce mild room echo and slap-back in a recording, free, no sign-up, no
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
              <p className="font-semibold text-text-primary">{f.title}</p>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to reduce echo in a recording</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an MP3, WAV, FLAC, M4A, AAC, OGG, or AIFF file.</li>
            <li>The tool gates out the quiet trailing reflections that create the echo.</li>
            <li>Download the cleaned-up result.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Why recordings get echo</h2>
          <p className="text-text-muted leading-relaxed">
            Echo happens when sound reflects off hard surfaces — walls,
            ceilings, glass, tile — before reaching the microphone. Instead
            of picking up only the direct sound, the mic also captures those
            delayed reflections, which is what makes speech sound distant or
            hollow. Rooms with little furniture, carpet, or soft surfaces to
            absorb sound tend to produce the strongest echo, since there&apos;s
            nothing to dampen the reflections bouncing around.
          </p>
          <p className="text-text-muted leading-relaxed">
            Recording closer to the microphone, adding soft furnishings, or
            using acoustic panels all reduce echo before it&apos;s ever
            captured. This tool works on the other end of that problem —
            reducing echo that&apos;s already baked into a recording after
            the fact.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Echo vs. reverb vs. slap-back</h2>
          <p className="text-text-muted leading-relaxed">
            These terms get used interchangeably, but they&apos;re different
            problems. <strong className="text-text-primary">Slap-back echo</strong>{" "}
            is a single, distinct repeat off a hard surface — a tiled bathroom, a
            hallway, an empty room with bare walls. <strong className="text-text-primary">Reverb</strong>{" "}
            is the accumulated wash of countless overlapping reflections in a
            larger space, without one clean repeat to point to — a concert hall or
            an empty gymnasium produces reverb, not slap-back. This tool works by
            gating out quiet trailing reflections, which handles slap-back and
            mild room echo well. Heavy reverb doesn&apos;t offer that same clean
            separation between direct sound and reflection, which is why it&apos;s
            outside what this tool can fully fix.
          </p>
          <p className="text-text-muted leading-relaxed">
            Want the full explanation of why one gates out cleanly and the other
            doesn&apos;t?{" "}
            <Link href="/guides/fixing-echo-in-home-recordings" className="text-amber-400 hover:underline">
              Read How to Fix Echo in Home Recordings
            </Link>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">When to use this</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              Good fits: a phone recording made in a tiled bathroom or hallway, a voice
              memo with a faint repeat, a Zoom call recorded in an untreated room, or an
              interview recorded in a slightly echoey space. This works on audio from
              any source — phone, laptop, camera, Zoom, Discord, Teams, OBS, whatever
              recorded it — as long as it&apos;s a supported file format with mild room
              echo rather than heavy reverb.
            </p>
            <p>
              For speech recordings that also have background noise or inconsistent
              loudness alongside the echo, try the{" "}
              <Link href="/voice-clean" className="text-amber-400 hover:underline">
                Voice Cleaner
              </Link>{" "}
              first — it handles denoising and normalization in the same pass. If
              you want direct control over noise reduction strength instead, the{" "}
              <Link href="/noise-remove" className="text-amber-400 hover:underline">
                Noise Remover
              </Link>{" "}
              is the more adjustable option.
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

        <FAQSection faqs={faqs} />
      </main>
    </>
  );
}