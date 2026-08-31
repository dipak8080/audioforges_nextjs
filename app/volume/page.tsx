import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { VolumeForm } from "@/components/converter/VolumeForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
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

/**
 * The gain range (-30dB to +30dB) is NOT read from the backend: it's a
 * client-side control range defined in VolumeForm, not a server limit, so
 * there's nothing in /limits to read it from. Check it against MIN_GAIN /
 * MAX_GAIN there if it ever changes.
 */

const PAGE_TITLE = "Free Audio Volume Booster";
const SOCIAL_TITLE = "Free Audio Volume Booster — Increase or Reduce Volume Online";
const PAGE_DESCRIPTION =
  "Increase or reduce audio volume online free. Adjust gain from -30dB to +30dB on MP3, WAV, FLAC, and more. No sign-up, no watermark, fast processing.";

const OG_IMAGE = ogForTool("volume", "Free Audio Volume Booster");

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/volume` },
  openGraph: {
    title: SOCIAL_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/volume`,
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
  name: "Audio Volume Booster",
  url: `${SITE_URL}/volume`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Boost audio volume up to +30dB",
    "Reduce audio volume down to -30dB",
    "No sign-up required",
    "No watermark",
  ],
};

// Don't add HowTo schema — Google retired HowTo rich results for web search,
// so it earns nothing while duplicating the visible steps. FAQPage comes from
// <FAQSection />, BreadcrumbList from <Breadcrumb />.

const GAIN_GUIDE = [
  ["+3 dB", "A subtle, barely-there increase"],
  ["+6 dB", "Clearly louder, low clipping risk on most material"],
  ["+10 dB", "Much louder; check for clipping on already-loud recordings"],
  ["+20 dB", "More likely to clip unless the source had a lot of headroom to begin with"],
  ["+30 dB", "Only for very quiet source material — high clipping risk otherwise"],
];

/**
 * Every figure comes from /limits. The hand-written sentence said "up to 80MB
 * and 20 minutes" — the size was right, the length wrong by forty minutes.
 * /volume takes the audio_tools default of one hour; 20 minutes is the
 * transcription cap, which is almost certainly where it was copied from.
 */
