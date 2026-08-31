import type { Metadata } from "next";
import Link from "next/link";
import { VoiceCleanForm } from "@/components/converter/VoiceCleanForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { Prose } from "@/components/ui/Prose";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { ogForTool } from "@/lib/og";
import {
  getLimits,
  durationCapFor,
  durationLabel,
  retentionSentences,
} from "@/lib/api/limits";

const PAGE_TITLE = "Free Voice Cleaner — Clean Up Podcasts & Voice Memos";
const PAGE_DESCRIPTION =
  "Clean voice recordings online free. Remove background noise, hiss, hum, and low-frequency rumble from podcasts, interviews, and voice memos. No sign-up.";

const OG_IMAGE = ogForTool("voice-clean", "Free Voice Cleaner");

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/voice-clean` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/voice-clean`,
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
  name: "Voice Cleaner",
  url: `${SITE_URL}/voice-clean`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Rumble/low-end cut",
    "Speech-tuned denoise",
    "Loudness normalization",
    "No sign-up required",
    "No watermark",
  ],
};

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.

/**
 * Every figure comes from /limits. The hand-written sentence here said "up to
 * 80MB and 20 minutes" — the real cap is an hour, and this is the page where
 * the understatement cost most: the audience is podcasts, interviews and
 * lectures, which is exactly the material that runs past twenty minutes.
 */
