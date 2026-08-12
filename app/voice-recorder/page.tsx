import type { Metadata } from "next";
import Link from "next/link";
import { VoiceRecorderForm } from "@/components/browser/VoiceRecorderForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

const PAGE_TITLE = "Free Online Voice Recorder — No Upload, No Sign-Up";
const PAGE_DESCRIPTION =
  "Record audio from your microphone directly in your browser, free. Nothing is ever uploaded — your recording stays on your device. No sign-up.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/voice-recorder` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/voice-recorder`,
    siteName: SITE_NAME,
    type: "website",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630, alt: "AudioForges" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/images/og-default.png"],
  },
};

// WebApplication schema — every claim below matches the visible page copy.
// No pause/resume, waveform, mic selection, or mobile-compatibility claims,
// since none of those are confirmed against the actual VoiceRecorderForm.
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Online Voice Recorder",
  url: `${SITE_URL}/voice-recorder`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Records directly from your microphone",
    "Nothing is ever uploaded — runs entirely in your browser",
    "Instant playback and download",
    "No sign-up required",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Online Voice Recorder", item: `${SITE_URL}/voice-recorder` },
  ],
};

const faqs = [
  {
    question: "Is my recording uploaded anywhere?",
    answer:
      "No. Recording, playback, and download all happen directly in your browser using your device's own microphone and audio APIs — the audio data never leaves your computer or phone.",
  },
  {
    question: "What file format do I get?",
    answer:
      "Whichever format your browser's recording API supports natively — typically WebM (Chrome, Firefox, Edge) or M4A (Safari), with OGG as a fallback on some browsers. If you need a specific format like MP3 or WAV, convert the downloaded file afterward.",
  },
  {
    question: "Do I need to install anything?",
    answer: "No — it works in any modern browser that supports microphone access, with no app or extension required.",
  },
  {
    question: "Why is my microphone not working?",
    answer:
      "Your browser needs permission to access the microphone — check your browser's site settings if you accidentally denied access, and make sure no other app is currently using the microphone exclusively.",
  },
  {
    question: "Is there a recording length limit?",
    answer: "No hard limit — you can record for as long as you like, limited only by your device's available memory.",
  },
  {
    question: "Can I convert my recording to MP3 afterward?",
    answer:
      "Yes — download the recording, then upload it to the Audio Converter to export it as MP3, WAV, or another format.",
    answerNode: (
      <>
        Yes — download the recording, then upload it to the{" "}
        <Link href="/convert" className="text-amber-400 hover:underline">
          Audio Converter
        </Link>{" "}
        to export it as MP3, WAV, or another format.
      </>
    ),
  },
  {
    question: "Is this really free?",
    answer: "Yes — completely free, no sign-up, no watermark, no limits.",
  },
];

export default function VoiceRecorderPage() {
  const relatedTools = getRelatedTools("voice-recorder", 5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free Online Voice Recorder
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Record audio from your microphone right in your browser, free,
            no sign-up, and nothing is ever uploaded.
          </p>
        </header>

        {/* Tool stays first — SEO content supports it, doesn't bury it */}
        <VoiceRecorderForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "Nothing uploaded", desc: "Recording and playback happen entirely on your device." },
            { title: "Instant download", desc: "Record, stop, and download — no processing wait." },
            { title: "No sign-up", desc: "No account, no email, no watermark, no limits." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <p className="font-semibold text-text-primary">{f.title}</p>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to record audio online</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Tap the microphone button and allow microphone access when prompted.</li>
            <li>Speak or play — recording starts immediately.</li>
            <li>Tap stop, then play back or download your recording.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What is an online voice recorder?</h2>
          <p className="text-text-muted leading-relaxed">
            An online voice recorder lets you capture audio from your
            microphone directly through a web browser, with no desktop
            software, app, or install required. You open the page, grant
            microphone access, and start recording — the same basic job a
            standalone recording app does, but running entirely inside the
            browser tab you already have open.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Why nothing gets uploaded</h2>
          <p className="text-text-muted leading-relaxed">
            Unlike every other tool on this site, recording doesn&apos;t
            need any server-side processing — your browser can capture,
            encode, and play back audio entirely on its own using built-in
            microphone and recording APIs. That means this tool works
            without an internet connection after the page loads, and your
            voice never travels anywhere beyond your own device.
          </p>
          <p className="text-text-muted leading-relaxed">
            Want the fuller breakdown of how browser-based recording
            actually works under the hood, and why the output format
            depends on which browser you're using?{" "}
            <Link href="/guides/why-your-browser-can-record-without-uploading" className="text-amber-400 hover:underline">
              Read Why Your Browser Can Record Audio Without Uploading It
            </Link>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Recording formats</h2>
          <p className="text-text-muted leading-relaxed">
            The output format depends on which browser you&apos;re using —
            typically WebM in Chrome, Firefox, and Edge, or M4A in Safari,
            with OGG available as a fallback on some browsers. This comes
            from each browser&apos;s own built-in recording capability rather
            than a setting on this page. If you need a specific format like
            MP3 or WAV, the{" "}
            <Link href="/convert" className="text-amber-400 hover:underline">
              Audio Converter
            </Link>{" "}
            handles that as a separate step once your recording is
            downloaded.
          </p>
          <p className="text-text-muted leading-relaxed">
            While recording, a live level meter shows your microphone input
            reacting in real time — that&apos;s feedback that your mic is
            actually picking up sound, not a waveform of the saved file
            itself. The recorder works in any recent version of Chrome,
            Firefox, Safari, or Edge.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Fixing microphone permission problems</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>When your browser prompts for microphone access, select Allow.</li>
            <li>If you previously denied access, open your browser&apos;s site settings for this page and change the microphone permission.</li>
            <li>Reload the page after changing the permission.</li>
            <li>Check whether another application currently has exclusive control of your microphone, which can block browser access.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common uses</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              <strong className="text-text-primary">Voice memos:</strong>{" "}
              quickly capture a thought, reminder, or idea before it&apos;s
              gone.
            </p>
            <p>
              <strong className="text-text-primary">Voice-over &amp; narration:</strong>{" "}
              record narration for a video, presentation, or tutorial.
            </p>
            <p>
              <strong className="text-text-primary">Music &amp; singing ideas:</strong>{" "}
              capture a melody, vocal practice take, or songwriting idea on
              the spot.
            </p>
            <p>
              <strong className="text-text-primary">Podcast drafts:</strong>{" "}
              record a rough segment before editing it properly afterward.
            </p>
            <p>
              <strong className="text-text-primary">Microphone testing:</strong>{" "}
              check that your mic is actually working before a call,
              livestream, or recording session.
            </p>
          </div>
          <p className="text-text-muted leading-relaxed">
            Need to clean up background noise afterward? Run the download
            through the{" "}
            <Link href="/noise-remove" className="text-amber-400 hover:underline">
              Noise Remover
            </Link>{" "}
            or{" "}
            <Link href="/voice-clean" className="text-amber-400 hover:underline">
              Voice Cleaner
            </Link>
            .
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

        <FAQSection faqs={faqs} />
      </main>
    </>
  );
}