import type { Metadata } from "next";
import Link from "next/link";
import { Download, Search } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Prose } from "@/components/ui/Prose";
import { ToolSection } from "@/components/ui/ToolSection";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";
import { CamelotChart, EmbedSnippet } from "@/components/tools/CamelotChart";
import { CAMELOT_KEYS } from "@/lib/data/camelot";
import { SITE_URL } from "@/lib/constants";
import { ogImage } from "@/lib/og";

const PATH = "/camelot-wheel";
const PAGE_TITLE = "Camelot Wheel Chart – Free Printable PDF and Key Table";
const PAGE_DESCRIPTION =
  "Interactive Camelot wheel with all 24 keys, Open Key codes and the mixes that work. Download a free printable PDF in A4 or US Letter.";

const OG_IMAGE = ogImage("Camelot Wheel Chart", "All 24 keys, the mixes that work, free printable PDF", "Free PDF");

const FILES = {
  a4: "/downloads/camelot-wheel-a4.pdf",
  letter: "/downloads/camelot-wheel-letter.pdf",
  png: "/downloads/camelot-wheel.png",
  preview: "/downloads/camelot-wheel-preview.webp",
};

const SNIPPET = `<a href="${SITE_URL}${PATH}"><img src="${SITE_URL}${FILES.png}" alt="Camelot wheel chart for harmonic mixing" width="600" height="600"></a>
<p>Camelot wheel by <a href="${SITE_URL}${PATH}">AudioForges</a></p>`;

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}${PATH}` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}${PATH}`,
    siteName: "AudioForges",
    type: "website",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

const imageJsonLd = {
  "@context": "https://schema.org",
  "@type": "ImageObject",
  name: "Camelot wheel chart",
  description: "Camelot wheel showing all 24 musical keys as codes 1A to 12B, for harmonic mixing.",
  contentUrl: `${SITE_URL}${FILES.png}`,
  url: `${SITE_URL}${PATH}`,
  creditText: "AudioForges",
  creator: { "@type": "Organization", name: "AudioForges" },
  copyrightNotice: "Free to print and share with a link to audioforges.com",
};

const faqs: FAQItem[] = [
  {
    question: "What is the Camelot wheel?",
    answer:
      "A chart that renames the 24 musical keys as a number from 1 to 12 plus a letter, A for minor and B for major. Keys that sit next to each other on the wheel share most of their notes, so tracks in those keys blend without clashing.",
  },
  {
    question: "How do I use it to mix?",
    answer:
      "Find the code of the track that is playing. The next track mixes cleanly if it has the same code, the same number with the other letter, or a number one step up or down with the same letter. Two steps up works as an energy lift, but check it by ear first.",
  },
  {
    question: "What is Open Key?",
    answer:
      "Another notation for the same 24 keys, used by Traktor. It numbers from C major as 1d, with d for major and m for minor. The table on this page lists both codes side by side, so you can read either.",
  },
  {
    question: "How do I find the Camelot code of my tracks?",
    answer:
      "Run them through a key detector. The AudioForges Key and BPM Finder is free, returns the key, tempo and Camelot code, and handles a whole folder at once.",
    answerNode: (
      <>
        Run them through a key detector. The <Link href="/key-finder">Key and BPM Finder</Link> is free, returns the
        key, tempo and Camelot code, and handles a whole folder at once.
      </>
    ),
  },
  {
    question: "Can I print the chart or use it on my site?",
    answer:
      "Yes. The PDF and image are free to print, share in class or post on your blog. Please link back to this page when you publish it; the HTML snippet on this page does that for you.",
  },
];

