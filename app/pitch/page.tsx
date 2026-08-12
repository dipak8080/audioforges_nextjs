import type { Metadata } from "next";
import Link from "next/link";
import { PitchForm } from "@/components/converter/PitchForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Free Pitch Shifter — Change Key Without Changing Speed",
  description:
    "Change audio pitch or transpose music online for free. Shift MP3, WAV, FLAC, AAC, M4A, OGG, and AIFF up or down by up to 12 semitones without changing tempo.",
  keywords: [
    "pitch shifter online",
    "change pitch of audio free",
    "transpose audio key",
    "pitch shift mp3",
    "key changer audio",
    "raise pitch of song",
    "lower pitch of song",
    "change key of song",
    "audio key changer",
    "transpose vocal",
    "transpose song",
    "change song key",
    "audio transpose",
    "pitch changer online",
    "change vocal pitch",
  ],
  alternates: { canonical: `${SITE_URL}/pitch` },
  openGraph: {
    title: "Free Pitch Shifter — Change Key Without Changing Speed",
    description:
      "Change audio pitch or transpose music online for free. Shift MP3, WAV, FLAC, AAC, M4A, OGG, and AIFF up or down by up to 12 semitones without changing tempo.",
    url: `${SITE_URL}/pitch`,
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
    title: "Free Pitch Shifter — Change Key Without Changing Speed",
    description:
      "Change audio pitch or transpose music online for free. Shift MP3, WAV, FLAC, AAC, M4A, OGG, and AIFF up or down by up to 12 semitones without changing tempo.",
    images: ["/images/og-default.png"],
  },
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Pitch Shifter",
  url: `${SITE_URL}/pitch`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Shift pitch up to 1 octave either direction",
    "Independent of tempo",
    "No sign-up required",
    "No watermark",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Pitch Shifter", item: `${SITE_URL}/pitch` },
  ],
};

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Shift the Pitch of an Audio File",
  step: [
    { "@type": "HowToStep", name: "Upload", text: "Upload an MP3, WAV, FLAC, M4A, AAC, OGG, or AIFF file." },
    { "@type": "HowToStep", name: "Set shift amount", text: "Move the slider to your target semitone shift, up to a full octave either direction." },
    { "@type": "HowToStep", name: "Apply", text: "Click to process the shift." },
    { "@type": "HowToStep", name: "Download", text: "Download the pitch-shifted file, tempo unchanged." },
  ],
};

// Same 7 questions and answers as before, word-for-word.
const faqs = [
  {
    question: "Does pitch shifting change the tempo?",
    answer:
      "No — pitch is shifted independently of tempo, so the duration and speed of the track stay exactly the same, only the pitch moves.",
  },
  {
    question: "How much can I shift the pitch?",
    answer: "Up to 12 semitones in either direction — a full octave up or down.",
  },
  {
    question: "Will shifting pitch affect audio quality?",
    answer:
      "Small shifts of a semitone or two are close to transparent. Larger shifts toward a full octave start to noticeably affect timbre, since formants — the resonances that give a voice or instrument its characteristic tone — shift along with the pitch.",
  },
  {
    question: "What's the difference between pitch and key?",
    answer:
      "Pitch is the raw frequency of a sound; key is the overall tonal center a piece of music is built around. Shifting a track's pitch by a fixed number of semitones effectively transposes it into a new key.",
  },
  {
    question: "Why is there a stricter limit on this tool?",
    answer:
      "Pitch shifting is more CPU-intensive than simple conversions, so it's limited to 3 requests per 5 minutes to keep it available for everyone.",
  },
  {
    question: "Is this really free?",
    answer: "Yes — completely free, no sign-up, no watermark on the output.",
  },
  {
    question: "Can I change the key of a song without changing its speed?",
    answer:
      "Yes. This tool shifts pitch independently of tempo, so you can transpose a song into a different key while keeping its original duration.",
  },
];

