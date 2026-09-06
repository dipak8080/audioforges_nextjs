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

const guide = getGuideBySlug("convert-audio-for-phone-systems-3cx-asterisk-ivr")!;

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
      name: "What sample rate does 3CX need for hold music and IVR prompts?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "3CX expects uncompressed WAV: PCM, 8 kHz, 16-bit, mono. Stereo or 44.1 kHz files are either rejected on upload or play back distorted.",
      },
    },
    {
      "@type": "Question",
      name: "Why does my hold music sound distorted or sped up on the phone system?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The file's sample rate doesn't match what the PBX expects. A 44.1 kHz file played by a system assuming 8 kHz sounds sped up and pitched up; the fix is to resample the file to 8 kHz (or 16 kHz for wideband) before uploading.",
      },
    },
    {
      "@type": "Question",
      name: "Should I use 8 kHz or 16 kHz?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Use 8 kHz unless your system documentation specifically says it supports wideband (G.722 / HD voice) prompts, in which case 16 kHz is allowed. 8 kHz works everywhere.",
      },
    },
  ],
};

export default function PhoneSystemAudioGuidePage() {
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
            Phone systems are the one place where a perfectly good audio file
            gets rejected for being <em>too</em> good. A 44.1 kHz stereo MP3 that
            plays fine everywhere else will be refused by 3CX, sound like
            chipmunks on Asterisk, or silently fail as an IVR prompt. The reason
            is simple: telephone audio has been 8,000 samples per second, mono,
            since the 1960s, and most PBX software still expects exactly that.
          </p>

          <h2 id="what-phone-systems-want">What phone systems actually want</h2>
          <p>
            Almost every business phone system, cloud or on-premise, expects the
            same thing for hold music, greetings and IVR menus:
          </p>
          <ul>
            <li><strong>Format:</strong> WAV, uncompressed PCM (not MP3, not compressed WAV)</li>
            <li><strong>Sample rate:</strong> 8 kHz (8,000 Hz). Some newer systems also accept 16 kHz for HD voice.</li>
            <li><strong>Bit depth:</strong> 16-bit</li>
            <li><strong>Channels:</strong> mono</li>
          </ul>
          <p>
            8 kHz sounds low because it is: the top of the audible range is cut
            at 4 kHz, which is why phone calls sound the way they do. That is the
            G.711 codec standard the whole telephone network runs on. Uploading
            a 44.1 kHz file does not give callers better sound — the system
            either refuses it or downsamples it badly on the fly, which is where
            distortion comes from.
          </p>

          <h2 id="by-system">Requirements by system</h2>
          <p>
            These are the most common documented requirements. Vendors change
            things, so if an upload fails, check the current spec — but the 8 kHz
            / 16-bit / mono WAV below works on all of them.
          </p>
          <table>
            <thead>
              <tr><th>System</th><th>Format</th><th>Sample rate</th><th>Channels</th></tr>
            </thead>
            <tbody>
              <tr><td>3CX</td><td>WAV PCM 16-bit</td><td>8 kHz</td><td>Mono</td></tr>
              <tr><td>Asterisk / FreePBX</td><td>WAV PCM 16-bit (or .sln)</td><td>8 kHz (16 kHz for wideband)</td><td>Mono</td></tr>
              <tr><td>Cisco CUCM / Unity</td><td>WAV, CCITT µ-law 8-bit</td><td>8 kHz</td><td>Mono</td></tr>
              <tr><td>Twilio</td><td>WAV or MP3 (transcoded)</td><td>8 kHz recommended</td><td>Mono</td></tr>
              <tr><td>RingCentral</td><td>WAV or MP3</td><td>8 kHz recommended</td><td>Mono</td></tr>
              <tr><td>Microsoft Teams Phone</td><td>WAV, MP3, WMA</td><td>Any; 8–16 kHz recommended</td><td>Mono</td></tr>
              <tr><td>Zoom Phone</td><td>WAV or MP3</td><td>8 kHz recommended</td><td>Mono</td></tr>
              <tr><td>Grandstream UCM</td><td>WAV PCM 16-bit</td><td>8 kHz</td><td>Mono</td></tr>
            </tbody>
          </table>

          <h2 id="convert">How to convert a file in two steps</h2>
          <ol>
            <li>
              <strong>Make it mono.</strong> Open the{" "}
              <Link href="/mono-stereo-converter">Mono/Stereo Converter</Link>,
              upload your file, choose <em>Stereo to mono</em>, download.
            </li>
            <li>
              <strong>Resample to 8 kHz, 16-bit WAV.</strong> Open the{" "}
              <Link href="/sample-rate-converter">Sample Rate Converter</Link>,
              upload the mono file, pick <em>8 kHz</em> (or <em>16 kHz</em> if
              your system supports wideband), set bit depth to <em>16-bit</em>,
              output WAV, download.
            </li>
          </ol>
          <p>
            Both tools run in the browser, no account, no install. The whole
            thing takes under a minute. If you have a batch of prompts, do the
            mono step on all of them first, then the resample step — it&apos;s
            faster than alternating.
          </p>

          <h2 id="loudness">Getting the level right</h2>
          <p>
            Phone audio is quiet by design, and a hold-music file mastered at
            modern streaming loudness will clip and buzz through the codec.
            Before converting, aim for peaks around <strong>−6 to −3 dBFS</strong>{" "}
            and no heavy limiting — the{" "}
            <Link href="/loudness-normalizer">Loudness Normalizer</Link> set to
            around −16 LUFS is a safe target. Voice prompts should be a touch
            louder than music beds so they cut through.
          </p>

          <h2 id="common-errors">Common errors and what they mean</h2>
          <ul>
            <li>
              <strong>&ldquo;Invalid file format&rdquo; / &ldquo;File not supported&rdquo;</strong> —
              usually a compressed WAV (ADPCM, MP3-in-WAV) or wrong sample rate.
              Re-export as plain PCM at 8 kHz.
            </li>
            <li>
              <strong>Sped-up, chipmunk audio</strong> — a 44.1 or 48 kHz file
              being played as 8 kHz. Resample it.
            </li>
            <li>
              <strong>Slow, deep audio</strong> — the reverse: an 8 kHz file
              tagged as 44.1 kHz. Re-convert from the original.
            </li>
            <li>
              <strong>Only one side plays / sounds thin</strong> — stereo file on
              a system that reads the left channel only. Convert to mono first.
            </li>
            <li>
              <strong>Crackle or buzz on loud parts</strong> — file is too hot for
              the codec. Lower the level, don&apos;t limit harder.
            </li>
          </ul>

          <h2 id="8-vs-16">8 kHz or 16 kHz?</h2>
          <p>
            8 kHz works everywhere and is what callers on the public phone network
            hear regardless. 16 kHz (wideband, G.722, &ldquo;HD voice&rdquo;) only
            helps for calls that stay inside your own system — desk phone to desk
            phone, or a softphone app — and only if the system is configured for
            it. When in doubt, use 8 kHz.
          </p>
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