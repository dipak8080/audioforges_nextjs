import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Prose } from "@/components/ui/Prose";
import { ogForGuide } from "@/lib/og";

const guide = getGuideBySlug("songscription-alternatives-free")!;

const OG_IMAGE = ogForGuide(guide);

export const metadata: Metadata = {
  title: guide.title,
  description: guide.description,
  alternates: { canonical: `${SITE_URL}/guides/${guide.slug}` },
  openGraph: {
    title: guide.title,
    description: guide.description,
    url: `${SITE_URL}/guides/${guide.slug}`,
    siteName: "AudioForges",
    type: "article",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: guide.title,
    description: guide.description,
    images: [OG_IMAGE.url],
  },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: guide.title,
  description: guide.description,
  datePublished: guide.publishedDate,
  dateModified: guide.updatedDate,
  author: { "@type": "Organization", name: "AudioForges" },
  url: `${SITE_URL}/guides/${guide.slug}`,
  mainEntityOfPage: `${SITE_URL}/guides/${guide.slug}`,
  image: `${SITE_URL}${OG_IMAGE.url}`,
  publisher: { "@type": "Organization", name: "AudioForges" },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is Songscription free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Partly. Songscription's free tier covers unlimited 30-second transcriptions, which is enough to test it or transcribe a short phrase. Full songs need a paid plan, which starts around $9.99 per month and raises the limit to several minutes per track.",
      },
    },
    {
      "@type": "Question",
      name: "What is the best free alternative to Songscription?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "For full-length tracks with no clip limit and no account, AudioForges transcribes the whole file and exports PDF, MusicXML and MIDI. For offline work on a desktop, MuseScore paired with a MIDI conversion step is free. AnthemScore is a one-time purchase rather than a subscription if you prefer owning the software.",
      },
    },
    {
      "@type": "Question",
      name: "Can any of these transcribe a full band recording accurately?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Not reliably, and no tool on this list claims otherwise. Automatic transcription is strongest on solo piano and clean single-instrument recordings. Dense mixes with drums and layered vocals produce errors that need manual cleanup in notation software regardless of which tool made the first pass.",
      },
    },
  ],
};

const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary";
const td = "px-3 py-2 align-top";

