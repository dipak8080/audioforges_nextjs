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
import { ToolVideo } from "@/components/media/ToolVideo";

const guide = getGuideBySlug("prepare-samples-for-sp404-digitakt-mpc")!;

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
      name: "What sample rate does the SP-404MKII use?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "48 kHz, 16-bit. The SP-404MKII imports WAV, AIFF and MP3 and converts everything to 48 kHz 16-bit internally, so exporting your samples at that rate skips a conversion and keeps import fast and predictable.",
      },
    },
    {
      "@type": "Question",
      name: "Why does my stereo sample sound wrong on the Digitakt?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The original Digitakt is a mono sampler, and Elektron Transfer converts stereo files by keeping only the left channel — anything panned right disappears. Sum the file to mono yourself before transferring so both channels end up in the sample. The Digitakt II plays stereo natively.",
      },
    },
    {
      "@type": "Question",
      name: "What audio format do standalone MPCs use?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Standalone MPCs (One, Live, X, Key) run at 44.1 kHz internally. They import WAV, AIFF, MP3 and FLAC and resample on load, but delivering 44.1 kHz 16- or 24-bit WAV avoids the conversion and keeps pitch and timing exactly as you exported them.",
      },
    },
  ],
};

const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary";
const td = "px-3 py-2 align-top";

