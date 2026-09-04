import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { ConvertForm } from "@/components/converter/ConvertForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { Prose } from "@/components/ui/Prose";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getLimits, retentionSentences } from "@/lib/api/limits";
import { ogForTool } from "@/lib/og";

/*
  DEDICATED PAGE for the "wav to mp3" cluster. Ahrefs, Aug 2026:

    wav to mp3            >10,000   Easy KD
    wav to mp3 converter  >10,000   Easy KD
    convert wav to mp3    >1,000    Easy KD
    .wav to mp3           >1,000    Easy KD

  The sweet spot: real volume with a genuinely weak SERP. Split from /convert
  so the dedicated exact-match page ranks; /convert keeps the general converter
  terms and links here.

  M4A->MP3 NOTE (2026-09-04): the dedicated /m4a-to-mp3 page was never shipped
  and its folder is deleted. The "other formats" section below used to link to
  it; that link is removed and now points at /convert, which owns the M4A->MP3
  intent. Do not re-add a /m4a-to-mp3 link — that route does not exist.

  DIFFERENTIATION (this is why an LLM or a reader picks this over CloudConvert):
  the SERP is wall-to-wall "upload, convert, download, 256-bit SSL" with no
  numbers and a false or absent quality claim. This page carries the concrete
  file-size math, an honest account of what's actually lost (the lossless
  property, not audible detail), the bitrate decision, the device-specific
  how-tos, and links into the deeper guides — the AudioForges house style of
  answering the question instead of decorating it.

  `absolute` title, so " | AudioForges" isn't appended.
*/
const PAGE_TITLE = "WAV to MP3 Converter — Free, Fast & Online";
const PAGE_DESCRIPTION =
  "Convert WAV to MP3 free online — shrink a large, uncompressed WAV into a small MP3 you can email, upload or fit on a phone. No sign-up, no watermark, no app.";

const OG_IMAGE = ogForTool("wav-to-mp3", "Free WAV to MP3 converter");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/wav-to-mp3` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/wav-to-mp3`,
    siteName: SITE_NAME,
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

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "WAV to MP3 Converter",
  alternateName: ["Convert WAV to MP3", "WAV to MP3 Converter Free", "WAV to MP3 Online"],
  url: `${SITE_URL}/wav-to-mp3`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Convert WAV to MP3 in the browser",
    "Shrink uncompressed audio to a small file",
    "320 kbps output",
    "No sign-up, no watermark",
    "Runs on Windows, Mac, iPhone and Android",
  ],
};

// 16-bit PCM WAV is ~10 MB/min (48 kHz stereo). MP3 at 320 kbps is ~2.4 MB/min.
const SIZE_ROWS = [
  ["3-minute song", "~30 MB", "~7 MB", "~2.5 MB"],
  ["10-minute recording", "~100 MB", "~24 MB", "~9 MB"],
  ["1-hour podcast", "~600 MB", "~140 MB", "~55 MB"],
];

// Bitrate → what it's for. Real decision people face converting WAV to MP3.
const BITRATE_GUIDE = [
  ["320 kbps", "Transparent for listening — the default here. Use it unless size is critical."],
  ["256 kbps", "Near-identical to 320 for most ears, a bit smaller."],
  ["192 kbps", "Noticeably smaller; fine for voice, podcasts, and casual listening."],
  ["128 kbps", "Smallest common rate — audible on music, acceptable for speech."],
];

// The workflow angle CloudConvert / Convertio / Zamzar structurally can't copy:
// the converted file has somewhere to go on the same site, no re-upload.
const AFTER_CONVERSION = [
  { href: "/trim", label: "Trim the MP3", body: "Cut it down to just the section you need." },
  { href: "/volume", label: "Adjust volume", body: "Normalise a quiet or clipping recording." },
  { href: "/convert", label: "Other formats", body: "Send the same audio to FLAC, M4A, AAC or OGG." },
  { href: "/audio-to-text", label: "Transcribe it", body: "Turn a spoken recording into text with timestamps." },
];