export default function SongscriptionAlternativesPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <Breadcrumb items={[{ name: "Guides", href: "/guides" }, { name: guide.title }]} className="mb-8" />

        <header>
          <h1 className="measure-wide text-4xl font-bold leading-[1.06] tracking-[-0.02em] text-text-primary sm:text-5xl">
            {guide.title}
          </h1>
          <div className="mt-5">
            <GuideByline publishedDate={guide.publishedDate} updatedDate={guide.updatedDate} />
          </div>
        </header>

        <Prose className="mt-10">
          <p>
            Songscription is good software, and most people who look for an
            alternative aren&apos;t unhappy with the transcription — they hit the
            thirty-second wall on the free tier and want to know what else exists
            before paying a subscription. This is an honest comparison, written by
            someone who runs one of the alternatives, so read the trade-offs
            carefully rather than the conclusion.
          </p>

          <h2 id="what-songscription-does">What Songscription actually gives you</h2>
          <p>
            The free tier is unlimited transcriptions of up to thirty seconds
            each, which is a real free tier rather than a trial — enough for a
            riff, a phrase, or checking whether the accuracy suits your material.
            Paid plans start around $9.99/month and lift the limit to several
            minutes per track. It handles about ten instruments individually,
            accepts YouTube links as well as files, and includes an editor and
            piano roll for cleaning up the result. For a paying user working
            mostly on solo instruments, that&apos;s a coherent product.
          </p>
          <p>
            The reasons to look elsewhere are usually one of three: you need whole
            songs and don&apos;t want a subscription, you don&apos;t want to make
            an account, or you want to keep files off a server entirely.
          </p>

          <h2 id="comparison">The alternatives, compared</h2>
          <div className="not-prose my-6 overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-graphite-900">
                <tr>
                  <th className={th}>Tool</th>
                  <th className={th}>Cost</th>
                  <th className={th}>Length limit</th>
                  <th className={th}>Best for</th>
                  <th className={th}>Trade-off</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-graphite-800">
                  <td className={td}><strong>Songscription</strong></td>
                  <td className={td}>Free 30s clips; ~$9.99/mo</td>
                  <td className={td}>30 seconds free</td>
                  <td className={td}>Per-instrument transcription with an editor built in</td>
                  <td className={td}>Full songs need a subscription</td>
                </tr>
                <tr className="border-t border-graphite-800">
                  <td className={td}><strong>AudioForges</strong> (this site)</td>
                  <td className={td}>Free</td>
                  <td className={td}>Full track</td>
                  <td className={td}>Whole songs, no account, PDF + MusicXML + MIDI</td>
                  <td className={td}>No per-instrument picker or built-in editor — clean up in MuseScore</td>
                </tr>
                <tr className="border-t border-graphite-800">
                  <td className={td}><strong>AnthemScore</strong></td>
                  <td className={td}>One-time purchase</td>
                  <td className={td}>Full track</td>
                  <td className={td}>Offline desktop work, files never leave your machine</td>
                  <td className={td}>Windows/Mac/Linux only, no web or mobile, no tabs or drums</td>
                </tr>
                <tr className="border-t border-graphite-800">
                  <td className={td}><strong>Klangio</strong></td>
                  <td className={td}>Metered subscription</td>
                  <td className={td}>~20s preview free</td>
                  <td className={td}>Instrument-specific apps (piano, guitar, drums, voice)</td>
                  <td className={td}>Separate products per instrument; billing is per ticket</td>
                </tr>
                <tr className="border-t border-graphite-800">
                  <td className={td}><strong>Basic Pitch + MuseScore</strong></td>
                  <td className={td}>Free</td>
                  <td className={td}>Full track</td>
                  <td className={td}>Full control, everything open source</td>
                  <td className={td}>Two steps — MIDI first, then import and engrave yourself</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 id="honest-accuracy">The accuracy question, honestly</h2>
          <p>
            No tool here transcribes a dense full-band mix well, and any page
            claiming otherwise is selling something. Automatic transcription is
            reliable on solo piano and clean single-instrument recordings, decent
            on simple duos, and unreliable the moment drums, layered vocals and
            fast passages stack up. Every one of these tools produces a first
            draft that needs a human pass in notation software. Choose on price,
            length limits and workflow, because on hard material the accuracy
            differences matter less than the cleanup you&apos;ll do either way.
          </p>

          <h2 id="which-to-pick">Which to pick</h2>
          <ul>
            <li><strong>You want a full song transcribed today, free:</strong> the <Link href="/audio-to-sheet-music">AudioForges converter</Link> takes the whole file and exports PDF, MusicXML and MIDI without an account.</li>
            <li><strong>You transcribe often and want per-instrument control:</strong> Songscription&apos;s paid tier is genuinely built for that, and $9.99 is less than one hour of a human transcriber.</li>
            <li><strong>You want to own the software and work offline:</strong> AnthemScore, one-time purchase.</li>
            <li><strong>You want maximum control and don&apos;t mind two steps:</strong> Basic Pitch to MIDI, then MuseScore to engrave.</li>
            <li><strong>You only need the notes, not a score:</strong> skip notation entirely and use an <Link href="/audio-to-midi">audio-to-MIDI converter</Link> — most DAW work doesn&apos;t need engraving.</li>
          </ul>

          <h2 id="cleanup">Whatever you pick, budget for cleanup</h2>
          <p>
            Import the MusicXML into MuseScore, fix the obvious wrong notes
            against the recording, correct the time signature if the tool guessed
            it, and re-bar anything that landed off the grid.{" "}
            <Link href="/guides/how-audio-to-sheet-music-works">
              How audio-to-sheet-music works
            </Link>{" "}
            covers what the model is doing at each stage, which makes the errors
            much easier to predict and fix.
          </p>
        </Prose>

        <div className="mt-10 border-t border-graphite-800 pt-8">
          <Link href="/audio-to-sheet-music" className={buttonStyles({ size: "lg" })}>
            Try the free converter
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}