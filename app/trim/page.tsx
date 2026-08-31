import type { Metadata } from "next";
import Link from "next/link";
import { TrimForm } from "@/components/converter/TrimForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { ogImage } from "@/lib/og";
import { getRelatedTools } from "@/lib/data/tools";
import {
  getLimits,
  durationCapFor,
  durationLabel,
  retentionSentences,
} from "@/lib/api/limits";

const PAGE_TITLE = "Free Audio Trimmer — Cut Any Track Online";
const PAGE_DESCRIPTION =
  "Trim or cut audio files online free. Cut MP3, WAV, FLAC, AAC, M4A, OGG, and AIFF with a precise start and end point. No sign-up, no watermark.";

const OG_IMAGE = ogImage("Free Audio Trimmer", "Cut any track to an exact start and end point.");

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/trim` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/trim`,
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
  name: "Audio Trimmer",
  url: `${SITE_URL}/trim`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Cut audio to any start/end point",
    "Keeps original format and quality",
    "No sign-up required",
    "No watermark",
  ],
};

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.

// Every limit on this page comes from /limits. Don't type one in by hand —
// hand-written duration caps have been wrong, always understated, on more
// than half the pages that stated one.
export default async function TrimPage() {
  const relatedTools = getRelatedTools("trim", 5);

  const limits = await getLimits();

  // Bare lowercase from the API ("mp3"); uppercase is a display choice.
  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", and $1");

  const durationCap = durationCapFor(limits, "trim");
  const retention = retentionSentences(limits.retention.audio_tools);

  const faqs = [
    {
      question: "Does trimming change the audio quality?",
      answer:
        "No — trimming just cuts the selected range and keeps your original format, with no quality loss beyond the format's normal characteristics.",
    },
    {
      question: "What's the difference between trimming and cutting?",
      answer:
        "For this tool, they mean the same thing — selecting a start and end point and keeping only what's in between. \"Trim\" and \"cut\" are just different words people use for the same operation.",
    },
    {
      question: "Can I remove silence throughout a track, not just the ends?",
      answer:
        "That's a separate tool. Trim cuts to a single start and end point; the Silence Remover strips silent gaps everywhere in the file, not just the edges.",
      answerNode: (
        <>
          That&apos;s a separate tool. Trim cuts to a single start and end
          point; the{" "}
          <Link href="/silence-remove" className="text-amber-400 hover:underline">
            Silence Remover
          </Link>{" "}
          strips silent gaps everywhere in the file, not just the edges.
        </>
      ),
    },
    {
      question: "Is this really free?",
      answer: "Yes — completely free, no sign-up, no watermark on the output.",
    },
    {
      question: "Is there a size or length limit?",
      answer:
        durationCap === null
          ? `Uploads are limited to ${limits.maxUploadMb}MB per file, with no length limit.`
          : `The source file can be up to ${durationLabel(durationCap)} long and ${limits.maxUploadMb}MB.`,
    },
    {
      question: "Can I convert the trimmed clip to a different format too?",
      answer:
        "Trim keeps the original format by design. Run the trimmed result through the Format Converter afterward if you need a different format.",
    },
    {
      question: "Can I trim audio on my phone?",
      answer: "Yes — it works in any mobile browser on iPhone or Android, no app install required.",
    },
    {
      question: "Can I trim multiple files at once?",
      answer: "One file at a time — there's currently no batch upload option.",
    },
    {
      question: "Can I undo a trim?",
      answer:
        "There's no undo history — this is a stateless upload-process-download tool with nothing saved between visits. Re-upload the original file if you need to cut it differently.",
    },
    {
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: "Does trimming reduce the file size?",
      answer:
        "Yes, proportionally to how much you cut — a shorter clip has less audio data, so the file comes out smaller than the original.",
    },
    {
      question: "Does it work on stereo audio?",
      answer:
        "Yes — trimming only cuts the time range, so it doesn't affect channel layout. Stereo files stay stereo.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb
            items={[
              { name: "Tools", href: "/tools" },
              { name: "Audio Trimmer" },
            ]}
          />
        }
        title="Free Audio Trimmer"
        lede="Cut any audio file down to just the part you need, free, no sign-up, no watermark."
        tool={<TrimForm />}
      >
        <FeatureStrip
          features={[
            { title: "Precise", desc: "Drag to pick your exact start and end point." },
            { title: "No quality loss", desc: "Output keeps your original format." },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
          ]}
        />

        <ToolSection id="why" title="Why trim audio?">
          <p>
            Trimming removes unwanted sections without touching playback
            speed, pitch, or format — it&apos;s just a clean cut to exactly
            the part you want. That covers a lot of ordinary needs: shortening
            a clip before sharing it, cutting silence off the start or end of
            a recording, pulling a short sample out of a longer track, or
            preparing a file for somewhere with its own length limits.
          </p>
        </ToolSection>

        <ToolSection id="how-to" title="How to trim or cut an audio file">
          <ol>
            <li>Upload an {formatList} file.</li>
            <li>Drag the start marker along the timeline to where you want the clip to begin.</li>
            <li>Drag the end marker to where you want the clip to end.</li>
            <li>Download the trimmed clip — same format as your upload.</li>
          </ol>
        </ToolSection>

        <ToolSection id="trim-vs-cut" title="Trim vs. cut: same thing, different word">
          <p>
            &quot;Trim&quot; and &quot;cut&quot; describe the same operation here —
            selecting a start and end point and keeping only what&apos;s between
            them. Some people search for an &quot;audio cutter,&quot; others for an
            &quot;audio trimmer&quot;; either way, this tool does exactly that: one
            clean cut, original format preserved.
          </p>
          <p>
            Worth distinguishing from &quot;splitting,&quot; which means breaking
            one file into several separate pieces rather than keeping a single
            section. That&apos;s a different tool:{" "}
            <Link href="/silence-split">Split by Silence</Link> cuts a long
            recording into separate tracks wherever it finds a gap — useful for
            a live set, a vinyl rip, or a batch of takes recorded in one pass.
          </p>
        </ToolSection>

        <ToolSection id="common-uses" title="Common uses">
          <ul>
            <li>Cutting a podcast segment down to a shareable clip</li>
            <li>Pulling a sample, intro, or hook from a longer track</li>
            <li>Trimming dead air off the start or end of a voice memo</li>
            <li>Grabbing just the chorus of a song for quick reference</li>
            <li>Making a ringtone-length clip from a longer recording</li>
            <li>Cutting a short section out of a field recording for a sample library</li>
            <li>Preparing a clip for a social media post or video edit</li>
          </ul>
          <p>
            Need the clip in a different format too? Trim keeps the original format
            by design — run the result through the{" "}
            <Link href="/convert">Format Converter</Link> afterward if you need
            something else. Need to strip silence throughout the whole file, not
            just cut one section? The{" "}
            <Link href="/silence-remove">Silence Remover</Link> handles that
            instead.
          </p>
          <p>
            Want to know why a bad cut point can cause a click or pop, and how
            lossless vs. lossy formats handle trimming differently?{" "}
            <Link href="/guides/how-to-trim-audio-without-losing-quality">
              Read How to Trim Audio Without Losing Quality
            </Link>
            .
          </p>
        </ToolSection>

        <ToolSection id="which-tool" title="Which tool do you actually need?" bleed>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">You want to...</th>
                  <th className="px-4 py-3 font-semibold">Use</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3">Keep one specific section, cut the rest</td>
                  <td className="px-4 py-3">Trim (this tool)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Strip silent gaps throughout the whole file</td>
                  <td className="px-4 py-3">
                    <Link href="/silence-remove" className="text-amber-400 hover:underline">
                      Silence Remover
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Break one long file into several tracks</td>
                  <td className="px-4 py-3">
                    <Link href="/silence-split" className="text-amber-400 hover:underline">
                      Split by Silence
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Change the file format after trimming</td>
                  <td className="px-4 py-3">
                    <Link href="/convert" className="text-amber-400 hover:underline">
                      Audio Converter
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </ToolSection>

        <RelatedToolsGrid tools={relatedTools} />

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}