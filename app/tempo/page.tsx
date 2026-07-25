import type { Metadata } from "next";
import Link from "next/link";
import { TempoForm } from "@/components/converter/TempoForm";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Free Audio Speed Changer | Tempo Changer",
  description:
    "Speed up or slow down audio free, no sign-up — from 50% to 200% speed, pitch stays the same. Works on MP3, WAV, FLAC, and more.",
  keywords: [
    "audio speed changer",
    "change tempo without pitch",
    "slow down audio online free",
    "speed up mp3 free",
    "tempo changer",
    "speed up podcast",
    "slow down music for practice",
    "change playback speed audio",
    "0.5x speed audio",
    "2x speed audio",
    "time stretching audio",
    "tempo vs bpm",
  ],
  alternates: { canonical: `${SITE_URL}/tempo` },
  openGraph: {
    title: "Free Audio Speed Changer – Change Tempo Without Changing Pitch",
    description: "Speed up or slow down audio free, no sign-up. Pitch stays the same.",
    url: `${SITE_URL}/tempo`,
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
    title: "Free Audio Speed Changer – Change Tempo Without Changing Pitch",
    description: "Speed up or slow down audio free, no sign-up. Pitch stays the same.",
    images: ["/images/og-default.png"],
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Does changing speed affect the pitch?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No — tempo is changed independently of pitch, so the key stays the same, only speed and duration change.",
      },
    },
    {
      "@type": "Question",
      name: "Does changing tempo reduce audio quality?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Small changes near the original speed are close to transparent. Pushing further toward half or double speed can introduce artifacts — transients like drum hits or plucks may sound slightly smeared, since the engine is reconstructing more of the waveform to hit the new duration.",
      },
    },
    {
      "@type": "Question",
      name: "What's the difference between tempo and playback speed?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "They're the same thing in this context — how fast the audio plays back. A simple playback-speed change also shifts pitch; this tool changes speed while keeping pitch fixed.",
      },
    },
    {
      "@type": "Question",
      name: "What speed range is available?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "From 50% (half speed) to 200% (double speed).",
      },
    },
    {
      "@type": "Question",
      name: "Will the output file be a different length?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — speeding up to 200% halves the duration, slowing to 50% doubles it. That's expected, not an error.",
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
      name: "Does changing speed also change the BPM?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, effectively — since this changes an already-recorded audio file rather than a MIDI tempo track, speeding it up compresses the time between beats, which raises its audible BPM proportionally. A 120 BPM track played at 200% speed sounds like roughly 240 BPM.",
      },
    },
    {
      "@type": "Question",
      name: "Does it work on mobile?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — it works in any mobile browser on iPhone or Android, no app install required.",
      },
    },
    {
      "@type": "Question",
      name: "Can I restore the original speed later?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "There's no saved history — this is a stateless upload-process-download tool. Re-upload the original file if you need a different speed afterward.",
      },
    },
    {
      "@type": "Question",
      name: "Does this affect stereo audio?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No — time-stretching processes the channels without changing the stereo layout. Stereo files stay stereo.",
      },
    },
  ],
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Audio Speed Changer",
  url: `${SITE_URL}/tempo`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Change speed from 50% to 200%",
    "Independent of pitch",
    "No sign-up required",
    "No watermark",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Speed Changer", item: `${SITE_URL}/tempo` },
  ],
};

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Change Audio Speed Without Changing Pitch",
  step: [
    { "@type": "HowToStep", name: "Upload", text: "Upload an MP3, WAV, FLAC, M4A, AAC, OGG, or AIFF file." },
    { "@type": "HowToStep", name: "Set speed", text: "Move the slider anywhere from 50% to 200% speed." },
    { "@type": "HowToStep", name: "Apply", text: "Process the change." },
    { "@type": "HowToStep", name: "Download", text: "Download the result — same pitch, new speed and duration." },
  ],
};

