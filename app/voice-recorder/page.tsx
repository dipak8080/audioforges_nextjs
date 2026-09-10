import type { Metadata } from "next";
import Link from "next/link";
import { VoiceRecorderForm } from "@/components/browser/VoiceRecorderForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { Prose } from "@/components/ui/Prose";
import { ProofStrip } from "@/components/tools/ProofStrip";
import { CompareTable } from "@/components/tools/CompareTable";
import { PageByline } from "@/components/tools/PageByline";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { ogForTool } from "@/lib/og";

const PAGE_TITLE = "Online Voice Recorder – Free, Download as WAV";
const PAGE_DESCRIPTION =
  "Record from your microphone in the browser and download it as a WAV. Free, no sign-up, and nothing is uploaded: the recording never leaves your device.";

const UPDATED = "2026-09-10";

const OG_IMAGE = ogForTool("voice-recorder", "Free Online Voice Recorder");

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/voice-recorder` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/voice-recorder`,
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

// Every claim below matches the visible page copy. No pause/resume, waveform,
// mic selection or mobile-compatibility claims — none of those are confirmed
// against the actual VoiceRecorderForm.
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Online Voice Recorder",
  url: `${SITE_URL}/voice-recorder`,
  dateModified: UPDATED,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Records directly from your microphone",
    "Nothing is ever uploaded — runs entirely in your browser",
    "Instant playback and download",
    "No sign-up required",
  ],
};

// BreadcrumbList comes from <Breadcrumb />; FAQPage from <FAQSection />.

const faqs = [
  {
    question: "Is my recording uploaded anywhere?",
    answer:
      "No. Recording, playback, the WAV conversion and both downloads happen in your browser using your device's own microphone and audio APIs. The audio never leaves your computer or phone, and the page keeps working with the internet off once it has loaded.",
  },
  {
    question: "What file format do I get?",
    answer:
      "Two buttons, two formats. The first downloads exactly what your browser recorded, which is WebM on Chrome, Firefox and Edge, or M4A on Safari. The second converts that to a 16-bit PCM WAV in the page and downloads it, which is the one that opens in a DAW, in Audacity, or on Windows without extra software. Both are made on your device; neither is uploaded.",
  },
  {
    question: "Is the WAV better quality than the first download?",
    answer:
      "No. Your browser compresses the microphone signal as it records, and the WAV is a lossless container around that already-compressed audio. It is the more useful file, not a cleaner one.",
  },
  {
    question: "Can I get an MP3?",
    answer:
      "Download the WAV, then run it through the Audio Converter. That step does go through the server, so do it only if you need MP3 specifically.",
    answerNode: (
      <>
        Download the WAV, then run it through the{" "}
        <Link href="/convert" className="text-amber-400 hover:underline">
          Audio Converter
        </Link>
        . That step does go through the server, so do it only if you need MP3 specifically.
      </>
    ),
  },
  {
    question: "Why is my microphone not working?",
    answer:
      "The browser needs permission. If you denied it once, open the site settings for this page, switch the microphone to Allow, and reload. If it still fails, another app may hold the microphone exclusively; close it and try again.",
  },
  {
    question: "Is there a recording length limit?",
    answer:
      "No hard limit. Recording is held in memory, so the practical ceiling is your device, and an hour of speech is well within it on any recent phone or laptop.",
  },
  {
    question: "Do I need to install anything?",
    answer: "No. Any recent Chrome, Firefox, Safari or Edge. No app, no extension, no account.",
  },
];

