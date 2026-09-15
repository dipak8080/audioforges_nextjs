import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { Prose } from "@/components/ui/Prose";
import { CompareTable } from "@/components/tools/CompareTable";
import { PageByline } from "@/components/tools/PageByline";
import { transcriptionCost } from "@/components/tools/TranscriptionBlocks";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getFeatureFlags } from "@/lib/api/railway";
import { TRANSCRIPTION_MODEL } from "@/lib/api/transcription";
import { ogImage } from "@/lib/og";
import { getLimits, windowFor, rateLimitLabel, durationLabel } from "@/lib/api/limits";

const PUBLISHED = "2026-08-20";
const UPDATED = "2026-09-15";
const PATH = "/free-transcription-no-sign-up";
const PAGE_TITLE = "Free Transcription Without Signing Up";
const PAGE_DESCRIPTION =
  "Why free transcription tools ask for an account halfway through, how to spot it before you upload, and what to check first. No sign-up needed here.";

const OG_IMAGE = ogImage(
  "Free transcription without signing up",
  "Six ways free stops being free, and how to spot each one before you upload.",
  "Guide"
);

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}${PATH}` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}${PATH}`,
    siteName: SITE_NAME,
    type: "article",
    publishedTime: PUBLISHED,
    modifiedTime: UPDATED,
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image", title: PAGE_TITLE, description: PAGE_DESCRIPTION, images: [OG_IMAGE.url] },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  datePublished: PUBLISHED,
  dateModified: UPDATED,
  author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  image: `${SITE_URL}${OG_IMAGE.url}`,
  mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}${PATH}` },
};

const PATTERNS = [
  ["The export paywall", "The transcript shows on screen, but downloading it is the paid feature."],
  ["The email gate", "Processing runs without an account. Seeing or saving the result needs one."],
  ["The card on file", "A free trial that wants payment details before the first file, then charges when you forget to cancel."],
  ["The hidden length cap", "Short files go through. The interview or lecture you actually came with does not."],
  ["The shrinking allowance", "A minutes or credits balance that runs out, followed by a subscription prompt."],
  ["The watermark", "Caption tools that return a branded video instead of a subtitle file."],
];

const CHECKLIST = [
  ["Can you see the download button before uploading?", "If not, assume it needs an account."],
  ["Is there a number that goes down?", "Minutes or credits. Fine if it is stated up front, a trap if it isn't."],
  ["Does it want a card before the first file?", "That is a trial, not a free tier."],
  ["What is the longest file it takes?", "A tool that won't say usually has a short answer."],
  ["Is there a subscription behind the limit?", "A limit with a monthly plan behind it is a funnel."],
  ["Does it name its model?", "\"Advanced AI\" is not an answer. A named model can be checked."],
];

const TOOL_LINKS = [
  { href: "/audio-to-text", label: "Audio to Text", body: "MP3, WAV, M4A, FLAC and more." },
  { href: "/youtube-to-text", label: "YouTube to Text", body: "Paste a link. Works with captions off." },
  { href: "/video-to-text", label: "Video to Text", body: "MP4 or MOV in, SRT out." },
];

export default async function FreeTranscriptionPage() {
  const [{ paywallTools }, limits] = await Promise.all([getFeatureFlags(), getLimits()]);
  const metered = Boolean(paywallTools.transcribe);
  const cost = transcriptionCost(metered);
  const rateLimit = rateLimitLabel(limits.rateLimits.speech_to_text ?? 2, windowFor(limits, "speech_to_text"));
  const maxLength = durationLabel(limits.featureDurations.transcription);

  const faqs: FAQItem[] = [
    {
      question: "Why do free transcription tools ask for an account?",
      answer:
        "Transcription runs on GPUs billed by the second, so most tools treat the free tier as lead generation: enough to prove it works, then an account to continue.",
    },
    {
      question: "Is any transcription tool free with no account?",
      answer: `Some, including this one, but almost none are uncapped. What differs is the cap. Here it is ${maxLength} per file and ${rateLimit}${
        metered ? ", plus a monthly allowance of free runs" : ""
      }. There is never an account gate on the download.`,
    },
    {
      question: "What's the catch here?",
      answer: `${cost.sentence} There is no account, no card up front, and no export paywall: TXT, SRT and VTT download on every run.`,
    },
    {
      question: "Can I download SRT subtitles without an account?",
      answer: "Here, yes. Export is the most commonly paywalled feature in this category, so check it before uploading anywhere else.",
    },
    {
      question: "How do I transcribe something longer than the limit?",
      answer:
        "Split it at natural pauses, transcribe each part, and join the text. Caption timestamps restart at zero per part, so add each part's offset.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Free transcription without signing up" }]} />}
        title="Free transcription without signing up"
        lede="Most free transcription tools let you start without an account and ask for one before you can finish. Here is how to spot that before you upload, and where the line sits here."
        meta={["Guide", "No sign-up needed"]}
      >
        <ToolSection id="patterns" title="Six ways free stops being free" bleed>
          <ul className="grid gap-3 sm:grid-cols-2">
            {PATTERNS.map(([name, body]) => (
              <li key={name} className="rounded-xl border border-graphite-800 bg-graphite-900 p-4">
                <p className="font-medium text-text-primary">{name}</p>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">{body}</p>
              </li>
            ))}
          </ul>
        </ToolSection>

        <ToolSection id="checklist" title="Six questions before you upload" bleed>
          <ol className="divide-y divide-graphite-800 rounded-xl border border-graphite-800 bg-graphite-900">
            {CHECKLIST.map(([q, why], i) => (
              <li key={q} className="flex gap-4 px-4 py-3">
                <span className="font-mono text-xs text-amber-500">0{i + 1}</span>
                <div>
                  <p className="font-medium text-text-primary">{q}</p>
                  <p className="mt-0.5 text-sm text-text-muted">{why}</p>
                </div>
              </li>
            ))}
          </ol>
        </ToolSection>

        <ToolSection id="our-answers" title="The same questions, answered for AudioForges" bleed>
          <CompareTable
            columns={["AudioForges"]}
            highlight={0}
            gridClass="sm:grid-cols-[minmax(9rem,1fr)_2fr]"
            rows={[
              { label: "Download button", cells: [{ state: "yes", text: "TXT, SRT and VTT on every run, no account" }] },
              {
                label: "A number that goes down",
                cells: [
                  metered
                    ? { state: "partial", text: "Free monthly runs, shown before you start", sub: "then 1 credit, about 20 to 30 cents" }
                    : { state: "yes", text: "None" },
                ],
              },
              { label: "Card up front", cells: [{ state: "yes", text: "Never" }] },
              { label: "Longest file", cells: [{ state: "yes", text: `${maxLength} per file`, sub: rateLimit }] },
              {
                label: "Subscription",
                cells: [{ state: "yes", text: metered ? "None. Credits are bought once and never expire" : "None" }],
              },
              { label: "Model", cells: [{ state: "yes", text: TRANSCRIPTION_MODEL, mono: true }] },
            ]}
          />
          <Prose className="mt-5">
            <p>
              The limits exist because every transcript runs on a GPU that costs real money. They are stated here so
              you meet them before uploading, not after.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="start" title="Start with what you have" bleed>
          <ul className="grid gap-3 sm:grid-cols-3">
            {TOOL_LINKS.map((t) => (
              <li key={t.href}>
                <Link
                  href={t.href}
                  prefetch={false}
                  className="group block h-full rounded-xl border border-graphite-800 bg-graphite-900 p-4 transition-colors hover:border-amber-500/40"
                >
                  <p className="flex items-center gap-1.5 font-medium text-text-primary">
                    {t.label}
                    <ArrowRight className="h-3.5 w-3.5 text-text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </p>
                  <p className="mt-1 text-sm text-text-muted">{t.body}</p>
                </Link>
              </li>
            ))}
          </ul>
        </ToolSection>

        <FAQSection faqs={faqs} />

        <PageByline updated={UPDATED} note="Patterns and limits re-checked" />
      </ToolPageShell>
    </>
  );
}