import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Prose } from "@/components/ui/Prose";
import { EmbedSnippet } from "@/components/embed/EmbedSnippet";
import { SITE_URL } from "@/lib/constants";
import { ogImage } from "@/lib/og";

const TITLE = "Free Key & BPM Finder Widget for Your Site";
const DESCRIPTION =
  "Embed a free key and BPM detector on your music blog or site with one line of HTML. No account, no API key, no cost.";

const OG_IMAGE = ogImage("Embeddable Key & BPM Finder", "Add free key detection to any site.");

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/embed` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/embed`,
    siteName: "AudioForges",
    type: "website",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is the key and BPM widget free to embed?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. There is no cost, no account, and no API key. The only condition is that the 'Powered by AudioForges' link stays visible in the widget.",
      },
    },
    {
      "@type": "Question",
      name: "Do my visitors' files get uploaded anywhere?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Audio is sent to the AudioForges analysis server, analysed, and deleted. Nothing is stored and no account or email is collected from your visitors.",
      },
    },
    {
      "@type": "Question",
      name: "How accurate is the key detection?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The widget runs the same detection as the full AudioForges key finder: an Essentia analysis cross-checked against librosa, with a confidence score on every result. It analyses the audio itself rather than looking a track up in a database, so it works on unreleased music and demos.",
      },
    },
  ],
};

export default function EmbedPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <Breadcrumb items={[{ name: "Embed widget" }]} className="mb-8" />

        <header>
          <h1 className="measure-wide text-4xl font-bold leading-[1.06] tracking-[-0.02em] text-text-primary sm:text-5xl">
            Put a free key &amp; BPM finder on your site
          </h1>
          <p className="mt-5 text-lg text-text-secondary">
            One line of HTML. Your readers drop in a track and get the key, Camelot
            code and tempo without leaving your page. No account, no API key, no cost.
          </p>
        </header>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-text-primary">Live preview</h2>
          <p className="mt-2 text-sm text-text-secondary">
            This is the widget itself, running right here — try it with a track.
          </p>
          <div className="mt-4 overflow-hidden rounded-xl border border-graphite-800">
            <iframe
              src="/embed/key-finder"
              title="AudioForges key and BPM finder"
              width="100%"
              height="330"
              style={{ border: "none", display: "block" }}
              loading="lazy"
            />
          </div>
        </section>

        <EmbedSnippet />

        <Prose className="mt-12">
          <h2>What it does</h2>
          <p>
            The widget runs the same analysis as the{" "}
            <Link href="/key-finder">full AudioForges key finder</Link>: Essentia
            estimates the key and tempo, librosa cross-checks both, and the result
            carries a confidence score. It reads the audio itself rather than looking
            the track up in a database, so it works on unreleased music, demos and
            your own recordings — not just released catalogue.
          </p>

          <h2>Terms, in plain words</h2>
          <ul>
            <li>Free for any site, commercial or not.</li>
            <li>Keep the &ldquo;Powered by AudioForges&rdquo; link visible. That link is the whole price.</li>
            <li>Don&apos;t modify the iframe to hide the attribution or to auto-submit files.</li>
            <li>Analysis is rate limited per visitor, which is generous for readers and useless for scripts.</li>
            <li>No warranty — if the server is down, the widget shows an error rather than breaking your page.</li>
          </ul>

          <h2>Privacy</h2>
          <p>
            Files go to the AudioForges analysis server, are analysed, and are
            deleted. Nothing is stored, and no account or email is collected from
            your visitors. The widget sets no tracking cookies of its own.
          </p>

          <h2>Two widgets, same terms</h2>
          <p>
            <Link href="/key-finder">Key &amp; BPM</Link> and{" "}
            <Link href="/audio-to-midi">audio-to-MIDI</Link> are both embeddable —
            switch between them in the code block above. MIDI conversion takes
            longer to run, so give that one a taller frame.
          </p>
          <p>
            If a <Link href="/stems">stem splitter</Link> embed would suit your
            readers better, say so — it&apos;s next, and knowing who wants it
            decides the order.
          </p>
        </Prose>
      </main>
    </>
  );
}