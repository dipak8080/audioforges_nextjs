import type { Metadata } from "next";
import Link from "next/link";
import { SilenceRemoveForm } from "@/components/converter/SilenceRemoveForm";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Free Silence Remover — Cut Dead Air From Any Recording",
  description:
    "Strip silent gaps from a podcast, audiobook, or recording online free. Removes dead air throughout, not just the ends. No sign-up, download in seconds.",
  keywords: [
    "silence remover online",
    "remove dead air podcast",
    "cut silence from audio free",
    "strip silence mp3",
    "podcast silence cutter",
    "remove silence from audio",
    "cut dead air",
    "audio silence detector",
    "remove pauses from recording",
    "silence remover vs trimmer",
  ],
  alternates: { canonical: `${SITE_URL}/silence-remove` },
  openGraph: {
    title: "Free Silence Remover — Cut Dead Air From Any Recording",
    description: "Strip silent gaps from a recording free, no sign-up.",
    url: `${SITE_URL}/silence-remove`,
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
    title: "Free Silence Remover — Cut Dead Air From Any Recording",
    description: "Strip silent gaps from a recording free, no sign-up.",
    images: ["/images/og-default.png"],
  },
};
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Does this only trim silence from the start and end?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No — it strips silent gaps throughout the entire recording, not just the leading and trailing edges. Good for cutting dead air between spoken sections in a podcast.",
      },
    },
    {
      "@type": "Question",
      name: "What do threshold and minimum gap length control?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Threshold sets how quiet something has to be to count as silence. Minimum gap length sets how long that quiet stretch has to last before it's actually cut. Both have sensible defaults for most podcast and voice-memo cleanup.",
      },
    },
    {
      "@type": "Question",
      name: "Will the output be shorter than the original?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — gaps are cut entirely, not just muted, so the output duration will be shorter than the input.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need to adjust the settings?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No — both the threshold and minimum gap length have sensible defaults that work well for most podcast and voice-memo cleanup.",
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
      name: "Does removing silence affect audio quality?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No — only the silent sections themselves are cut out. The remaining audio keeps its original quality and format.",
      },
    },
  ],
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Silence Remover",
  url: `${SITE_URL}/silence-remove`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Cuts silent gaps throughout, not just leading/trailing",
    "Adjustable threshold and gap length",
    "No sign-up required",
    "No watermark",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Silence Remover", item: `${SITE_URL}/silence-remove` },
  ],
};

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Cut Dead Air from a Recording",
  step: [
    { "@type": "HowToStep", name: "Upload", text: "Upload an MP3, WAV, FLAC, M4A, AAC, OGG, or AIFF file." },
    { "@type": "HowToStep", name: "Set threshold", text: "Leave the silence threshold at its default, or adjust it manually." },
    { "@type": "HowToStep", name: "Set minimum gap", text: "Leave minimum gap length at its default, or shorten/lengthen it for tighter or looser cutting." },
    { "@type": "HowToStep", name: "Download", text: "Download the trimmed result — shorter than the original, with dead air removed throughout." },
  ],
};