export default function HardwareSamplerGuidePage() {
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
            Hardware samplers are less forgiving than a DAW. A DAW quietly
            resamples whatever you drag in; a sampler either converts on import
            — slowly, and sometimes badly — or plays the file at the wrong
            speed. Every box also has one native format it actually stores, and
            feeding it exactly that format makes imports instant and removes a
            whole category of &ldquo;why does this sound different on the
            hardware&rdquo; problems. This guide covers the SP-404MKII, the
            Digitakt, standalone MPCs and the Octatrack, plus the file-naming
            habits that keep a 500-sample SD card usable on a small screen.
          </p>

          <h2 id="the-short-answer">The short answer</h2>
          <ul>
            <li><strong>SP-404MKII:</strong> 48 kHz, 16-bit WAV.</li>
            <li><strong>Digitakt:</strong> 48 kHz, 16-bit, <strong>mono</strong> WAV — sum stereo files yourself first.</li>
            <li><strong>Digitakt II:</strong> 48 kHz WAV, stereo is fine.</li>
            <li><strong>MPC One / Live / X / Key:</strong> 44.1 kHz, 16- or 24-bit WAV.</li>
            <li><strong>Octatrack:</strong> 44.1 kHz, 16- or 24-bit WAV, stereo supported.</li>
            <li><strong>Name files</strong> with tempo and key up front: <code>140_Fm_bass-stab.wav</code> beats <code>final_bass_v3 (1).wav</code> on every device screen ever made.</li>
          </ul>

          <h2 id="by-device">Device specifics</h2>
          <div className="not-prose my-6 overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-graphite-900">
                <tr>
                  <th className={th}>Device</th>
                  <th className={th}>Native format</th>
                  <th className={th}>Imports</th>
                  <th className={th}>Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-graphite-800">
                  <td className={td}><strong>Roland SP-404MKII</strong></td>
                  <td className={td}>48 kHz, 16-bit</td>
                  <td className={td}>WAV, AIFF, MP3 (app adds FLAC, M4A)</td>
                  <td className={td}>Everything is converted to 48 kHz 16-bit on import. Delivering that exact format makes SD-card imports near-instant.</td>
                </tr>
                <tr className="border-t border-graphite-800">
                  <td className={td}><strong>Elektron Digitakt</strong></td>
                  <td className={td}>48 kHz, 16-bit, mono</td>
                  <td className={td}>WAV via Elektron Transfer</td>
                  <td className={td}>Transfer converts anything — but takes <em>only the left channel</em> of stereo files. Sum to mono before sending.</td>
                </tr>
                <tr className="border-t border-graphite-800">
                  <td className={td}><strong>Elektron Digitakt II</strong></td>
                  <td className={td}>48 kHz, stereo or mono</td>
                  <td className={td}>WAV via Transfer</td>
                  <td className={td}>Stereo playback is native. Mono still halves memory use, so keep drums and bass mono anyway.</td>
                </tr>
                <tr className="border-t border-graphite-800">
                  <td className={td}><strong>Akai MPC One / Live / X / Key</strong></td>
                  <td className={td}>44.1 kHz</td>
                  <td className={td}>WAV, AIFF, MP3, FLAC</td>
                  <td className={td}>Standalone mode runs at 44.1 kHz regardless of what you import. 44.1 kHz WAV loads without resampling.</td>
                </tr>
                <tr className="border-t border-graphite-800">
                  <td className={td}><strong>Elektron Octatrack</strong></td>
                  <td className={td}>44.1 kHz, 16/24-bit</td>
                  <td className={td}>WAV, AIFF (44.1 kHz only)</td>
                  <td className={td}>No import conversion at all — a 48 kHz file simply plays back slow and flat. Convert before it touches the CF card.</td>
                </tr>
                <tr className="border-t border-graphite-800">
                  <td className={td}><strong>Anything older or unlisted</strong></td>
                  <td className={td}>Usually 44.1 kHz, 16-bit, mono</td>
                  <td className={td}>Check the manual</td>
                  <td className={td}>44.1/16 mono WAV is the safest default for legacy hardware — small, universal, and pre-2010 boxes rarely accept anything else.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 id="left-channel-trap">The left-channel trap</h2>
          <p>
            The single most common &ldquo;my sample sounds wrong on the
            Digitakt&rdquo; report isn&apos;t a rate problem — it&apos;s the
            stereo conversion. When Transfer meets a stereo file it doesn&apos;t
            sum the channels; it keeps the left one and discards the right. A
            wide pad, a ping-pong delay tail, a hi-hat panned right: gone or
            lopsided, and it&apos;s easy to blame the hardware. Converting to
            mono yourself with a proper L+R sum — the{" "}
            <Link href="/mono-stereo-converter">Mono/Stereo Converter</Link>{" "}
            does this — means <em>you</em> decide what the mono version sounds
            like, not the transfer tool.
          </p>

          <h2 id="why-match-rate">Why matching the native rate matters</h2>
          <p>
            Two different failure modes, depending on the box. Samplers that
            convert on import (SP-404MKII, MPC, Digitakt via Transfer) will
            accept a mismatched file, but you&apos;re trusting a converter
            written for a device CPU, and on big batches the import time adds
            up. Samplers that don&apos;t convert (Octatrack) just play the file
            at their own rate: a 48 kHz sample on a 44.1 kHz machine comes out
            roughly a semitone flat and 9% slow. Doing the conversion once, on a
            computer, with a good resampler, sidesteps both. The{" "}
            <Link href="/sample-rate-converter">Sample Rate Converter</Link>{" "}
            handles 44.1 and 48 kHz WAV output with selectable bit depth.
          </p>

          <h2 id="file-naming">File naming that survives a 2-inch screen</h2>
          <p>
            Sampler browsers show one short line per file, sort alphabetically,
            and have no search. Naming is your only database, so make the first
            characters do the work:
          </p>
          <ul>
            <li><strong>Tempo and key first:</strong> <code>140_Fm_bass-stab.wav</code>, <code>174_Am_break-tight.wav</code>. Files sort by BPM automatically and you can see at a glance what fits the project.</li>
            <li><strong>One-shots vs loops:</strong> suffix loops with the bar count (<code>_4bar</code>) so you know what needs tempo-sync before you audition it.</li>
            <li><strong>Keep it short:</strong> device screens truncate long names, and two files that differ only past the cutoff become indistinguishable. Aim for under 24 characters.</li>
            <li><strong>ASCII only, no spaces:</strong> letters, numbers, hyphen, underscore. Accented characters and emoji render as garbage or refuse to load on FAT32-formatted cards.</li>
            <li><strong>Folders by kit, not by type:</strong> a folder per kit or project (<code>drums-dusty/</code>, <code>trip-hop-01/</code>) loads as a unit; a global <code>kicks/</code> folder with 300 files means 300 button presses.</li>
          </ul>

          <h2 id="workflow">Batch-prepping a folder for the hardware</h2>
          <div className="not-prose my-6">
            <ToolVideo slug="sampler-guide-resample" bare />
          </div>
          <ol>
            <li>
              <strong>Trim</strong> each sample tight with the{" "}
              <Link href="/trim">Audio Trimmer</Link> — memory is measured in
              minutes on these boxes, and silence is the first thing worth
              cutting.
            </li>
            <li>
              <strong>Sum to mono</strong> where the target is mono (Digitakt,
              or by choice for drums) with the{" "}
              <Link href="/mono-stereo-converter">Mono/Stereo Converter</Link>,
              so the L+R sum happens on your terms.
            </li>
            <li>
              <strong>Convert the rate</strong> last with the{" "}
              <Link href="/sample-rate-converter">Sample Rate Converter</Link>:
              48 kHz 16-bit for the SP-404MKII and Digitakt, 44.1 kHz for MPC
              and Octatrack.
            </li>
            <li>
              <strong>Level-match</strong> one-shots with the{" "}
              <Link href="/loudness-normalizer">Loudness Normalizer</Link> so
              pad volume differences reflect your mixing, not the source files.
            </li>
            <li>
              <strong>Rename before copying</strong> to the card — renaming on
              the device is the worst text-entry experience in music hardware.
            </li>
          </ol>

          <h2 id="common-problems">Common problems and the format fix</h2>
          <ul>
            <li><strong>Sample plays slow and flat</strong> — rate mismatch on a non-converting device. Resample to the machine&apos;s native rate.</li>
            <li><strong>Stereo image collapsed or elements missing on Digitakt</strong> — Transfer kept the left channel only. Sum to mono first.</li>
            <li><strong>Import takes forever</strong> — the device is converting every file. Deliver the native format.</li>
            <li><strong>File refuses to load</strong> — wrong container or exotic characters in the name. Export plain WAV, rename to ASCII.</li>
            <li><strong>Ran out of sample memory</strong> — stereo files where mono would do, or untrimmed tails. Mono halves the footprint; trimming does the rest.</li>
            <li><strong>Two files look identical in the browser</strong> — names differ only after the screen truncates. Put the distinguishing part first.</li>
          </ul>
        </Prose>

        <div className="mt-10 border-t border-graphite-800 pt-8">
          <Link href="/sample-rate-converter" className={buttonStyles({ size: "lg" })}>
            Open the Sample Rate Converter
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}