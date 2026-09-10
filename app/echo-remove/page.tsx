import type { Metadata } from "next";
import Link from "next/link";
import { EchoRemoveForm } from "@/components/converter/EchoRemoveForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { Prose } from "@/components/ui/Prose";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { ProofStrip } from "@/components/tools/ProofStrip";
import { CompareTable } from "@/components/tools/CompareTable";
import { PageByline } from "@/components/tools/PageByline";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { ogForTool } from "@/lib/og";
import {
  getLimits,
  durationCapFor,
  durationLabel,
  retentionSentences,
} from "@/lib/api/limits";

/*
  TITLE. Volumes NOT yet pulled from Bing Keyword Research — verify these and
  record the figures here:

    echo remover · remove echo from audio · remove echo · ai echo remover ·
    reverb remover · echo remover online

  What IS measured: a crawl of the live SERP (Sep 2026) — screenapp.io,
  voice.ai, audiocleaner.ai, tordar.ai, aivoicecleaner.io. Two patterns:

  1. "Remove echo from audio" is the phrasing every competitor titles on. The
     old 17-character "Free Echo Remover" contained neither that phrase nor
     anything else, and left most of the title budget unspent.

  2. Every one of them leads with "AI" and claims reverb removal. We do
     NEITHER, and must not: this is ffmpeg gating trailing reflections, not a
     dereverb model, and the page says so in three places. Matching their
     copy would be the one lie on a site whose whole position is not lying.

  That is worth stating plainly rather than working around: on the head terms
  this page competes against tools claiming a capability it does not have. The
  title fix closes a real gap; it does not make this page competitive with a
  dereverb model. If echo ever becomes worth investing in, the answer is a
  better backend, not better copy.
*/
const PAGE_TITLE = "Echo Remover – Remove Echo from Audio Online, Free";
const SOCIAL_TITLE = "Free Echo Remover – Reduce Echo & Slap-Back in Recordings";
const PAGE_DESCRIPTION =
  "Remove echo from audio online, free. Cuts room echo and slap-back in voice recordings, podcasts and Zoom calls. No sign-up, no watermark.";

const UPDATED = "2026-09-10";

const OG_IMAGE = ogForTool("echo-remove", "Free Echo Remover");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/echo-remove` },
  openGraph: {
    title: SOCIAL_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/echo-remove`,
    siteName: SITE_NAME,
    type: "website",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SOCIAL_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Echo Remover",
  // No "Reverb Remover" — that is the claim every competitor makes and this
  // tool does not do it. See the title comment.
  alternateName: ["Echo Remover", "Remove Echo from Audio", "Slap-Back Remover"],
  url: `${SITE_URL}/echo-remove`,
  dateModified: UPDATED,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Reduces mild room echo",
    "Reduces repeated/slap echo",
    "No sign-up required",
    "No watermark",
  ],
};

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.

// Every figure comes from /limits. The old hand-written sentence here said
// "up to 80MB and 20 minutes" — the size was right, the length wrong by forty
// minutes. It was one true sentence from the transcription guide copied into
// six pages where it wasn't true.
export default async function EchoRemovePage() {
  const relatedTools = getRelatedTools("echo-remove", 5);

  const limits = await getLimits();
  const durationCap = durationCapFor(limits, "echo-remove");
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const faqs = [
    {
      question: "Does this fully remove echo?",
      answer:
        "It reduces mild room echo and repeated slap-back echo well, but it doesn't perform full acoustic dereverberation, heavy reverb from a large or empty room won't be fully eliminated.",
    },
    {
      question: "What's the difference between echo, reverb, and slap-back?",
      answer:
        "Slap-back is a single, distinct repeat off a hard surface, common in small tiled or hard-walled rooms. Reverb is the accumulated wash of countless overlapping reflections in a larger space, without a single clear repeat. This tool handles slap-back and mild room echo well; it isn't designed for heavy reverb.",
    },
    {
      question: "Can I remove echo from Zoom or phone recordings?",
      answer:
        "Yes, phone recordings, Zoom calls, and voice memos with mild room echo are exactly the kind of source material this tool handles well.",
    },
    {
      question: "What kind of echo does this work best on?",
      answer:
        "Mild room echo on speech recordings and repeated/slap echo. It's not designed for cleaning heavy reverb from concert halls or large empty spaces.",
    },
    {
      question: "What formats are supported, and is there a size limit?",
      answer:
        durationCap === null
          ? `${formatList}, up to ${limits.maxUploadMb}MB per upload.`
          : `${formatList}, up to ${limits.maxUploadMb}MB and ${durationLabel(durationCap)} long.`,
    },
    {
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
  ];
  const limitLabel =
    durationCap === null ? `${limits.maxUploadMb}MB per upload` : `${limits.maxUploadMb}MB and ${durationLabel(durationCap)}`;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Echo Remover" }]} />}
        meta={["No account", "Slap-back and mild room echo", "Not dereverb, and says so"]}
        title="Free Echo Remover"
        lede="Reduce slap-back and mild room echo in a recording. It gates trailing reflections; it does not undo heavy reverb, and this page will not pretend it does. Free, no sign-up."
        tool={<EchoRemoveForm />}
      >
        <ProofStrip
          proofs={[
            {
              label: "What it handles",
              value: "Slap-back and mild room echo",
              note: "Phone recordings, video calls, voice memos in a small hard-walled room. The single clear repeat off a wall.",
            },
            {
              label: "What it does not",
              value: "Heavy reverb from a large room",
              note: "That is a wash of overlapping reflections with no single repeat. Removing it takes a dereverb model, which this is not.",
            },
            {
              label: "Limits",
              value: limitLabel,
              note: `${formatList}. Output keeps your format. Uploads are deleted on completion.`,
            },
          ]}
        />

        <ToolSection id="which" title="Which cleaner for which problem" bleed>
          <CompareTable
            columns={["Best for", "What it actually does"]}
            highlight={-1}
            rows={[
              {
                label: "Noise Remover",
                cells: [
                  { text: "Hiss, hum, fan, traffic, on any audio" },
                  { state: "partial", text: "Denoise only, with a strength slider from 1 to 97" },
                ],
              },
              {
                label: "Voice Cleaner",
                cells: [
                  { text: "Speech: podcasts, interviews, voice memos" },
                  { state: "partial", text: "Fixed chain, no settings: rumble cut, speech-tuned denoise, loudness normalize" },
                ],
              },
              {
                label: "Echo Remover, this page",
                cells: [
                  { text: "Slap-back and mild room echo" },
                  { state: "yes", text: "Gates trailing reflections. Not a dereverb model; heavy room reverb stays" },
                ],
              },
            ]}
            footnote="Every competing echo remover leads with AI and claims reverb removal. This one runs an ffmpeg gate and claims what a gate can do."
          />
          <Prose className="mt-5">
            <p>
              Noise rather than echo? <Link href="/noise-remove">Noise Remover</Link> for anything, or{" "}
              <Link href="/voice-clean">Voice Cleaner</Link> for speech. If the problem is a big reverberant room,
              the honest fix is re-recording closer to the mic, and the{" "}
              <Link href="/voice-recorder">Voice Recorder</Link> is right here for that.
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