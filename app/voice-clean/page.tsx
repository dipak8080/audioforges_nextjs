import type { Metadata } from "next";
import Link from "next/link";
import { VoiceCleanForm } from "@/components/converter/VoiceCleanForm";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Free Voice Cleaner — Clean Up Podcasts & Voice Memos",
  description:
    "Clean voice recordings online free. Remove background noise, hiss, hum, and low-frequency rumble from podcasts, interviews, and voice memos. No sign-up.",
  keywords: [
    "voice cleaner",
    "clean voice recording",
    "clean podcast audio",
    "remove background noise from voice",
    "voice memo cleanup",
    "podcast audio cleanup free",
    "speech enhancement online",
    "voice enhancer",
    "podcast audio cleaner",
    "voice recording cleaner",
    "improve voice recording",
  ],
  alternates: { canonical: `${SITE_URL}/voice-clean` },
  openGraph: {
    title: "Free Voice Cleaner — Clean Up Podcasts & Voice Memos",
    description: "Clean up speech recordings free, no sign-up. One click, done.",
    url: `${SITE_URL}/voice-clean`,
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
    title: "Free Voice Cleaner — Clean Up Podcasts & Voice Memos",
    description: "Clean up speech recordings free, no sign-up. One click, done.",
    images: ["/images/og-default.png"],
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What does the Voice Cleaner actually do?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "It runs a three-stage chain tuned specifically for speech: cutting low-frequency rumble, applying speech-optimized noise reduction, then normalizing loudness — all in one click.",
      },
    },
    {
      "@type": "Question",
      name: "Does it work on Zoom recordings or phone recordings?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — any speech-only recording works, including calls, Zoom recordings, phone memos, and narration, since the chain is tuned for the voice frequency range generally, not one specific recording method.",
      },
    },
    {
      "@type": "Question",
      name: "Does this remove echo or reverb?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No — echo and reverb are a different problem from noise, and this chain doesn't address them. Use the Echo Reducer for mild room echo or slap-back.",
      },
    },
    {
      "@type": "Question",
      name: "Is this different from a general noise remover?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. This preset is tuned specifically for speech and has no settings to configure. For music or non-speech audio where you want to control the reduction strength yourself, use the Noise Remover instead.",
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
  name: "Voice Cleaner",
  url: `${SITE_URL}/voice-clean`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Rumble/low-end cut",
    "Speech-tuned denoise",
    "Loudness normalization",
    "No sign-up required",
    "No watermark",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Voice Cleaner", item: `${SITE_URL}/voice-clean` },
  ],
};

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Clean Up a Voice Recording",
  step: [
    { "@type": "HowToStep", name: "Upload", text: "Upload an MP3, WAV, FLAC, M4A, AAC, OGG, or AIFF speech recording." },
    { "@type": "HowToStep", name: "Process", text: "The tool automatically cuts rumble, reduces noise, and normalizes loudness — no settings to configure." },
    { "@type": "HowToStep", name: "Download", text: "Download the cleaned recording." },
  ],
};

export default function VoiceCleanPage() {
  const relatedTools = getRelatedTools("voice-clean", 5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free Voice Cleaner
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            One click to clean up a podcast, interview, or voice memo — rumble cut,
            speech-tuned denoise, and loudness normalization, all in one pass.
          </p>
        </header>

        <VoiceCleanForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "One click", desc: "No settings to tune — just upload and clean." },
            { title: "Speech-tuned", desc: "Built specifically for voice, not music." },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <h3 className="font-semibold text-text-primary">{f.title}</h3>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to clean up a voice recording</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an MP3, WAV, FLAC, M4A, AAC, OGG, or AIFF speech recording.</li>
            <li>The chain runs automatically — rumble cut, denoise, then normalize.</li>
            <li>Download the cleaned result.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What it fixes</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              Most rough voice recordings share the same problems: low-frequency
              rumble from handling noise or AC hum, a hiss or hum sitting under the
              voice, and inconsistent loudness between takes. This tool runs a fixed
              chain built to fix exactly those issues — cut the rumble, denoise the
              rest, then normalize levels — with nothing to configure.
            </p>
            <p>
              <strong className="text-text-primary">Best for:</strong> podcasts, phone
              recordings, interviews, Zoom recordings, voice memos, narration, and any
              speech-only audio. For music or general noise reduction with adjustable
              strength, use the{" "}
              <Link href="/noise-remove" className="text-amber-400 hover:underline">
                Noise Remover
              </Link>{" "}
              instead.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What this doesn&apos;t fix</h2>
          <p className="text-text-muted leading-relaxed">
            This chain targets rumble, hiss/hum, and loudness — it doesn&apos;t
            address echo or reverb, since that&apos;s a different kind of problem
            entirely (repeated or trailing reflections, rather than steady
            background noise). It also can&apos;t recover audio that&apos;s
            severely clipped or distorted at the source — cleanup can improve a
            noisy recording, but it can&apos;t reconstruct data that was never
            captured. If echo is the issue, the{" "}
            <Link href="/echo-remove" className="text-amber-400 hover:underline">
              Echo Reducer
            </Link>{" "}
            handles mild room echo and slap-back separately.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Voice Cleaner vs. Noise Remover</h2>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-sm text-left text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">&nbsp;</th>
                  <th className="px-4 py-3 font-semibold">Voice Cleaner</th>
                  <th className="px-4 py-3 font-semibold">Noise Remover</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Best for</td>
                  <td className="px-4 py-3">Speech only</td>
                  <td className="px-4 py-3">Any audio — music, field recordings, speech</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Control</td>
                  <td className="px-4 py-3">One click, fixed chain</td>
                  <td className="px-4 py-3">Adjustable reduction strength</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">What it does</td>
                  <td className="px-4 py-3">Rumble cut + denoise + normalize</td>
                  <td className="px-4 py-3">Denoise only</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Typical use case</td>
                  <td className="px-4 py-3">Podcasts, interviews, voice memos</td>
                  <td className="px-4 py-3">Music demos, field recordings, mixed content</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-text-muted leading-relaxed">
            Want the full breakdown of why cleanup order matters and what each stage
            actually does?{" "}
            <Link href="/guides/podcast-audio-cleanup-checklist" className="text-amber-400 hover:underline">
              Read Podcast Audio Cleanup: A Practical Checklist
            </Link>.
          </p>
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
              <h3 className="font-semibold text-text-primary mb-1">What does the Voice Cleaner actually do?</h3>
              <p>
                It runs a three-stage chain tuned specifically for speech: cutting
                low-frequency rumble, applying speech-optimized noise reduction, then
                normalizing loudness — all in one click.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Does it work on Zoom recordings or phone recordings?</h3>
              <p>
                Yes — any speech-only recording works, including calls, Zoom
                recordings, phone memos, and narration, since the chain is tuned for
                the voice frequency range generally, not one specific recording
                method.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Does this remove echo or reverb?</h3>
              <p>
                No — echo and reverb are a different problem from noise, and this
                chain doesn&apos;t address them. Use the{" "}
                <Link href="/echo-remove" className="text-amber-400 hover:underline">
                  Echo Reducer
                </Link>{" "}
                for mild room echo or slap-back.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Is this different from a general noise remover?</h3>
              <p>
                Yes. This preset is tuned specifically for speech and has no settings
                to configure. For music or non-speech audio where you want to control
                the reduction strength yourself, use the Noise Remover instead.
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