import type { Metadata } from "next";
import Link from "next/link";
import { YouTubeStemForm } from "@/components/converter/YouTubeStemForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

const PAGE_TITLE = "Free YouTube Stem Splitter — Vocals, Drums, Bass";
const PAGE_DESCRIPTION =
  "Paste a YouTube link and split it into vocals, drums, bass, and other stems with AI, free. No download step, no sign-up, no watermark.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/youtube-stem-splitter` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/youtube-stem-splitter`,
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
// YouTubeStemForm/backend behavior. No "best"/"most accurate" claims.
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "YouTube Stem Splitter",
  url: `${SITE_URL}/youtube-stem-splitter`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "AI 4-stem separation directly from a YouTube link",
    "No manual download step",
    "Individually downloadable vocals, drums, bass, and other stems",
    "No sign-up required",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "YouTube Stem Splitter", item: `${SITE_URL}/youtube-stem-splitter` },
  ],
};
// NOTE: No HowTo schema — deprecated by Google (desktop since Sept 2023),
// no ranking or rich-result benefit remains. Visible how-to steps stay.

const faqs = [
  {
    question: "How is this different from the regular Stem Splitter?",
    answer:
      "The regular Stem Splitter needs an audio file already on your device. This version takes a YouTube link directly, fetching and separating the audio in one step instead of requiring a separate download tool first.",
  },
  {
    question: "How long does it take?",
    answer:
      "Usually 2 to 6 minutes — downloading the audio is the fast part; the AI stem separation is what takes most of the time.",
  },
  {
    question: "What stems do I get?",
    answer:
      "Four: vocals, drums, bass, and other (everything else — guitars, keys, pads, synths). Each downloads independently.",
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
    question: "I only want vocals and instrumental, not all 4 stems — is there a simpler option?",
    answer:
      "Yes — the YouTube Vocal Remover gives you just vocals and a combined instrumental, if you don't need drums and bass split out separately.",
    answerNode: (
      <>
        Yes — the{" "}
        <Link href="/youtube-vocal-remover" className="text-amber-400 hover:underline">
          YouTube Vocal Remover
        </Link>{" "}
        gives you just vocals and a combined instrumental, if you don&apos;t
        need drums and bass split out separately.
      </>
    ),
  },
  {
    question: "Is this really free?",
    answer:
      "Yes, but usage is rate-limited per person since this chains a YouTube download with CPU-intensive 4-stem AI separation.",
  },
];

export default function YouTubeStemSplitterPage() {
  const relatedTools = getRelatedTools("youtube-stem-splitter", 5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free YouTube Stem Splitter
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Paste a YouTube link and split it into vocals, drums, bass, and
            other stems — no download step, free, no sign-up.
          </p>
        </header>

        {/* Tool stays first — SEO content supports it, doesn't bury it */}
        <YouTubeStemForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "No download step", desc: "Paste a link, skip the save-and-reupload." },
            { title: "4 separate stems", desc: "Vocals, drums, bass, and other, each downloaded individually." },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <h3 className="font-semibold text-text-primary">{f.title}</h3>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to split a YouTube video into stems</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Paste a YouTube video, Shorts, or youtu.be link.</li>
            <li>The audio is fetched and split into four stems automatically — usually a few minutes.</li>
            <li>Preview and download each stem individually.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What you get: the four stems</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-text-primary">Vocals</h3>
              <p className="text-text-muted leading-relaxed">
                Lead and backing vocals, isolated from the instrumentation
                around them.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Drums</h3>
              <p className="text-text-muted leading-relaxed">
                The full kit — kick, snare, hi-hats, cymbals, and other
                percussion — as one combined drum stem.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Bass</h3>
              <p className="text-text-muted leading-relaxed">
                Bass guitar or synth bass, covering the low end of the
                arrangement.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Other</h3>
              <p className="text-text-muted leading-relaxed">
                Everything that isn&apos;t vocals, drums, or bass — guitars,
                keys, synths, pads, and any remaining instrumentation, kept
                together as a single stem.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Why paste a link instead of downloading first</h2>
          <p className="text-text-muted leading-relaxed">
            The regular{" "}
            <Link href="/stems" className="text-amber-400 hover:underline">
              Stem Splitter
            </Link>{" "}
            works from a file already on your device — usually meaning a
            separate download step before you can even start. This version
            chains the download and the 4-stem separation together, so a
            link is all you need. The separation itself is identical; only
            the input method differs.
          </p>
          <p className="text-text-muted leading-relaxed">
            Want the fuller breakdown of how 4-stem separation actually
            works, and why bass and drums are the hardest pair to separate
            cleanly?{" "}
            <Link href="/guides/ai-stem-separation-explained" className="text-amber-400 hover:underline">
              Read How AI Stem Separation Actually Works
            </Link>
            . Curious why the YouTube version takes longer than uploading a
            file, or what happens when a video can&apos;t be fetched?{" "}
            <Link href="/guides/how-youtube-tools-fetch-then-process" className="text-amber-400 hover:underline">
              Read How AudioForges&apos; YouTube Tools Work: Fetch, Then Process
            </Link>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Limitations</h2>
          <p className="text-text-muted leading-relaxed">
            Separation quality depends on how densely the source track is
            mixed. Bass and low guitar can bleed into each other since they
            occupy similar frequency ranges, and heavily processed or
            programmed drums sometimes separate less cleanly than an
            acoustic kit. This isn&apos;t specific to pulling audio from
            YouTube — it&apos;s the same behavior as the file-based Stem
            Splitter, since both run the same separation model.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common uses</h2>
          <p className="text-text-muted leading-relaxed">
            Pulling an isolated drum or bass part from a track on YouTube to
            sample or study, building a remix around specific stems from a
            reference track, and breaking down an arrangement
            instrument-by-instrument without needing the original files.
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