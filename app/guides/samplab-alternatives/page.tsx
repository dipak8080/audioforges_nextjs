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

const guide = getGuideBySlug("samplab-alternatives")!;

const OG_IMAGE = ogForGuide(guide);

export const metadata: Metadata = {
  title: { absolute: "Samplab Is Shutting Down — Free Alternatives (2026)" },
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
      name: "When exactly does Samplab stop working?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Samplab's hosted service ends after 17 September 2026. After that date it is no longer possible to upload new audio files, and older versions of the software stop working entirely. Samplab has said it will refund the remaining balance of yearly subscriptions that extend past that date.",
      },
    },
    {
      "@type": "Question",
      name: "What is the best free replacement for Samplab's audio-to-MIDI?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "For browser-based conversion with no install, AudioForges and Spotify's Basic Pitch both convert audio to MIDI free with no length limit. For polyphonic note editing that preserves the original timbre — the thing Samplab was uniquely good at — there is no free replacement; Melodyne and Hit'n'Mix Infinity are the paid options.",
      },
    },
    {
      "@type": "Question",
      name: "Can I still open my old Samplab projects?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Samplab released a version that lets existing users keep working with projects they already have, and offline Resynthesizer builds remain usable for previous purchasers. New uploads stop after 17 September 2026, so export anything you still need as audio or MIDI before that date.",
      },
    },
  ],
};

const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary";
const td = "px-3 py-2 align-top";

export default function SamplabAlternativesPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <Breadcrumb items={[{ name: "Guides", href: "/guides" }, { name: "Samplab alternatives" }]} className="mb-8" />

        <header>
          <h1 className="measure-wide text-4xl font-bold leading-[1.06] tracking-[-0.02em] text-text-primary sm:text-5xl">
            Samplab is shutting down: where to move your workflow
          </h1>
          <div className="mt-5">
            <GuideByline publishedDate={guide.publishedDate} updatedDate={guide.updatedDate} />
          </div>
        </header>

        <Prose className="mt-10">
          <p>
            Samplab&apos;s hosted service ends after <strong>17 September 2026</strong>.
            After that you can&apos;t upload new audio, and older versions of the
            software stop working entirely. Yearly subscriptions extending past
            that date are being refunded. If your workflow depended on it, the
            honest first step isn&apos;t picking a replacement — it&apos;s
            exporting what you still need while the service is up.
          </p>

          <h2 id="do-this-first">Do this first, before the 17th</h2>
          <ol>
            <li>Open every project you might come back to and export the MIDI.</li>
            <li>Export the rendered audio too, for anything where you edited notes and want the result preserved.</li>
            <li>Save your stems separately if you used the stem split — those aren&apos;t recoverable later.</li>
            <li>Only then start testing replacements, with files you already have.</li>
          </ol>

          <h2 id="what-youre-losing">What you&apos;re actually losing</h2>
          <p>
            Samplab did four things in one place: polyphonic audio-to-MIDI, stem
            separation, chord detection, and note editing that preserved the
            original timbre. That last one is the hard part. Most tools give you
            MIDI; Samplab let you change a note <em>inside</em> the sample and
            still sound like the sample. No free tool replaces that, and
            it&apos;s worth being clear about it rather than pretending a
            converter is a like-for-like swap.
          </p>
          <p>
            The rest — conversion, stems, chords — is well covered, including
            free. So the right replacement depends on which part of Samplab you
            actually used.
          </p>

          <h2 id="options">The options</h2>
          <div className="not-prose my-6 overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-graphite-900">
                <tr>
                  <th className={th}>Tool</th>
                  <th className={th}>Cost</th>
                  <th className={th}>Replaces</th>
                  <th className={th}>Trade-off</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-graphite-800">
                  <td className={td}><strong>AudioForges</strong> (this site)</td>
                  <td className={td}>Free</td>
                  <td className={td}>Audio-to-MIDI, stem separation, key/BPM — in the browser, no account</td>
                  <td className={td}>No note editing inside the audio; you get MIDI and stems, not a resynthesised sample</td>
                </tr>
                <tr className="border-t border-graphite-800">
                  <td className={td}><strong>Basic Pitch</strong> (Spotify)</td>
                  <td className={td}>Free</td>
                  <td className={td}>Audio-to-MIDI only</td>
                  <td className={td}>Conversion alone — no stems, no chord detection, no editing</td>
                </tr>
                <tr className="border-t border-graphite-800">
                  <td className={td}><strong>Melodyne</strong></td>
                  <td className={td}>From ~$99, Editor $399+</td>
                  <td className={td}>Polyphonic note editing with timbre preserved</td>
                  <td className={td}>The real replacement for Samplab&apos;s core trick, at a serious price</td>
                </tr>
                <tr className="border-t border-graphite-800">
                  <td className={td}><strong>Hit&apos;n&apos;Mix Infinity</strong></td>
                  <td className={td}>~$249</td>
                  <td className={td}>Polyphonic note editing, processed offline</td>
                  <td className={td}>One-time purchase and fully offline, but a steep learning curve</td>
                </tr>
                <tr className="border-t border-graphite-800">
                  <td className={td}><strong>Your DAW</strong></td>
                  <td className={td}>Already paid for</td>
                  <td className={td}>Basic audio-to-MIDI (Ableton 11+, Logic, Cubase)</td>
                  <td className={td}>Fine on monophonic and drums, weaker on polyphonic material</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 id="by-use-case">Pick by what you used it for</h2>
          <ul>
            <li><strong>You converted loops to MIDI to re-voice them:</strong> the <Link href="/audio-to-midi">AudioForges audio-to-MIDI converter</Link> does this free with no length limit, and shows the result on a piano roll so you can hear it before downloading. Basic Pitch works too.</li>
            <li><strong>You split a sample then converted a part:</strong> run the <Link href="/stems">stem splitter</Link> first, then convert the isolated part — same two-step flow, free, no install.</li>
            <li><strong>You needed the key and tempo to match samples:</strong> the <Link href="/key-finder">key &amp; BPM finder</Link> covers that step.</li>
            <li><strong>You edited notes inside audio and kept the timbre:</strong> Melodyne or Hit&apos;n&apos;Mix. There is no free equivalent, and any page telling you otherwise is selling something.</li>
            <li><strong>You worked inside a DAW via the plugin:</strong> check what your DAW already ships before buying anything — Ableton, Logic and Cubase all have audio-to-MIDI built in.</li>
          </ul>

          <h2 id="lesson">One takeaway worth keeping</h2>
          <p>
            Samplab shutting down with eight days&apos; notice is a reminder to
            keep your work in formats that outlive the tool. MIDI, WAV and
            MusicXML open anywhere in twenty years; a proprietary project file
            opens as long as the company exists. Export the portable version
            while you still can — of everything, not just Samplab.
          </p>
        </Prose>

        <div className="mt-10 flex flex-wrap gap-3 border-t border-graphite-800 pt-8">
          <Link href="/audio-to-midi" className={buttonStyles({ size: "lg" })}>
            Free audio to MIDI converter
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/stems" className={buttonStyles({ size: "lg", variant: "outline" })}>
            Stem splitter
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}