export default async function VoiceCleanPage() {
  const relatedTools = getRelatedTools("voice-clean", 5);

  const limits = await getLimits();
  const durationCap = durationCapFor(limits, "voice-clean");
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  // Includes "Will it reduce audio quality?", which used to exist in the schema
  // but was missing from the visible accordion — a real schema/content
  // mismatch. Both are fed from this one array now.
  const faqs = [
    {
      question: "What does the Voice Cleaner actually do?",
      answer:
        "It runs a three-stage chain tuned specifically for speech: cutting low-frequency rumble, applying speech-optimized noise reduction, then normalizing loudness — all in one click.",
    },
    {
      question: "Does it work on Zoom recordings or phone recordings?",
      answer:
        "Yes — any speech-only recording works, including calls, Zoom recordings, phone memos, and narration, since the chain is tuned for the voice frequency range generally, not one specific recording method.",
    },
    {
      question: "Does this remove echo or reverb?",
      answer:
        "No — echo and reverb are a different problem from noise, and this chain doesn't address them. Use the Echo Remover for mild room echo or slap-back.",
      answerNode: (
        <>
          No — echo and reverb are a different problem from noise, and this chain
          doesn&apos;t address them. Use the{" "}
          <Link href="/echo-remove" className="text-amber-400 hover:underline">
            Echo Remover
          </Link>{" "}
          for mild room echo or slap-back.
        </>
      ),
    },
    {
      question: "Is this different from a general noise remover?",
      answer:
        "Yes. This preset is tuned specifically for speech and has no settings to configure. For music or non-speech audio where you want to control the reduction strength yourself, use the Noise Remover instead.",
    },
    {
      question: "Is this really free?",
      answer: "Yes — completely free, no sign-up, no watermark on the output.",
    },
    {
      question: "What formats are supported, and is there a size limit?",
      answer:
        durationCap === null
          ? `${formatList}, up to ${limits.maxUploadMb}MB per upload.`
          : `${formatList}, up to ${limits.maxUploadMb}MB and ${durationLabel(durationCap)} long — enough for a full podcast episode or lecture recording in one pass.`,
    },
    {
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: "Will it change my voice?",
      answer:
        "No. It only affects background noise and loudness — it doesn't alter pitch, formants, or anything about how your voice actually sounds.",
    },
    {
      question: "Does it remove keyboard clicks or mouse clicks?",
      answer:
        "Not reliably. This chain is built for steady background noise like hiss, hum, and rumble — short, one-off sounds like keyboard clicks don't have a consistent noise profile for it to remove, so some may still come through.",
    },
    {
      question: "Can it remove breathing sounds?",
      answer:
        "Not specifically — breaths are close enough to speech frequencies that a general noise-reduction chain isn't built to isolate and remove them the way it removes steady background hiss or hum.",
    },
    {
      question: "Can I clean multiple files at once?",
      answer: "One file at a time — there's currently no batch upload option.",
    },
    {
      question: "Will it reduce audio quality?",
      answer:
        "No — it removes noise and evens out loudness without discarding quality from the rest of the recording.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Voice Cleaner" }]} />
        }
        title="Free Voice Cleaner"
        lede="One click to clean up a podcast, interview, or voice memo: rumble cut, speech-tuned denoise, and loudness normalization in one pass."
        tool={<VoiceCleanForm />}
      >
        {/* The limits sit in the strip because this page's audience — podcasts
            and lectures — is the one most likely to be near them. */}
        <FeatureStrip
          features={[
            { title: "One click", desc: "No settings to tune — just upload and clean." },
            { title: "Speech-tuned", desc: "Built specifically for voice, not music." },
            {
              title: "No sign-up",
              desc:
                durationCap === null
                  ? `No account, no email, no watermark. Up to ${limits.maxUploadMb}MB per file.`
                  : `No account, no email, no watermark. Up to ${limits.maxUploadMb}MB and ${durationLabel(durationCap)}.`,
            },
          ]}
        />

        <ToolSection id="why" title="Why clean up a voice recording?">
          <p>
            A clean voice recording is easier to understand and sounds noticeably
            more professional than one buried under hiss, hum, or rumble — the
            difference shows up immediately to a listener, even if they
            couldn&apos;t name what was wrong with the noisy version. Cleaning up
            background noise and evening out loudness helps podcasts, interviews,
            meeting recordings, narration, and voice memos all sound like they came
            from the same consistent setup, without touching how the speaker
            actually sounds.
          </p>
        </ToolSection>

        <ToolSection id="how-to" title="How to clean up a voice recording">
          <ol>
            <li>Upload an {formatList} speech recording.</li>
            <li>The chain runs automatically — rumble cut, denoise, then normalize.</li>
            <li>Download the cleaned result.</li>
          </ol>
        </ToolSection>

        <ToolSection id="what-it-fixes" title="What it fixes">
          <p>
            Most rough voice recordings share the same problems: low-frequency
            rumble from handling noise or AC hum, a hiss or hum sitting under the
            voice, and inconsistent loudness between takes. This tool runs a fixed
            chain built to fix exactly those issues — cut the rumble, denoise the
            rest, then normalize levels — with nothing to configure. Steady
            background sources like a computer fan, an air conditioner, or a
            microphone&apos;s own self-noise generally fall into that same
            hiss/hum/rumble category the chain is built to handle.
          </p>
          <p>
            <strong>Best for:</strong> podcasts, phone recordings, interviews, Zoom
            recordings, voice memos, narration, audiobooks, online courses,
            dictation, lectures, and any other speech-only audio. For music or
            general noise reduction with adjustable strength, use the{" "}
            <Link href="/noise-remove">Noise Remover</Link> instead.
          </p>
        </ToolSection>

        <ToolSection id="what-it-doesnt-fix" title="What this doesn't fix">
          <p>
            This chain targets rumble, hiss/hum, and loudness — it doesn&apos;t
            address echo or reverb, since that&apos;s a different kind of problem
            entirely (repeated or trailing reflections, rather than steady
            background noise). It also can&apos;t recover audio that&apos;s
            severely clipped or distorted at the source, separate two people
            talking over each other, or remove background music sitting under a
            voice — cleanup can improve a noisy recording, but it can&apos;t
            reconstruct data that was never captured or isolate speech from another
            full audio source layered underneath it. If echo is the issue, the{" "}
            <Link href="/echo-remove">Echo Remover</Link> handles mild room echo
            and slap-back separately.
          </p>
        </ToolSection>

        <ToolSection id="vs-noise-remover" title="Voice Cleaner vs. Noise Remover" bleed>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">
                    <span className="sr-only">Comparison</span>
                  </th>
                  <th className="px-4 py-3 font-semibold">Voice Cleaner</th>
                  <th className="px-4 py-3 font-semibold">Noise Remover</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Best for</td>
                  <td className="px-4 py-3">Speech only</td>
                  <td className="px-4 py-3">Any audio — music, field recordings, speech</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Control</td>
                  <td className="px-4 py-3">One click, fixed chain</td>
                  <td className="px-4 py-3">Adjustable reduction strength</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">What it does</td>
                  <td className="px-4 py-3">Rumble cut + denoise + normalize</td>
                  <td className="px-4 py-3">Denoise only</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Typical use case</td>
                  <td className="px-4 py-3">Podcasts, interviews, voice memos</td>
                  <td className="px-4 py-3">Music demos, field recordings, mixed content</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Prose className="mt-5">
            <p>
              Want the full breakdown of why cleanup order matters and what each
              stage actually does?{" "}
              <Link href="/guides/podcast-audio-cleanup-checklist">
                Read Podcast Audio Cleanup: A Practical Checklist
              </Link>
              .
            </p>
          </Prose>
        </ToolSection>

        <RelatedToolsGrid tools={relatedTools} />

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}