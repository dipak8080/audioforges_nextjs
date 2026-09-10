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
  DEDICATED PAGE for the "mp3 to wav" cluster. Ahrefs, Aug 2026:

    mp3 to wav            >10,000   Easy KD
    mp3 to wav converter  >1,000    Medium KD
    convert mp3 to wav    >1,000    Medium KD

  Easy head term, weak SERP — the same profile as /wav-to-mp3. Split from
  /convert; /convert is the general "audio converter" hub and no longer leads
  with "mp3 to wav", so the two don't compete.

  DIFFERENTIATION: MP3->WAV is the direction people get WRONG, and every
  competing page either stays silent or actively implies the WAV comes out
  higher quality. It doesn't — the MP3's discarded data is gone for good, and
  the WAV is just bigger. This page leads with that honesty and then gives the
  real reasons to convert anyway (software that needs WAV, editing without
  stacking compression). That honest framing is what an answer engine cites.

  M4A->MP3 NOTE (2026-09-04): no dedicated /m4a-to-mp3 page exists — that
  intent lives on /convert. The "other formats" section links M4A there. Do
  not add a /m4a-to-mp3 link; the route does not exist.

  `absolute` title, so " | AudioForges" isn't appended.
*/
const PAGE_TITLE = "MP3 to WAV Converter – Uncompressed Audio, Online";
const PAGE_DESCRIPTION =
  "Convert MP3 to WAV free online — an uncompressed WAV for editing, DAWs, or software that needs it. Honest note: it won't add quality back. No sign-up.";

const UPDATED = "2026-09-10";

const OG_IMAGE = ogForTool("mp3-to-wav", "Free MP3 to WAV converter");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/mp3-to-wav` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/mp3-to-wav`,
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
  name: "MP3 to WAV Converter",
  alternateName: ["Convert MP3 to WAV", "MP3 to WAV Converter Free", "MP3 to WAV Online"],
  url: `${SITE_URL}/mp3-to-wav`,
  dateModified: UPDATED,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Convert MP3 to WAV in the browser",
    "Uncompressed 16-bit PCM output",
    "Sample rate preserved from the source MP3",
    "No sign-up, no watermark",
    "Runs on Windows, Mac, iPhone and Android",
  ],
};




export default async function Mp3ToWavPage() {
  const relatedTools = getRelatedTools("convert", 5);
  const limits = await getLimits();
  const retention = retentionSentences(limits.retention.audio_tools);

  const faqs = [
    {
      question: "Does converting MP3 to WAV improve the quality?",
      answer:
        "No, and this is the most important thing to know. MP3 is lossy: when the file was first encoded, audio data was permanently discarded. Converting to WAV writes what's left out in an uncompressed container, but it can't recover anything that was thrown away. The WAV will be several times larger and sound exactly the same as the MP3. Anyone claiming MP3-to-WAV boosts quality is mistaken.",
    },
    {
      question: "How much bigger is the WAV?",
      answer:
        "Roughly four times larger than a 320 kbps MP3, and more against lower-bitrate MP3s. A 7 MB MP3 song becomes about a 30 MB WAV. Uncompressed audio runs about 10 MB per minute regardless of the source.",
    },
    {
      question: "What sample rate and bit depth is the WAV?",
      answer:
        "16-bit PCM. The sample rate follows the MP3 source (usually 44.1 kHz), so nothing is resampled, the WAV is a faithful uncompressed copy of the decoded MP3.",
    },
    {
      question: "My DAW won't import MP3, will a WAV fix that?",
      answer:
        "Yes. If your editor refuses MP3 or decodes it unreliably, converting to WAV first gives it the uncompressed file it expects. You're not gaining quality, the audio is whatever the MP3 already was, but you get a file the software will open cleanly and edit without transcoding it again.",
    },
    {
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "MP3 to WAV" }]} />}
        meta={["No account", "Decoded once", "Bigger, not better"]}
        title="MP3 to WAV Converter"
        lede="Turn an MP3 into an uncompressed WAV for software that needs one. Nothing is restored, and this page says so. Free, no sign-up."
        tool={<ConvertForm defaultTarget="wav" />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Output",
              value: "16-bit PCM at the source rate",
              note: "Usually 44.1 kHz, because that is what most MP3s are. Nothing is resampled. Need 48 kHz? Use the sample rate converter after.",
            },
            {
              label: "Honest limit",
              value: "No quality comes back",
              note: "The MP3 encoder already discarded what it discarded. WAV stops any further loss; it cannot undo the first one.",
            },
            {
              label: "Size",
              value: "About four times larger",
              note: `A 7 MB song becomes about 30 MB. Up to ${limits.maxUploadMb}MB per upload, deleted on completion.`,
            },
          ]}
        />

        <ToolSection id="chain" title="What the WAV actually contains" bleed>
          <BitrateChainDiagram
            outputLabel="WAV, 1,411 kbps"
            outputWidth={620}
            ceilingNote="what the MP3 kept is what the WAV holds"
            caption="An MP3 at 320 kbps sits well short of the master, and lower bitrates sit shorter. Decoding it to WAV writes the decoded samples out uncompressed, so the file grows to full width without gaining anything. That is not a flaw; it is the reason to do it. Every edit, pitch shift or re-export from here on works on the same audio with no second lossy pass, which is what a DAW, a sampler or a CD burner needs."
          />
        </ToolSection>

        <ToolSection id="needs-wav" title="What actually needs a WAV" bleed>
          <CompareTable
            columns={["Why MP3 does not work there"]}
            highlight={-1}
            rows={[
              { label: "CD burning", cells: [{ state: "yes", text: "Red Book audio is 16-bit 44.1 kHz PCM. Burning software wants WAV or AIFF so the disc plays in standalone players" }] },
              { label: "Broadcast and radio playout", cells: [{ state: "yes", text: "Station libraries standardise on uncompressed audio to avoid a second lossy pass over compressed source" }] },
              { label: "Hardware samplers, older editors", cells: [{ state: "yes", text: "Many read WAV natively and either refuse MP3 or decode it unreliably" }] },
              { label: "DAWs that re-encode on import", cells: [{ state: "yes", text: "Feeding them a WAV means one decode, up front, instead of one at every save" }] },
              { label: "DJ software and CDJs", cells: [{ state: "yes", text: "Some setups and older CDJ firmware want WAV for gapless, glitch-free playback" }] },
            ]}
            footnote="If none of these is you, keep the MP3. It sounds the same and is a quarter of the size."
          />
          <Prose className="mt-5">
            <p>
              After the WAV: <Link href="/trim">trim it</Link>, <Link href="/pitch">shift the pitch</Link>,{" "}
              <Link href="/tempo">change the tempo</Link>, or <Link href="/convert">send it to another format</Link>,
              all without another lossy generation. Going the other way?{" "}
              <Link href="/wav-to-mp3">WAV to MP3</Link> is the same converter with MP3 preselected.
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