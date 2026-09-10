import type { Metadata } from "next";
import Link from "next/link";
import { ConvertForm } from "@/components/converter/ConvertForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { Prose } from "@/components/ui/Prose";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { ProofStrip } from "@/components/tools/ProofStrip";
import { CompareTable } from "@/components/tools/CompareTable";
import { BitrateChainDiagram } from "@/components/tools/BitrateChainDiagram";
import { PageByline } from "@/components/tools/PageByline";
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
const PAGE_TITLE = "WAV to MP3 Converter – Files 4× Smaller, Online";
const PAGE_DESCRIPTION =
  "Convert WAV to MP3 free online — shrink a large, uncompressed WAV into a small MP3 you can email, upload or fit on a phone. No sign-up, no app.";

const UPDATED = "2026-09-10";

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
  dateModified: UPDATED,
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
  ["3-minute song", "~30 MB", "~7 MB"],
  ["10-minute recording", "~100 MB", "~24 MB"],
  ["1-hour podcast", "~600 MB", "~140 MB"],
];



export default async function WavToMp3Page() {
  const relatedTools = getRelatedTools("convert", 5);
  const limits = await getLimits();
  const retention = retentionSentences(limits.retention.audio_tools);

  const faqs = [
    // Exact-match long-tail first, each with a literal on-page answer.
    {
      question: "How much smaller is the MP3?",
      answer:
        "A lot. Uncompressed WAV runs about 10 MB per minute, while a 320 kbps MP3 is roughly 2.4 MB per minute, so the MP3 is around a quarter of the size, and smaller still at lower bitrates. A 60 MB WAV song becomes a ~7 MB MP3. That size drop is the main reason to convert.",
    },
    {
      question: "Does converting WAV to MP3 lose quality?",
      answer:
        "It's lossy, so technically yes, but at a sensible bitrate you won't hear it. WAV is uncompressed, and MP3 uses lossy compression that discards data your ears mostly can't detect. At 320 or 256 kbps the result is transparent for listening on headphones, phones, and speakers. What you lose isn't audible detail so much as the lossless property itself, which only matters if you're going to edit the file further.",
    },
    {
      question: "When should I keep the WAV instead?",
      answer:
        "Keep WAV whenever the audio is going to be processed rather than just played, editing in a DAW, sampling, DJing, mastering, or archiving. Every one of those benefits from lossless audio. Convert to MP3 when the file is finished and you just need to send it, upload it, or listen to it.",
    },
    {
      question: "Why is my WAV file so big?",
      answer:
        "Because WAV stores audio uncompressed, every sample is written out in full. That's what makes it ideal for editing, but it also makes the files huge, often larger than a whole video. MP3 compresses that down to a fraction of the size, which is why it's the format for emailing, uploading, and storing lots of tracks.",
    },
    {
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: "Can I pick a lower bitrate?",
      answer:
        "Not here. Output is fixed at 320 kbps, which is transparent for listening and the safe default. If you specifically need a smaller file at 192 or 128 kbps, that is a setting most desktop encoders expose; this tool does not, and it does not pretend to.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "WAV to MP3" }]} />}
        meta={["No account", "320 kbps CBR", "About a quarter the size"]}
        title="WAV to MP3 Converter"
        lede="Shrink a big uncompressed WAV into an MP3 you can email, upload or fit on a phone. 320 kbps, so you will not hear the difference. Free, no sign-up."
        tool={<ConvertForm defaultTarget="mp3" />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Output",
              value: "320 kbps CBR at the source rate",
              note: "The highest MP3 rate. Transparent for listening on headphones, phones and speakers. Not adjustable here.",
            },
            {
              label: "Size",
              value: "Roughly a quarter of the WAV",
              note: "A 30 MB song becomes about 7 MB. An hour of audio drops from about 600 MB to about 140 MB.",
            },
            {
              label: "Honest limit",
              value: "It is lossy, once",
              note: `You lose the lossless property, not audible detail. Keep the WAV if you will edit again. Up to ${limits.maxUploadMb}MB per upload.`,
            },
          ]}
        />

        <ToolSection id="chain" title="What 320 kbps keeps" bleed>
          <BitrateChainDiagram
            outputLabel="320 kbps MP3"
            outputWidth={310}
            ceilingNote="the master is the source here, so the ceiling is the full bar"
            caption="Unlike a YouTube or TikTok rip, the source here is the real thing: your WAV is the master. 320 kbps keeps everything an ear can pick out of it and discards what it cannot. The one thing you give up is the lossless property itself, which only matters if this file is going to be edited, pitched or re-exported later. For listening and sharing, it is the right trade every time."
          />
        </ToolSection>

        <ToolSection id="sizes" title="How much smaller, in practice" bleed>
          <CompareTable
            columns={["WAV", "MP3 at 320 kbps"]}
            highlight={1}
            rows={SIZE_ROWS.map(([len, wav, mp3]) => ({
              label: len,
              cells: [
                { text: wav, mono: true },
                { text: mp3, mono: true },
              ],
            }))}
            footnote="WAV runs about 10 MB a minute at 48 kHz stereo; 320 kbps MP3 runs about 2.4 MB a minute regardless of sample rate."
          />
          <Prose className="mt-5">
            <p>
              Keep the WAV when the file is headed into a DAW, a sampler, a CD burner or another round of editing.
              Convert when it is headed to a phone, an email, an upload form or a car. After the MP3:{" "}
              <Link href="/trim">trim it</Link>, <Link href="/volume">adjust the volume</Link>, or{" "}
              <Link href="/audio-to-text">transcribe it</Link>. Going the other way?{" "}
              <Link href="/mp3-to-wav">MP3 to WAV</Link> is the same converter with WAV preselected.
            </p>
          </Prose>
        </ToolSection>

        <FAQSection faqs={faqs} />

        <RelatedToolsGrid tools={relatedTools} />

        <PageByline
          updated={UPDATED}
          legal="You are responsible for having the right to process any file you upload. AudioForges does not host or distribute the files processed here."
        />
      </ToolPageShell>
    </>
  );
}