export default async function WavToMp3Page() {
  const relatedTools = getRelatedTools("convert", 5);
  const limits = await getLimits();
  const retention = retentionSentences(limits.retention.audio_tools);

  const faqs = [
    // Exact-match long-tail first, each with a literal on-page answer.
    {
      question: "How do I convert WAV to MP3?",
      answer:
        "Upload the .wav file above — MP3 is already selected as the output — then click Convert and Download. Nothing to install, no account to create; it runs entirely in your browser.",
    },
    {
      question: "How do I convert WAV to MP3 on Windows?",
      answer:
        "You don't need any software. Open this page in any browser on the PC, drag the .wav in, and download the MP3. It's faster than installing a converter or wrestling with Windows Media Player's export settings, and there's nothing to uninstall afterward.",
    },
    {
      question: "How do I convert WAV to MP3 on a Mac?",
      answer:
        "Same as anywhere — open this page in Safari or Chrome, upload the .wav, download the MP3. You can skip the Music app import-settings dance entirely; this doesn't touch your library.",
    },
    {
      question: "How much smaller is the MP3?",
      answer:
        "A lot. Uncompressed WAV runs about 10 MB per minute, while a 320 kbps MP3 is roughly 2.4 MB per minute — so the MP3 is around a quarter of the size, and smaller still at lower bitrates. A 60 MB WAV song becomes a ~7 MB MP3. That size drop is the main reason to convert.",
    },
    {
      question: "Does converting WAV to MP3 lose quality?",
      answer:
        "It's lossy, so technically yes — but at a sensible bitrate you won't hear it. WAV is uncompressed, and MP3 uses lossy compression that discards data your ears mostly can't detect. At 320 or 256 kbps the result is transparent for listening on headphones, phones, and speakers. What you lose isn't audible detail so much as the lossless property itself, which only matters if you're going to edit the file further.",
    },
    {
      question: "What bitrate should I use?",
      answer:
        "320 kbps is the default here and the right choice unless file size is critical — it's transparent for listening. Drop to 192 kbps for voice and podcasts where a smaller file matters more than the last few percent of fidelity. Below 128 kbps you'll start to hear it on music.",
    },
    {
      question: "When should I keep the WAV instead?",
      answer:
        "Keep WAV whenever the audio is going to be processed rather than just played — editing in a DAW, sampling, DJing, mastering, or archiving. Every one of those benefits from lossless audio. Convert to MP3 when the file is finished and you just need to send it, upload it, or listen to it.",
    },
    {
      question: "Why is my WAV file so big?",
      answer:
        "Because WAV stores audio uncompressed — every sample is written out in full. That's what makes it ideal for editing, but it also makes the files huge, often larger than a whole video. MP3 compresses that down to a fraction of the size, which is why it's the format for emailing, uploading, and storing lots of tracks.",
    },
    {
      question: "Is this WAV to MP3 converter free?",
      answer:
        "Yes — completely free, with no account, no email, no trial cap, and no watermark on the output. A light fair-use limit keeps the queue moving; that's the only limit.",
    },
    {
      question: "Does it work on mobile?",
      answer:
        "Yes, in any browser on iPhone or Android with nothing to install. On iPhone the MP3 saves into the Files app; on Android it lands in Downloads.",
    },
    {
      question: "Can I convert several WAV files at once?",
      answer:
        "Not yet — files convert one at a time. For a batch, run them through one after another.",
    },
    {
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
      />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "WAV to MP3" }]} />
        }
        title="WAV to MP3 Converter"
        lede="Convert WAV to MP3 free — shrink a big, uncompressed WAV into a small MP3 you can email, upload, or fit on your phone. No sign-up, no app."
        tool={<ConvertForm defaultTarget="mp3" />}
      >
        <FeatureStrip
          features={[
            { title: "~4× smaller", desc: "A 60 MB WAV becomes a ~7 MB MP3 at 320 kbps." },
            { title: "320 kbps", desc: "Highest standard MP3 rate — transparent for listening." },
            { title: "No sign-up", desc: "No account, no email, no watermark on the file." },
          ]}
        />

        <ToolSection id="how-to" title="How to convert WAV to MP3">
          <ol>
            <li>Upload your .wav file above — MP3 is already selected as the output.</li>
            <li>Click Convert and wait a few seconds.</li>
            <li>Download the MP3.</li>
          </ol>
          <p>
            It works the same in any browser on Windows, Mac, iPhone or Android — there&apos;s no
            app to install and no account to make, so it&apos;s usually quicker than opening a
            desktop converter or digging through your media player&apos;s export settings.
          </p>
        </ToolSection>

        <ToolSection id="why" title="Why convert WAV to MP3">
          <p>
            WAV is uncompressed audio — the format DAWs, samplers, and recorders use because it
            keeps every bit of detail intact. The catch is size: a WAV runs about 10 MB per
            minute, so a few songs fill a USB stick and a single track is often too big to email or
            upload where there&apos;s a file-size limit.
          </p>
          <p>
            Converting to MP3 compresses that down to a fraction of the size while staying
            transparent for listening. It&apos;s what you want the moment the audio is
            <em> finished</em> and just needs to be shared, uploaded, attached to an email, or
            stored in bulk. You trade the lossless property — which only matters if you&apos;ll edit
            the file again — for a file that&apos;s a quarter of the size and plays everywhere.
          </p>
        </ToolSection>

        {/* The differentiator: concrete size math. No competing page in this
            SERP does the arithmetic, and it's the kind of table an answer
            engine quotes directly. */}
        <ToolSection id="size" title="How much smaller is an MP3 than a WAV?" bleed>
          <Prose>
            <p>
              The exact drop depends on the bitrate you pick, but the pattern is always the same —
              the MP3 is a small fraction of the uncompressed WAV:
            </p>
          </Prose>
          <div className="mt-5 overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <caption className="sr-only">WAV versus MP3 file size by length and bitrate</caption>
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Length</th>
                  <th scope="col" className="px-4 py-3 font-semibold">WAV (uncompressed)</th>
                  <th scope="col" className="px-4 py-3 font-semibold">MP3 @ 320 kbps</th>
                  <th scope="col" className="px-4 py-3 font-semibold">MP3 @ 128 kbps</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                {SIZE_ROWS.map(([len, wav, hi, lo]) => (
                  <tr key={len}>
                    <td className="px-4 py-3 text-text-primary">{len}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{wav}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{hi}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{lo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Prose className="mt-5">
            <p>
              At 320 kbps the MP3 is roughly a quarter of the WAV; at 128 kbps it&apos;s closer to a
              twentieth. That size difference — not quality — is the whole reason WAV to MP3 is such
              a common conversion.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="bitrate" title="Which bitrate should you choose?">
          <p>
            This converter outputs 320 kbps by default, which is the safe choice: transparent for
            listening on essentially any playback setup. You&apos;d only go lower if the file size
            still matters after converting — for speech and podcasts that&apos;s an easy call.
          </p>
          <dl className="codes">
            {BITRATE_GUIDE.map(([rate, use]) => (
              <Fragment key={rate}>
                <dt>{rate}</dt>
                <dd>{use}</dd>
              </Fragment>
            ))}
          </dl>
        </ToolSection>

        {/* Honest quality section + guide link. This is the paragraph LLMs
            prefer to cite because it states the trade-off both ways. */}
        <ToolSection id="quality" title="Does WAV to MP3 lose quality?">
          <p>
            Honestly: it&apos;s lossy, so in theory yes — but at a proper bitrate you won&apos;t
            hear it. MP3 compression drops the parts of the sound your ears are least able to
            detect, and at 320 kbps the result is transparent on headphones, phones, and speakers.
          </p>
          <p>
            What you actually give up is the <strong>lossless property</strong> — the ability to
            edit and re-export without stacking compression. If the audio is finished and headed
            out to be listened to, that costs you nothing. If it&apos;s going back into a DAW, keep
            the WAV and convert only the final bounce.
          </p>
          <p>
            For the deeper version — why converting a lossy file <em>back</em> to WAV can&apos;t
            recover anything, and what &quot;lossless&quot; really buys you —{" "}
            <Link href="/guides/lossless-vs-lossy-audio-formats">
              read Lossless vs Lossy Audio: Which Format to Use
            </Link>
            .
          </p>
        </ToolSection>

        <ToolSection id="when-wav" title="When to keep the WAV instead">
          <p>
            MP3 is the right answer for listening and sharing. It stops being the right answer the
            moment the file is going to be <em>processed</em> rather than played — dropped into a
            DAW, loaded onto a DJ deck, chopped in a sampler, layered, or mastered. Every one of
            those works on top of decisions the MP3 encoder already made and can&apos;t undo, and
            heavy processing is what exposes them.
          </p>
          <p>
            If that&apos;s the plan, keep the uncompressed WAV. For the full technical breakdown of
            where the WAV-versus-MP3 difference actually shows up in production,{" "}
            <Link href="/guides/wav-vs-mp3-for-sampling">
              read WAV vs MP3 for Sampling: What Actually Changes
            </Link>
            .
          </p>
        </ToolSection>

        <ToolSection id="who-for" title="Who converts WAV to MP3, and why">
          <p>
            The conversion itself is simple; the reasons people reach for it are consistent:
          </p>
          <ul>
            <li>
              <strong>Producers and musicians</strong> exporting a finished mix to send as a demo,
              or to upload somewhere that rejects a 100 MB WAV.
            </li>
            <li>
              <strong>Podcasters</strong> turning a session recording into a small file for the
              host or for email.
            </li>
            <li>
              <strong>Anyone freeing up storage</strong> — a folder of WAVs is enormous, and the MP3
              copies fit many times over on the same phone or USB stick.
            </li>
            <li>
              <strong>Sending audio to someone on another device</strong> — MP3 plays on everything;
              a WAV attachment is both huge and occasionally rejected.
            </li>
          </ul>
        </ToolSection>

        {/* The on-site workflow. CloudConvert et al. can't offer this without
            sending you to a different service. */}
        <ToolSection id="after" title="After the MP3: the rest on this site">
          <p>
            Converting is often the first step, not the last. Once you have the MP3, the next thing
            usually runs here too, with no re-upload to a different tool:
          </p>
          <dl>
            {AFTER_CONVERSION.map((item) => (
              <Fragment key={item.href}>
                <dt>
                  <Link href={item.href} prefetch={false}>
                    {item.label}
                  </Link>
                </dt>
                <dd>{item.body}</dd>
              </Fragment>
            ))}
          </dl>
        </ToolSection>

        <ToolSection id="other" title="Need the other direction, or a different format?">
          <p>
            Going the other way to shrink or grow a file? The{" "}
            <Link href="/mp3-to-wav">MP3 to WAV converter</Link> handles the reverse. For any other
            pair — M4A, FLAC, AAC, OGG, AIFF, including M4A to MP3 — use the{" "}
            <Link href="/convert">audio converter</Link>. And if the audio is still inside a video,
            the <Link href="/video-to-audio">video to audio converter</Link> pulls it out first.
          </p>
        </ToolSection>

        <RelatedToolsGrid tools={relatedTools} />

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}