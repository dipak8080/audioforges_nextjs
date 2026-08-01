import type { Metadata } from "next";
import Link from "next/link";
import { YouTubeSeparateForm } from "@/components/converter/YouTubeSeparateForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

const PAGE_TITLE = "Free YouTube Vocal Remover — Get Instrumentals";
const PAGE_DESCRIPTION =
  "Paste a YouTube link and split it into vocal and instrumental tracks with AI, free. No download step, no sign-up, no watermark.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/youtube-vocal-remover` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/youtube-vocal-remover`,
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

// WebApplication schema — every claim below is checked against the actual
// YouTubeSeparateForm/backend behavior.
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "YouTube Vocal Remover",
  url: `${SITE_URL}/youtube-vocal-remover`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "AI vocal/instrumental separation directly from a YouTube link",
    "No manual download step",
    "Separate vocal and instrumental downloads",
    "No sign-up required",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "YouTube Vocal Remover", item: `${SITE_URL}/youtube-vocal-remover` },
  ],
};
// NOTE: No HowTo schema — deprecated by Google (desktop since Sept 2023),
// no ranking or rich-result benefit remains. Visible how-to steps stay.

const faqs = [
  {
    question: "How is this different from the regular Vocal Remover?",
    answer:
      "The regular Vocal Remover needs an audio file already on your device. This version takes a YouTube link directly, fetching and separating the audio in one step so you skip the download-then-reupload workflow entirely.",
  },
  {
    question: "How long does it take?",
    answer:
      "Usually 2 to 6 minutes — it downloads the audio first, then runs the same AI separation as the file-based tool, which is the slower half of the process.",
  },
  {
    question: "What do I get back?",
    answer:
      "Two separate tracks: the isolated vocals, and the instrumental with vocals removed. Each previews and downloads independently.",
  },
  {
    question: "Is there a video length limit?",
    answer: "Yes, videos longer than 15 minutes aren't supported for this tool.",
  },
  {
    question: "What if the video is private, age-restricted, or region-locked?",
    answer:
      "Videos in any of those states may not be accessible to the downloader and can't be processed as a result.",
  },
  {
    question: "How good is the separation quality?",
    answer:
      "It uses the same AI separation model as the file-based Vocal Remover. Quality varies with how the track is mixed — dense, heavily layered production is harder to separate cleanly than a sparser arrangement.",
  },
  {
    question: "Can I get drums and bass separately too?",
    answer:
      "Yes — the YouTube Stem Splitter produces four separate stems (vocals, drums, bass, other) from the same kind of link.",
    answerNode: (
      <>
        Yes — the{" "}
        <Link href="/youtube-stem-splitter" className="text-amber-400 hover:underline">
          YouTube Stem Splitter
        </Link>{" "}
        produces four separate stems (vocals, drums, bass, other) from the same
        kind of link.
      </>
    ),
  },
  {
    question: "Is this really free?",
    answer:
      "Yes, but usage is rate-limited per person since this chains a YouTube download with CPU-intensive AI separation.",
  },
];

export default function YouTubeVocalRemoverPage() {
  const relatedTools = getRelatedTools("youtube-vocal-remover", 5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free YouTube Vocal Remover
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Paste a YouTube link and split it into vocal and instrumental
            tracks — no download step, free, no sign-up.
          </p>
        </header>

        {/* Tool stays first — SEO content supports it, doesn't bury it */}
        <YouTubeSeparateForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "No download step", desc: "Paste a link, skip the save-and-reupload." },
            { title: "Both tracks", desc: "Isolated vocals and the instrumental, downloaded separately." },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <h3 className="font-semibold text-text-primary">{f.title}</h3>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to remove vocals from a YouTube video</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Paste a YouTube video, Shorts, or youtu.be link.</li>
            <li>The audio is fetched and separated automatically — usually a few minutes.</li>
            <li>Preview and download the vocals, the instrumental, or both.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Why paste a link instead of downloading first</h2>
          <p className="text-text-muted leading-relaxed">
            The regular{" "}
            <Link href="/vocal-remover" className="text-amber-400 hover:underline">
              Vocal Remover
            </Link>{" "}
            works from a file already on your device — which normally means
            downloading the audio with one tool, then uploading it to
            another. This version chains both steps together, so a link is
            all you need. The separation itself is identical; only the input
            method differs.
          </p>
          <p className="text-text-muted leading-relaxed">
            Curious why this takes longer than a file upload, or what happens
            when a video can&apos;t be fetched at all?{" "}
            <Link href="/guides/how-youtube-tools-fetch-then-process" className="text-amber-400 hover:underline">
              Read How AudioForges&apos; YouTube Tools Work: Fetch, Then Process
            </Link>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common uses</h2>
          <p className="text-text-muted leading-relaxed">
            Making a karaoke backing track from a song on YouTube, pulling an
            acapella for a remix or mashup, isolating an instrumental to
            practice singing over, and studying how a track is arranged by
            listening to its parts separately.
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
          <h2 className="font-semibold text-text-primary">Copyright &amp; fair use</h2>
          <p className="text-sm text-text-muted leading-relaxed">
            You are responsible for ensuring you have the right to process any video
            you submit — for personal practice, content you own, or material you have
            permission to use. AudioForges does not host or distribute the videos or
            audio processed through this tool.
          </p>
        </section>

        <FAQSection faqs={faqs} />
      </main>
    </>
  );
}