export default function CamelotWheelPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(imageJsonLd) }} />

      <main id="main" className="mx-auto max-w-3xl space-y-14 px-4 py-10 sm:py-14">
        <div>
          <Breadcrumb items={[{ name: "Camelot wheel chart" }]} className="mb-8" />
          <header>
            <h1 className="measure-wide text-4xl font-bold leading-[1.06] tracking-[-0.02em] text-text-primary sm:text-5xl">
              Camelot wheel chart
            </h1>
            <p className="measure mt-4 text-lg leading-relaxed text-text-body">
              Tap a key to see what mixes with it. All 24 keys are below, and the full chart prints free as a PDF.
            </p>
          </header>
        </div>

        <CamelotChart />

        <ToolSection id="print" title="Print it or save it" bleed>
          <div className="grid gap-6 sm:grid-cols-[minmax(0,15rem)_1fr] sm:items-start">
            <a
              href={FILES.a4}
              className="block overflow-hidden rounded-lg border border-graphite-800 bg-white outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={FILES.preview}
                alt="Preview of the printable Camelot wheel chart"
                width={640}
                height={905}
                loading="lazy"
                className="h-auto w-full"
              />
            </a>
            <div className="space-y-4">
              <Prose>
                <p>
                  One page with the wheel, the five moves that work, and every key with its Camelot and Open Key code.
                  It prints fine in black and white.
                </p>
              </Prose>
              <div className="flex flex-wrap gap-2">
                <a href={FILES.a4} download className={buttonStyles({ size: "md" })}>
                  <Download />
                  PDF, A4
                </a>
                <a href={FILES.letter} download className={buttonStyles({ variant: "outline", size: "md" })}>
                  <Download />
                  PDF, US Letter
                </a>
                <a href={FILES.png} download className={buttonStyles({ variant: "ghost", size: "md" })}>
                  <Download />
                  Wheel image, PNG
                </a>
              </div>
            </div>
          </div>
        </ToolSection>

        <ToolSection id="all-keys" title="All 24 keys" bleed>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="bg-graphite-900 text-xs text-text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Camelot</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Key</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Open Key</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Also written as</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                {CAMELOT_KEYS.map((k) => (
                  <tr key={k.code}>
                    <th scope="row" className="px-4 py-2 font-semibold text-amber-400">{k.code}</th>
                    <td className="px-4 py-2 text-text-primary">{k.key}</td>
                    <td className="px-4 py-2 text-text-muted">{k.openKey}</td>
                    <td className="px-4 py-2 text-text-subtle">{k.aka ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ToolSection>

        <ToolSection id="moves" title="The moves that work">
          <p>From the code that is playing:</p>
          <ul>
            <li>
              <strong>Same code.</strong> 8A to 8A. The safest mix there is.
            </li>
            <li>
              <strong>Swap the letter.</strong> 8A to 8B. A minor and C major use the same notes, so the mood changes
              and nothing clashes.
            </li>
            <li>
              <strong>One step round.</strong> 8A to 7A or 9A. Neighbours on the circle of fifths, so the blend stays
              smooth.
            </li>
            <li>
              <strong>Two steps up.</strong> 8A to 10A. A lift in energy that can sound great, but try it by ear first.
            </li>
            <li>
              <strong>Diagonal.</strong> 8A to 9B. A bigger mood shift. Use it deliberately, not by default.
            </li>
          </ul>
          <p>
            The <Link href="/guides/camelot-wheel-harmonic-mixing">harmonic mixing guide</Link> covers building a whole
            set around these moves.
          </p>
        </ToolSection>

        <ToolSection id="embed" title="Use the chart on your site" bleed>
          <Prose className="mb-4">
            <p>
              Teaching a class or writing about DJing? Paste this where you want the wheel to appear. It shows the image
              and credits this page.
            </p>
          </Prose>
          <EmbedSnippet snippet={SNIPPET} />
        </ToolSection>

        <section className="rounded-xl border border-graphite-800 bg-graphite-900 p-6">
          <h2 className="text-xl font-bold tracking-tight text-text-primary">Need the code for your own tracks?</h2>
          <p className="measure mt-2 text-sm leading-relaxed text-text-body">
            The Key and BPM Finder reads the key, tempo and Camelot code of a song, or of a whole folder at once, and
            exports the results.
          </p>
          <Link href="/key-finder" className={buttonStyles({ size: "md", className: "mt-4" })}>
            <Search />
            Find the key of a track
          </Link>
        </section>

        <FAQSection faqs={faqs} />
      </main>
    </>
  );
}