import type { Metadata } from "next";
import Link from "next/link";
import { YouTubeAnalyzeForm } from "@/components/converter/YouTubeAnalyzeForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

const PAGE_TITLE = "Free YouTube Key & BPM Finder";
const PAGE_DESCRIPTION =
  "Paste a YouTube link and automatically get its musical key, BPM, and Camelot notation, free. No download, no sign-up required.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/youtube-key-finder` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/youtube-key-finder`,
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

// WebApplication schema — every claim below is checked against config.py's
// confirmed values (rate limit, analysis window). No accuracy guarantees
// and no "instant" claims, since analysis genuinely takes 20-60 seconds.
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "YouTube Key & BPM Finder",
  url: `${SITE_URL}/youtube-key-finder`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Detects musical key and BPM directly from a YouTube link",
    "No manual download step",
    "Camelot notation for harmonic mixing",
    "No sign-up required",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "YouTube Key & BPM Finder", item: `${SITE_URL}/youtube-key-finder` },
  ],
};
// NOTE: No HowTo schema — deprecated by Google (desktop since Sept 2023),
// no ranking or rich-result benefit remains. Visible how-to steps stay.

const faqs = [
  {
    question: "How is this different from the regular Key & BPM Finder?",
    answer:
      "The regular Key & BPM Finder needs a file already on your device. This version accepts a YouTube link directly, fetching the audio and running it through the same underlying analysis without you needing to download it first.",
  },
  {
    question: "How long does this take?",
    answer:
      "Usually 20 to 60 seconds — it needs to fetch the audio from YouTube before analysis can even start, so it's slower than analyzing a file you've already uploaded.",
  },
  {
    question: "Does this work with Shorts?",
    answer: "Yes — standard videos, youtu.be links, and Shorts are all supported.",
  },
  {
    question: "Is there a video length limit?",
    answer: "Yes, videos longer than 15 minutes aren't supported for this tool.",
  },
  {
    question: "What if the video is private, age-restricted, or region-locked?",
    answer:
      "Videos in any of those states may not be accessible to the downloader and can't be analyzed as a result.",
  },
  {
    question: "How accurate is the detected key and BPM?",
    answer:
      "The same detection method used by the file-based Key & BPM Finder runs here. It works well on most conventional tracks, but automated key and tempo detection can be less certain on songs with ambiguous tonality, live performances, complex arrangements, heavy effects, or tempo changes mid-track.",
  },
  {
    question: "Is this really free?",
    answer:
      "Yes, free to use — usage is limited to a couple of requests every 10 minutes per person, since this chains a YouTube fetch together with analysis.",
  },
  {
    question: "Can I remove the vocals from the same video too?",
    answer:
      "Yes — the YouTube Vocal Remover works the same way, straight from a link.",
    answerNode: (
      <>
        Yes — the{" "}
        <Link href="/youtube-vocal-remover" className="text-amber-400 hover:underline">
          YouTube Vocal Remover
        </Link>{" "}
        works the same way, straight from a link.
      </>
    ),
  },
];

export default function YouTubeKeyFinderPage() {
  const relatedTools = getRelatedTools("youtube-key-finder", 5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free YouTube Key &amp; BPM Finder
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Paste a YouTube link and get its key, BPM, and Camelot notation
            automatically, no download step, free, no sign-up.
          </p>
        </header>

        {/* Tool stays first — SEO content supports it, doesn't bury it */}
        <YouTubeAnalyzeForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "No download step", desc: "Paste a link, skip the manual save-and-reupload." },
            { title: "Same detection engine", desc: "Runs the same analysis as the file-based tool." },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <p className="font-semibold text-text-primary">{f.title}</p>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to find a YouTube video&apos;s key and BPM</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Paste a YouTube video, Shorts, or youtu.be link.</li>
            <li>The audio is fetched and analyzed automatically — no settings to configure.</li>
            <li>View the detected key, BPM, and Camelot code.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What the key, BPM, and Camelot code mean</h2>
          <p className="text-text-muted leading-relaxed">
            <strong className="text-text-primary">Key</strong> is the track&apos;s
            tonal center — something like A minor or C major.{" "}
            <strong className="text-text-primary">BPM</strong> (beats per
            minute) is its tempo. <strong className="text-text-primary">
              Camelot notation
            </strong>{" "}
            translates that musical key into the letter-and-number code DJs
            use to quickly judge which tracks will mix harmonically with each
            other.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Why paste a link instead of downloading first</h2>
          <p className="text-text-muted leading-relaxed">
            The regular{" "}
            <Link href="/key-finder" className="text-amber-400 hover:underline">
              Key &amp; BPM Finder
            </Link>{" "}
            works from a file already saved on your device, which usually
            means downloading the audio first with a separate tool and
            re-uploading it. This version chains that fetch step together
            with the analysis itself, so a YouTube link is all you need.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How accurate is the result?</h2>
          <p className="text-text-muted leading-relaxed">
            Automated key and BPM detection works well on most conventional
            tracks, but it isn&apos;t infallible. Songs with ambiguous
            tonality, live performances, complex or layered arrangements,
            heavy effects processing, or a tempo that changes partway through
            can all produce a less certain result than a straightforward
            studio track in 4/4 time. Each result includes a confidence
            percentage, and the key or BPM reading is flagged with a "Lower
            confidence" indicator whenever two independent checks disagree
            with each other rather than confirming the same answer.
          </p>
          <p className="text-text-muted leading-relaxed">
            Want the fuller explanation of why key and BPM readings can
            disagree between tools, and what a lower-confidence result
            actually means?{" "}
            <Link href="/guides/how-key-and-bpm-detection-works" className="text-amber-400 hover:underline">
              Read How Automatic Key and BPM Detection Actually Works
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

        <section className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
          <h2 className="font-semibold text-text-primary">Copyright &amp; processing notice</h2>
          <p className="text-sm text-text-muted leading-relaxed">
            You are responsible for ensuring you have the right to process any
            video you submit — for personal use, content you own, or material
            you have permission to use. Audio is fetched temporarily to run
            the analysis; AudioForges does not publicly host or distribute
            the videos or audio processed through this tool.
          </p>
        </section>

        <FAQSection faqs={faqs} />
      </main>
    </>
  );
}