export default function SilenceRemovePage() {
  const relatedTools = getRelatedTools("silence-remove", 5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free Silence Remover
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Cut dead air throughout a recording — not just the start and end — free,
            no sign-up, no watermark.
          </p>
        </header>

        <SilenceRemoveForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "Whole-file cleanup", desc: "Cuts gaps everywhere, not just the ends." },
            { title: "One-click ready", desc: "Sensible defaults, no tuning required." },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <h3 className="font-semibold text-text-primary">{f.title}</h3>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to cut dead air from a recording</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an MP3, WAV, FLAC, M4A, AAC, OGG, or AIFF file.</li>
            <li>Leave threshold and minimum gap length at their defaults, or adjust them.</li>
            <li>Download the result — shorter than the original, with dead air cut throughout.</li>
          </ol>
          <div className="flex flex-wrap gap-2 pt-1">
            {["MP3", "WAV", "FLAC", "AAC", "M4A", "OGG", "AIFF"].map((fmt) => (
              <span
                key={fmt}
                className="inline-flex items-center gap-1 rounded-full border border-graphite-800 bg-graphite-900 px-3 py-1 text-xs text-text-muted"
              >
                <span className="text-teal-400">✓</span>
                {fmt}
              </span>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How silence detection works</h2>
          <p className="text-text-muted leading-relaxed">
            The tool scans the recording for stretches that fall below your
            chosen loudness threshold. Once a quiet stretch lasts longer than
            the minimum gap length you&apos;ve set, it&apos;s cut out
            entirely and the audio on either side is joined back together.
            Anything quieter than the threshold but shorter than the minimum
            gap — a brief pause between words, for instance — is left alone,
            since it doesn&apos;t meet both conditions at once.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Silence Remover vs. Audio Trimmer</h2>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-sm text-left text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">&nbsp;</th>
                  <th className="px-4 py-3 font-semibold">Silence Remover</th>
                  <th className="px-4 py-3 font-semibold">Audio Trimmer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Cuts</td>
                  <td className="px-4 py-3">All silent gaps automatically</td>
                  <td className="px-4 py-3">One section you select manually</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Best for</td>
                  <td className="px-4 py-3">Podcasts and voice recordings with scattered dead air</td>
                  <td className="px-4 py-3">Extracting a specific clip</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Manual editing needed</td>
                  <td className="px-4 py-3">No — automatic</td>
                  <td className="px-4 py-3">Yes — you pick start/end</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-text-muted leading-relaxed">
            Need to keep just one section instead of cutting scattered gaps
            throughout? The{" "}
            <Link href="/trim" className="text-amber-400 hover:underline">
              Audio Trimmer
            </Link>{" "}
            is the better fit for that.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Adjusting the settings</h2>
          <p className="text-text-muted leading-relaxed">
            The defaults (-30dB threshold, 0.5 second minimum gap) work well
            for most podcast and voice-memo cleanup without any adjustment.
            If you do want to tune it: lowering the threshold toward -50dB or
            beyond makes the tool more sensitive, catching quieter background
            noise as silence too — useful for a very clean studio recording.
            Raising it toward -10dB makes it stricter, only cutting
            near-total silence. Shortening the minimum gap cuts brief pauses
            as well as long ones; lengthening it leaves shorter pauses intact
            and only removes genuinely long dead air. There&apos;s no single
            &quot;correct&quot; setting for a given content type — it depends
            on how quiet your room tone is and how tightly you want the
            result edited, so it&apos;s worth previewing the result and
            adjusting from there rather than assuming one preset fits
            everything.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common uses</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              Perfect for podcast editing — cutting the dead air between sentences or
              during long pauses without manually scrubbing through the whole
              recording. It&apos;s also useful for audiobook and lecture recordings
              with long quiet stretches between sections, voice memos with awkward
              gaps, meeting recordings you want to tighten up before sharing, field
              recordings with dead air you don&apos;t need, online course
              recordings, YouTube narration, and voice-over editing.
            </p>
            <p>
              Getting the recording transcribed afterward? Cutting dead air first
              means less audio for the{" "}
              <Link href="/speech-to-text" className="text-amber-400 hover:underline">
                Speech to Text
              </Link>{" "}
              tool to process. If background noise (not just silence) is the
              problem, the{" "}
              <Link href="/noise-remove" className="text-amber-400 hover:underline">
                Noise Remover
              </Link>{" "}
              or, for speech specifically, the{" "}
              <Link href="/voice-clean" className="text-amber-400 hover:underline">
                Voice Cleaner
              </Link>{" "}
              handle that instead.
            </p>
            <p>
              Want the full breakdown of how these two settings interact, and why
              cutting too aggressively can clip natural pauses?{" "}
              <Link href="/guides/editing-out-dead-air-podcasts" className="text-amber-400 hover:underline">
                Read Cutting Dead Air from Podcasts &amp; Recordings
              </Link>.
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
              <h3 className="font-semibold text-text-primary mb-1">Does this only trim silence from the start and end?</h3>
              <p>No — it strips silent gaps throughout the entire recording, not just the leading and trailing edges.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">What do threshold and minimum gap length control?</h3>
              <p>
                Threshold sets how quiet something has to be to count as silence.
                Minimum gap length sets how long that quiet stretch has to last
                before it&apos;s actually cut. Both have sensible defaults for most
                podcast and voice-memo cleanup.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Will the output be shorter than the original?</h3>
              <p>Yes — gaps are cut entirely, not just muted, so the output duration will be shorter than the input.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Do I need to adjust the settings?</h3>
              <p>No — both the threshold and minimum gap length have sensible defaults that work well for most podcast and voice-memo cleanup.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Is this really free?</h3>
              <p>Yes — completely free, no sign-up, no watermark on the output.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Does removing silence affect audio quality?</h3>
              <p>No — only the silent sections themselves are cut out. The remaining audio keeps its original quality and format.</p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}