export default function PitchPage() {
  const relatedTools = getRelatedTools("pitch", 5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free Pitch Shifter
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Shift a track&apos;s pitch up or down without touching its tempo, free, no
            sign-up, no watermark.
          </p>
        </header>

        <PitchForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "±1 octave", desc: "Shift up to 12 semitones either way." },
            { title: "Tempo unaffected", desc: "Duration and speed stay identical." },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <p className="font-semibold text-text-primary">{f.title}</p>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to shift pitch</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an MP3, WAV, FLAC, M4A, AAC, OGG, or AIFF file.</li>
            <li>Move the slider to your target shift — a semitone or two for subtle retuning, up to a full octave for a dramatic change.</li>
            <li>Apply the shift.</li>
            <li>Download the result — same tempo, new pitch.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Semitones and octaves explained</h2>
          <p className="text-text-muted leading-relaxed">
            Pitch is usually adjusted in semitones. Twelve semitones make one
            octave, so shifting a track by +12 moves every note one octave
            higher, while -12 moves everything one octave lower. Smaller
            adjustments of one or two semitones are commonly used to match a
            singer&apos;s vocal range or transpose a song into a more
            comfortable key.
          </p>
          <p className="text-text-muted leading-relaxed">
            Large pitch shifts are possible, but bigger changes naturally
            sound less realistic because voices and instruments take on
            different tonal characteristics as they move farther from their
            original range.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Pitch Shifter vs. Tempo Changer</h2>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-sm text-left text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">&nbsp;</th>
                  <th className="px-4 py-3 font-semibold">Pitch Shifter</th>
                  <th className="px-4 py-3 font-semibold">Tempo Changer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Changes</td>
                  <td className="px-4 py-3">Musical key / pitch</td>
                  <td className="px-4 py-3">Playback speed</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Stays the same</td>
                  <td className="px-4 py-3">Tempo and duration</td>
                  <td className="px-4 py-3">Pitch and key</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Range</td>
                  <td className="px-4 py-3">±1 octave (12 semitones)</td>
                  <td className="px-4 py-3">50%–200% speed</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-text-muted leading-relaxed">
            Want the deeper explanation of why these are two separate operations,
            and how a time-stretching engine keeps one variable fixed while
            changing the other?{" "}
            <Link href="/guides/pitch-shifting-vs-key-changing" className="text-amber-400 hover:underline">
              Read Pitch Shifting Explained: Semitones &amp; Musical Keys
            </Link>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Who uses a pitch shifter?</h2>
          <p className="text-text-muted leading-relaxed">
            Pitch shifting comes up for singers practicing in a different key,
            musicians transposing a backing track, DJs preparing harmonically
            compatible mixes, producers building vocal effects, and content
            creators nudging background music to better fit a project.
            Because tempo stays fixed, everything stays synchronized — only
            the musical key changes.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common uses</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              Transpose a track into a more comfortable vocal range for practice,
              change the key of a karaoke track to match your own range, test how a
              sample sounds in a different key before dropping it into a session, or
              create a pitched-up or pitched-down variation for a remix — all without
              the tempo shifting along with it, which is what a simple speed change
              would do instead. It&apos;s also useful for DJ mashups where two tracks
              need to sit in the same key, and for instrument practice when you want
              to play along in a different range.
            </p>
            <p>
              Not sure what key your source track is already in? Run it through the{" "}
              <Link href="/key-finder" className="text-amber-400 hover:underline">
                Key &amp; BPM Finder
              </Link>{" "}
              first, then transpose it here to the key you need.
            </p>
            <p>
              Need to trim the audio before transposing it? Use the{" "}
              <Link href="/trim" className="text-amber-400 hover:underline">
                Audio Trimmer
              </Link>{" "}
              first, then apply the pitch shift to only the section you need.
            </p>
            <p>
              Need to change speed without affecting pitch? Use the{" "}
              <Link href="/tempo" className="text-amber-400 hover:underline">
                Tempo Changer
              </Link>{" "}
              instead — it&apos;s the same underlying approach, applied to speed
              rather than key.
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