export default function TempoPage() {
  const relatedTools = getRelatedTools("tempo", 5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free Audio Speed Changer
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Speed up or slow down a track without changing its pitch — free, no
            sign-up, no watermark.
          </p>
        </header>

        <TempoForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "50%–200%", desc: "Half speed to double speed." },
            { title: "Pitch unaffected", desc: "Key stays the same, only speed changes." },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <h3 className="font-semibold text-text-primary">{f.title}</h3>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How it works</h2>
          <p className="text-text-muted leading-relaxed">
            Simply playing a file faster or slower changes its pitch along
            with its speed — that&apos;s how a turntable or tape sounds
            higher-pitched when sped up. This tool uses{" "}
            <strong className="text-text-primary">Rubberband</strong>, a
            time-stretching engine that analyzes the waveform and
            reconstructs it at the new duration while holding pitch steady,
            rather than just playing the same data back faster or slower.
            That&apos;s what makes it possible to change speed and pitch
            completely independently of each other.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to change audio speed</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an MP3, WAV, FLAC, M4A, AAC, OGG, or AIFF file.</li>
            <li>Move the slider anywhere from 50% (half speed) to 200% (double speed).</li>
            <li>Apply the change.</li>
            <li>Download the result — pitch unchanged, speed and duration adjusted.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Tempo Changer vs. Pitch Shifter</h2>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-sm text-left text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">&nbsp;</th>
                  <th className="px-4 py-3 font-semibold">Tempo Changer</th>
                  <th className="px-4 py-3 font-semibold">Pitch Shifter</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Changes</td>
                  <td className="px-4 py-3">Playback speed</td>
                  <td className="px-4 py-3">Musical key / pitch</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Stays the same</td>
                  <td className="px-4 py-3">Pitch and key</td>
                  <td className="px-4 py-3">Tempo and duration</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Range</td>
                  <td className="px-4 py-3">50%–200% speed</td>
                  <td className="px-4 py-3">±1 octave (12 semitones)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-text-muted leading-relaxed">
            One nuance worth knowing if you work in a DAW: in a MIDI or
            multi-track project, &quot;tempo&quot; (the BPM setting) and
            &quot;playback speed&quot; of an audio file are genuinely
            different things — changing a project&apos;s tempo doesn&apos;t
            necessarily change an audio clip&apos;s speed unless it&apos;s
            warped to follow. But for an already-rendered audio file like
            what this tool processes, speeding it up does proportionally
            raise its audible BPM, so &quot;tempo&quot; and
            &quot;speed&quot; end up meaning the same practical thing here.
          </p>
          <p className="text-text-muted leading-relaxed">
            Want the deeper explanation of why tempo and pitch are usually linked,
            and how much you can push a tempo change before it starts sounding
            artificial?{" "}
            <Link href="/guides/dj-tempo-matching-without-pitch-shift" className="text-amber-400 hover:underline">
              Read How to Match Tempo Without Changing Pitch
            </Link>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Why extreme speed changes sound different</h2>
          <p className="text-text-muted leading-relaxed">
            Moderate speed changes — within roughly 10–20% of the original —
            tend to sound close to transparent, since the engine only has to
            reconstruct a small amount of extra or missing waveform data.
            Pushing further toward the 50% or 200% ends of the range means
            reconstructing much more of the signal, and that&apos;s where
            artifacts start showing up: sharp transients like drum hits or
            plucked strings can smear slightly, since a single instant in the
            original has to be stretched or compressed across a different
            span of time. It&apos;s not a flaw so much as the inherent
            tradeoff of asking a time-stretching algorithm to do more work —
            staying closer to 100% keeps results cleaner, and pushing toward
            the extremes trades some fidelity for the bigger change.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common uses</h2>
          <ul className="list-disc list-inside space-y-1.5 text-text-muted leading-relaxed">
            <li>Slowing a track down to learn a fast guitar solo, drum pattern, or piano passage note-by-note</li>
            <li>Speeding up a lecture, audiobook, or podcast to save time</li>
            <li>Nudging a track's tempo to match another for a DJ mashup or beatmatch, without shifting the key</li>
            <li>Slowing down choreography or dance reference audio for practice</li>
            <li>Slowing speech down for language-learning or transcription accuracy</li>
            <li>Speeding through recorded meetings or interviews to skim faster</li>
          </ul>
          <p className="text-text-muted leading-relaxed">
            Want to know the key before you start matching tempos? Run the track
            through the{" "}
            <Link href="/key-finder" className="text-amber-400 hover:underline">
              Key &amp; BPM Finder
            </Link>{" "}
            first.
          </p>
          <p className="text-text-muted leading-relaxed">
            Need to change key without affecting speed? Use the{" "}
            <Link href="/pitch" className="text-amber-400 hover:underline">
              Pitch Shifter
            </Link>{" "}
            instead — same engine, applied to pitch rather than speed.
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
              <h3 className="font-semibold text-text-primary mb-1">Does changing speed affect the pitch?</h3>
              <p>No — tempo is changed independently of pitch, so the key stays the same, only speed and duration change.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Does changing tempo reduce audio quality?</h3>
              <p>
                Small changes near the original speed are close to transparent.
                Pushing further toward half or double speed can introduce
                artifacts — transients like drum hits or plucks may sound slightly
                smeared, since the engine is reconstructing more of the waveform
                to hit the new duration.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">What&apos;s the difference between tempo and playback speed?</h3>
              <p>
                They&apos;re the same thing in this context — how fast the audio
                plays back. A simple playback-speed change also shifts pitch; this
                tool changes speed while keeping pitch fixed.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">What speed range is available?</h3>
              <p>From 50% (half speed) to 200% (double speed).</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Will the output file be a different length?</h3>
              <p>Yes — speeding up to 200% halves the duration, slowing to 50% doubles it. That&apos;s expected, not an error.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Is this really free?</h3>
              <p>Yes — completely free, no sign-up, no watermark on the output.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Does changing speed also change the BPM?</h3>
              <p>
                Yes, effectively — since this changes an already-recorded audio
                file rather than a MIDI tempo track, speeding it up compresses the
                time between beats, which raises its audible BPM proportionally.
                A 120 BPM track played at 200% speed sounds like roughly 240 BPM.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Does it work on mobile?</h3>
              <p>Yes — it works in any mobile browser on iPhone or Android, no app install required.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Can I restore the original speed later?</h3>
              <p>
                There&apos;s no saved history — this is a stateless upload-process-download
                tool. Re-upload the original file if you need a different speed afterward.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Does this affect stereo audio?</h3>
              <p>No — time-stretching processes the channels without changing the stereo layout. Stereo files stay stereo.</p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}