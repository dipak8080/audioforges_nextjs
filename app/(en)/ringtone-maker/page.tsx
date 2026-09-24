import type { Metadata } from "next";
import Link from "next/link";
import { RingtoneForm } from "@/components/converter/RingtoneForm";
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
import { getToolLimits } from "@/lib/data/tool-limits";
import { getLimits, retentionSentences } from "@/lib/api/limits";
import { ogForTool } from "@/lib/og";

/**
 * THE LENGTH IS APPLE'S, AND IT'S LOAD-BEARING.
 *
 * Verified against support.apple.com/en-us/120692 ("Create a custom ringtone
 * on your iPhone", 22 May 2025): ringtones can be up to 30 seconds, and at the
 * export step anything longer prompts GarageBand to shorten it AUTOMATICALLY.
 *
 * That silent truncation is why the figure matters more than a cosmetic cap.
 * An over-length clip doesn't fail loudly — the section someone carefully
 * chose simply isn't the section they end up with, and nothing tells them.
 *
 * The fallback below is 30 for the same reason. It used to be 40, which meant
 * a missing entry would silently restore the exact wrong value this was
 * corrected from. Everything on this page — the strip, the how-to step, three
 * FAQ answers, the schema — renders from this one constant, and RingtoneForm
 * reads the same source, so the control and the copy can't disagree.
 */
const MAX_RINGTONE_SECONDS = getToolLimits("ringtone-maker")?.maxTotalDurationSeconds ?? 30;

/**
 * TITLE PHRASING IS DELIBERATE. The keyword cluster here is four phrases:
 * "ringtone maker", "free ringtone maker", "iphone ringtone maker",
 * "ringtone maker for iphone". The old "Free iPhone Ringtone Maker" contained
 * the first and third but broke the word order on the other two. "Free
 * Ringtone Maker for iPhone" contains all four as contiguous substrings while
 * still reading as a phrase. Don't reorder it.
 *
 * "mp3 ringtone maker" is covered in body copy rather than the title —
 * forcing it in would break the phrasing that wins the other four.
 */
const PAGE_TITLE = "Free Ringtone Maker for iPhone – MP3 to M4R";
const PAGE_DESCRIPTION = `Free ringtone maker for iPhone. Turn any MP3 into an M4R ringtone online — pick your start point, up to ${MAX_RINGTONE_SECONDS} seconds, no iTunes, no sign-up, no watermark.`;

const UPDATED = "2026-09-10";

const OG_IMAGE = ogForTool("ringtone-maker", "Free Ringtone Maker for iPhone");

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/ringtone-maker` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/ringtone-maker`,
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

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.