export default function VoiceRecorderPage() {
  const relatedTools = getRelatedTools("voice-recorder", 5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Voice Recorder" }]} />}
        meta={["No account", "Nothing uploaded", "WAV download"]}
        title="Free Online Voice Recorder"
        lede="Record from your microphone and download it as a WAV. Free, no sign-up, and the audio never leaves your browser."
        tool={<VoiceRecorderForm />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Where it runs",
              value: "Entirely on your device",
              note: "The only tool on this site with no server step. It keeps working with the internet off once the page has loaded.",
            },
            {
              label: "Output",
              value: "WAV, or the browser's native file",
              note: "16-bit PCM WAV made in the page. Opens in a DAW, Audacity, or Windows with nothing extra.",
            },
            {
              label: "Limits",
              value: "None",
              note: "No length cap, no account, no watermark. Recording is held in memory, so your device is the ceiling.",
            },
          ]}
        />

        <ToolSection id="how-to" title="Three taps" bleed>
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              ["Allow the microphone", "Tap the button and choose Allow when the browser asks. The level meter moves once it is live."],
              ["Record", "Speak or play. The meter confirms the mic is picking you up, so you are not recording silence."],
              ["Stop and download", "Play it back, then take the native file or the WAV. Both are made on your device."],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5">
                <p className="font-mono text-[11px] text-amber-400">Step {i + 1}</p>
                <p className="mt-1.5 font-medium text-text-primary">{t}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{d}</p>
              </li>
            ))}
          </ol>
          <Prose className="mt-5">
            <p>
              Mic blocked? Open the browser&apos;s site settings for this page, set the microphone to Allow, and
              reload. If it still fails, another app has the microphone; close it and try again.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="formats" title="Which download to take" bleed>
          <CompareTable
            columns={["Native file", "WAV"]}
            highlight={1}
            rows={[
              {
                label: "What it is",
                cells: [
                  { text: "WebM on Chrome, Firefox, Edge. M4A on Safari", mono: true },
                  { text: "16-bit PCM WAV, converted in the page", mono: true },
                ],
              },
              {
                label: "Opens in a DAW or Audacity",
                cells: [
                  { state: "partial", text: "Sometimes. Depends on the app" },
                  { state: "yes", text: "Always" },
                ],
              },
              {
                label: "Opens on Windows with no extra software",
                cells: [
                  { state: "no", text: "WebM usually does not" },
                  { state: "yes", text: "Yes" },
                ],
              },
              {
                label: "Size",
                cells: [
                  { text: "Small, compressed" },
                  { text: "About 5 MB per minute" },
                ],
              },
              {
                label: "Quality",
                cells: [
                  { text: "As recorded" },
                  { text: "Identical. Same audio, lossless wrapper" },
                ],
              },
            ]}
            footnote="Neither download is uploaded. The WAV is decoded and written by the page itself."
          />
          <Prose className="mt-5">
            <p>
              Recording needs no server because the browser can capture, encode and play audio on its own.{" "}
              <Link href="/guides/why-your-browser-can-record-without-uploading">
                Why your browser can record without uploading
              </Link>{" "}
              explains how, and why the native format depends on which browser you use.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="next" title="After the recording" bleed>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Remove background noise", "Room hum, fan, traffic.", "/noise-remove"],
              ["Clean up the voice", "Noise plus reverb in one pass.", "/voice-clean"],
              ["Transcribe it", "Words with timestamps.", "/audio-to-text"],
              ["Convert to MP3", "For sharing or a phone.", "/convert"],
            ].map(([title, desc, href]) => (
              <Link
                key={href}
                href={href}
                prefetch={false}
                className="group rounded-xl border border-graphite-800 bg-graphite-900 p-4 transition-colors hover:border-amber-500/40"
              >
                <p className="font-medium text-text-primary group-hover:text-amber-400">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">{desc}</p>
              </Link>
            ))}
          </div>
          <Prose className="mt-5">
            <p>
              Those four do go through the server, unlike this page. Voice memos, narration, singing ideas, podcast
              drafts and mic tests all start here; take the WAV to whichever comes next.
            </p>
          </Prose>
        </ToolSection>

        <FAQSection faqs={faqs} />

        <RelatedToolsGrid tools={relatedTools} />

        <PageByline updated={UPDATED} note="Added in-browser WAV download" />
      </ToolPageShell>
    </>
  );
}