export default async function VolumePage() {
  const relatedTools = getRelatedTools("volume", 5);

  const limits = await getLimits();
  const durationCap = durationCapFor(limits, "volume");
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const faqs = [
    {
      question: "What gain range can I use?",
      answer:
        "From -30dB to +30dB. Extreme values near either end will often sound distorted or overly quiet — that's expected behavior, not a bug.",
    },
    {
      question: "What's a safe boost amount?",
      answer:
        "+6dB to +10dB is a solid, clearly audible boost without heavy clipping risk on most source material.",
    },
    {
      question: "Is this really free?",
      answer: "Yes — completely free, no sign-up, no watermark on the output.",
    },
    {
      question: "What formats are supported, and is there a size limit?",
      answer:
        durationCap === null
          ? `${formatList}, up to ${limits.maxUploadMb}MB per file with no length limit.`
          : `${formatList}, up to ${limits.maxUploadMb}MB and ${durationLabel(durationCap)} long.`,
    },
    {
      question: "Does boosting volume reduce quality?",
      answer:
        "The gain change itself doesn't discard any audio quality. The only quality risk is clipping if you push the boost high enough that peaks exceed the format's maximum level — moderate boosts don't carry that risk.",
    },
    {
      question: "Why is my audio still quiet after boosting?",
      answer:
        "If the source recording was very quiet to begin with, a single gain boost may not be enough to reach a comfortable listening level without introducing clipping. Try a moderate boost first and check the result before pushing higher.",
    },
    {
      question: "What is clipping?",
      answer:
        "Clipping is the harsh distortion that happens when a boosted signal tries to exceed the loudest level a format can represent, and the peaks get cut off flat instead of following the natural waveform.",
    },
    {
      question: "Is this different from normalization?",
      answer:
        "Yes. Normalization automatically raises a track to a target loudness level. This tool applies a fixed gain change you choose yourself, which gives you direct control but means you're responsible for picking a value that doesn't clip.",
      answerNode: (
        <>
          Yes. The{" "}
          <Link href="/loudness-normalizer" className="text-amber-400 hover:underline">
            Loudness Normalizer
          </Link>{" "}
          automatically raises a track to a target loudness level. This tool
          applies a fixed gain change you choose yourself, which gives you direct
          control but means you&apos;re responsible for picking a value that
          doesn&apos;t clip.
        </>
      ),
    },
    {
      question: "Will boosting volume remove background noise?",
      answer:
        "No — a volume boost raises everything in the recording equally, including background noise. If the noise itself is the problem, a dedicated noise reduction tool is the better fix.",
      answerNode: (
        <>
          No — a volume boost raises everything in the recording equally,
          including background noise. If the noise itself is the problem, a{" "}
          <Link href="/noise-remove" className="text-amber-400 hover:underline">
            dedicated noise reduction tool
          </Link>{" "}
          is the better fix.
        </>
      ),
    },
    {
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: "Does it work on mobile?",
      answer: "Yes — it works in any mobile browser on iPhone or Android, no app install required.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Volume Booster" }]} />
        }
        title="Free Audio Volume Booster"
        lede="Increase or reduce audio volume online, free, no sign-up, no watermark."
        tool={<VolumeForm />}
      >
        <FeatureStrip
          features={[
            { title: "-30 to +30dB", desc: "Full range gain control, either direction." },
            { title: "Fast", desc: "Most adjustments finish in a few seconds." },
            {
              title: "No sign-up",
              desc:
                durationCap === null
                  ? `No account, no email, no watermark. Up to ${limits.maxUploadMb}MB per file.`
                  : `No account, no email, no watermark. Up to ${limits.maxUploadMb}MB and ${durationLabel(durationCap)}.`,
            },
          ]}
        />

        <ToolSection id="what-is-it" title="What is an audio volume booster?">
          <p>
            A volume booster increases or decreases the loudness of an audio file
            without touching its speed, pitch, or format. It&apos;s the right fix
            when a recording came out too quiet, a podcast has uneven levels
            between takes, or a track needs a small loudness adjustment before
            sharing — a straightforward gain change, nothing more.
          </p>
        </ToolSection>

        <ToolSection id="why-boost" title="Why increase audio volume?">
          <p>
            Recordings end up too quiet for all kinds of ordinary reasons: a voice
            memo captured at arm&apos;s length, a lecture or interview recorded on
            whatever device was on hand, a podcast segment that came in at a
            different level than the rest of the episode, or a music track exported
            at a conservative level to leave headroom. In every one of those cases
            the audio itself is fine — it just needs to be louder, which is exactly
            what a gain boost does without re-processing anything else about the
            file.
          </p>
        </ToolSection>

        <ToolSection id="why-reduce" title="When should you reduce volume instead?">
          <p>
            Reducing gain matters just as often as boosting it. A recording
            that&apos;s already clipping or distorted from being captured too hot
            can sometimes be brought back to a listenable level by pulling the gain
            down, though it won&apos;t undo distortion that already happened at the
            moment of recording. More commonly, reducing volume is about
            consistency — matching one clip&apos;s level to the rest of a project,
            or turning a track down before handing it off somewhere with its own
            loudness expectations, like a podcast platform or a shared mix.
          </p>
        </ToolSection>

        <ToolSection id="how-to" title="How to increase or reduce audio volume">
          <ol>
            <li>Upload your {formatList} file.</li>
            <li>
              Move the gain slider to your target dB value, positive to boost or
              negative to reduce.
            </li>
            <li>Click Adjust volume to process the file.</li>
            <li>
              Download the result — same format as your upload, just at the new
              level.
            </li>
          </ol>
        </ToolSection>

        {/* Was a two-column table with a header row — gain and its typical
            result is a term/definition pair, and the terms are values, so they
            go in mono. */}
        <ToolSection id="how-much" title="Choosing a gain amount">
          <p>
            <strong>+6dB to +10dB</strong> is a solid, clearly audible boost
            without heavy clipping risk on most recordings. Going much higher
            toward +30dB will often introduce distortion — that&apos;s the tradeoff
            of pushing gain that far, not a flaw in the tool.
          </p>
          <p>
            On the reduction side, <strong>-6dB to -10dB</strong> is enough to
            noticeably quiet a recording that&apos;s too loud, while still keeping
            it clearly audible.
          </p>
          <dl className="codes">
            {GAIN_GUIDE.map(([gain, result]) => (
              <Fragment key={gain}>
                <dt>{gain}</dt>
                <dd>{result}</dd>
              </Fragment>
            ))}
          </dl>
          <p>
            Where clipping actually sets in depends on how much headroom the
            original recording already had — a very quiet source can often take a
            bigger boost before clipping than a recording that was already close to
            its loudest point. The tool reads your file&apos;s loudest peak before
            you run it and shows what the boost would do to it, so you can see a
            clip coming rather than hearing it afterwards.
          </p>
        </ToolSection>

        <ToolSection id="clipping" title="Understanding clipping">
          <p>
            Clipping happens when a boosted signal tries to go louder than the
            format&apos;s maximum representable level, so instead of the
            waveform&apos;s peaks following their natural shape, they get cut off
            flat. That flattening is what produces the harsh, crackling distortion
            associated with an over-boosted recording. It&apos;s not something a
            volume tool can fix after the fact by adjusting gain back down — once a
            peak has been clipped, the detail that got cut off is gone, not just
            quieter. The only real prevention is boosting conservatively enough
            that peaks stay under the format&apos;s ceiling in the first place,
            which is exactly why the guidance above stays in a moderate range for
            most material.
          </p>
        </ToolSection>

        <ToolSection id="gain-vs-volume" title="Gain vs volume: what's the difference?">
          <p>
            The two terms get used interchangeably, but they describe different
            things. <strong>Gain</strong> is a change applied to the actual audio
            data itself — it&apos;s baked into the file you download, and it&apos;s
            what this tool adjusts. <strong>Volume</strong> usually refers to
            playback loudness on whatever device or app is playing the file back —
            your phone&apos;s volume buttons, for instance, change nothing about the
            file itself. If a file sounds too quiet even at full playback volume,
            that&apos;s a sign the file needs a gain boost, not just a louder
            playback setting.
          </p>
        </ToolSection>

        {/* RENAMED from "Related tools". It sat directly above the "More free
            tools" card grid, so the page had two adjacent headings about other
            tools — and this one isn't a list, it's about when a gain change is
            the wrong fix. */}
        <ToolSection id="wrong-fix" title="When a volume boost isn't the right fix">
          <p>
            If background noise, not just loudness, is the issue, our{" "}
            <Link href="/noise-remove">Noise Remover</Link> is the better fit — a
            volume boost raises noise right along with everything else. If you want
            a target loudness rather than a fixed gain change, the{" "}
            <Link href="/loudness-normalizer">Loudness Normalizer</Link> picks the
            amount for you. Need to cut a clip down before adjusting its level? Try{" "}
            <Link href="/trim">Trim Audio</Link> first, or head to the{" "}
            <Link href="/convert">Audio Converter</Link> if you need a different
            file format afterward.
          </p>
          <p>
            Want the full explanation of why clipping happens and where gain
            adjustments fit in a mixing workflow? Read{" "}
            <Link href="/guides/gain-staging-for-home-studios">
              Gain Staging Explained for Home Studios
            </Link>
            .
          </p>
        </ToolSection>

        <RelatedToolsGrid tools={relatedTools} />

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}