export default async function RingtoneMakerPage() {
  const relatedTools = getRelatedTools("ringtone-maker", 5);

  const limits = await getLimits();
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  // Every claim below is checked against actual RingtoneForm/backend
  // behaviour. The length comes from the same constant the form enforces
  // rather than being typed — which is what let the two disagree before.
  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Ringtone Maker",
    url: `${SITE_URL}/ringtone-maker`,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      `Trims to a ringtone-length clip (up to ${MAX_RINGTONE_SECONDS} seconds)`,
      "Outputs M4R, the extension iOS associates with ringtones",
      `Accepts ${formatList} sources`,
      "No sign-up required",
      "No watermark",
    ],
  };

  const faqs = [
    {
      question: "How do I actually get it onto my iPhone?",
      answer:
        "You can use the .m4r file with an iPhone ringtone workflow such as GarageBand, Apple's current instructions cover importing an audio file into GarageBand, trimming it to a ringtone, and exporting it as one. Steps can vary by iOS version, so it's worth checking Apple's current instructions for your device.",
    },
    {
      /*
        States Apple's figure directly because it's verified, not assumed. The
        automatic-shortening detail is the part worth including: an over-length
        ringtone isn't rejected, it's silently truncated at export, so someone
        who picked their seconds carefully would never learn why the clip
        changed.
      */
      question: `Why is there a ${MAX_RINGTONE_SECONDS}-second limit?`,
      answer: `Apple's own limit. Its instructions for creating a ringtone in GarageBand say ringtones can be up to 30 seconds, and at the export step anything longer prompts GarageBand to shorten it automatically, so an over-length clip isn't rejected, it's quietly trimmed for you. Capping the selection here at ${MAX_RINGTONE_SECONDS} seconds means the section you pick is the section you keep.`,
    },
    {
      question: "Can I make a ringtone from a TikTok or YouTube sound?",
      answer: `Yes, in two steps: pull the audio out first with the TikTok to MP3 converter or the YouTube to WAV converter, then upload that file here and pick your ${MAX_RINGTONE_SECONDS} seconds.`,
      answerNode: (
        <>
          Yes, in two steps: pull the audio out first with the{" "}
          <Link href="/tiktok-to-mp3" className="text-amber-400 hover:underline">
            TikTok to MP3 converter
          </Link>{" "}
          , the{" "}
          <Link href="/youtube-to-mp3" className="text-amber-400 hover:underline">
            YouTube to MP3 converter
          </Link>{" "}
          or the{" "}
          <Link href="/youtube-to-wav" className="text-amber-400 hover:underline">
            YouTube to WAV converter
          </Link>
          , then upload that file here and pick your section.{" "}
          <Link
            href="/guides/tiktok-sound-to-ringtone"
            className="text-amber-400 hover:underline"
          >
            Read How to Make a Ringtone from a TikTok Sound
          </Link>{" "}
          for the full walkthrough.
        </>
      ),
    },
    {
      question: "Can I use this for Android instead?",
      answer:
        "Android doesn't require the .m4r extension or a length cap the way iOS does, for Android, use the Audio Converter to export an MP3 of the clip you want instead.",
      answerNode: (
        <>
          Android doesn&apos;t require the .m4r extension or a length cap the way
          iOS does, for Android, use the{" "}
          <Link href="/convert" className="text-amber-400 hover:underline">
            Audio Converter
          </Link>{" "}
          to export an MP3 of the clip you want instead.
        </>
      ),
    },
    {
      question: "Can I add a fade in or out to my ringtone?",
      answer:
        "Yes, make the ringtone here first, then run the downloaded file through the Fade In/Out tool if you want a softer start or end.",
      answerNode: (
        <>
          Yes, make the ringtone here first, then run the downloaded file
          through the{" "}
          <Link href="/fade" className="text-amber-400 hover:underline">
            Fade In/Out
          </Link>{" "}
          tool if you want a softer start or end.
        </>
      ),
    },
    {
      question: "Is there a file size limit for the source file?",
      answer: `Yes, ${limits.maxUploadMb}MB for the file you upload, the output ringtone itself will be much smaller.`,
    },
    {
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
  ];

  const capSeconds = MAX_RINGTONE_SECONDS;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Ringtone Maker" }]} />}
        meta={["No account", `${capSeconds} s cap, iPhone's rule`, "Real .m4r out"]}
        title="iPhone Ringtone Maker"
        lede={`Pick a window of up to ${capSeconds} seconds on the waveform and download it as a real .m4r, the only format iPhone accepts for ringtones. Free, no sign-up.`}
        tool={<RingtoneForm />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Output",
              value: ".m4r, AAC in an MPEG-4 container",
              note: "Which is what iPhone requires. An MP3 renamed to .m4r does not work; this writes the real thing.",
            },
            {
              label: "Selection",
              value: `A window of up to ${capSeconds} s, dragged on the waveform`,
              note: "The cap is iOS's, not ours. The window is held at the limit automatically so you cannot export something the phone rejects.",
            },
            {
              label: "Limits",
              value: `${limits.maxUploadMb}MB per source file`,
              note: `${formatList} in. Uploads are deleted on completion.`,
            },
          ]}
        />

        <ToolSection id="onto-phone" title="Getting it onto the phone" bleed>
          <CompareTable
            columns={["What to do"]}
            highlight={-1}
            rows={[
              { label: "iPhone, with a Mac or PC", cells: [{ state: "yes", text: "Connect the phone, open Finder (Mac) or iTunes (Windows), drag the .m4r onto the device. It appears under Settings, Sounds" }] },
              { label: "iPhone, no computer", cells: [{ state: "partial", text: "Open the .m4r in GarageBand on the phone, share it as a ringtone. Apple moves this around between iOS versions, so check the current steps" }] },
              { label: "Android", cells: [{ state: "partial", text: "No .m4r and no length cap needed. Trim the clip and export MP3 with the converter, then set it from Settings, Sound" }] },
            ]}
            footnote="Want a soft start or end? Make the ringtone here, then run the .m4r through Fade In / Out."
          />
          <Prose className="mt-5">
            <p>
              Sound is on TikTok or YouTube? <Link href="/tiktok-to-mp3">TikTok to MP3</Link> or{" "}
              <Link href="/youtube-to-mp3">YouTube to MP3</Link> first, then upload the file here.{" "}
              <Link href="/guides/tiktok-sound-to-ringtone">The TikTok to ringtone guide</Link> walks the whole
              path. For Android, <Link href="/trim">Trim</Link> then <Link href="/convert">convert to MP3</Link>.
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