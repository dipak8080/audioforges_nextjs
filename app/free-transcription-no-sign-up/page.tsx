import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { TRANSCRIPTION_LIMITS, TRANSCRIPTION_MODEL } from "@/lib/api/transcription";

/* ------------------------------------------------------------------ */
/* Derived facts                                                       */
/* ------------------------------------------------------------------ */
/**
 * The limits were already read from source here. The MODEL NAME was not
 * — "Whisper large-v3" was a literal on this page, on all three tool
 * pages, and in the form header. Five copies of a string that changes
 * the day the model is upgraded.
 *
 * It matters more here than anywhere else on the site. This page's
 * argument is "a named model is checkable, an accuracy percentage is
 * not". A page that names the wrong model has lost that argument
 * entirely — worse than one that names none.
 *
 * Requires in lib/api/transcription.ts:
 *   export const TRANSCRIPTION_MODEL = "Whisper large-v3";
 */
const RATE_LIMIT = getRateLimitLabel("speech-to-text") ?? "2 per 5 minutes";
const MAX_MINUTES = TRANSCRIPTION_LIMITS.durationSeconds / 60;

/**
 * PUBLISHED is fixed. LAST_VERIFIED moves when the patterns, the limits
 * or the model actually change — not on every deploy.
 *
 * These were one constant, which meant dateModified could never differ
 * from datePublished and the freshness signal was permanently stale from
 * the day it shipped. On an editorial page competing against listicles
 * that get refreshed quarterly, that's the one signal worth having.
 */
const PUBLISHED: string = "2026-08-20";
const LAST_VERIFIED: string = "2026-08-21";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

// 37 chars → 51 with the suffix. Targets the generic cluster
// ("free transcription no sign up", "transcribe without an account")
// rather than brand queries — see the note on competitor naming below.
const PAGE_TITLE = "Free Transcription Without Signing Up";
const PAGE_DESCRIPTION = "Why most free transcription tools ask for an account halfway through, how to spot it before you upload, and where to get one with no sign-up or card.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  keywords: [
    "free transcription no sign up",
    "transcribe audio without account",
    "free transcription no credit card",
    "transcription without email",
    "free transcript no watermark",
    "free srt export no account",
    "transcription free trial limit",
    "no login transcription tool",
  ],
  alternates: { canonical: `${SITE_URL}/free-transcription-no-sign-up` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/free-transcription-no-sign-up`,
    siteName: SITE_NAME,
    type: "article",
    publishedTime: PUBLISHED,
    modifiedTime: LAST_VERIFIED,
    images: [{ url: "/images/og-default.png", width: 1200, height: 630, alt: "AudioForges" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/images/og-default.png"],
  },
};

// Article, not WebApplication — this page is editorial. The tool schema
// lives on the three tool pages it links to; duplicating it here would
// put four WebApplication entities on one site for one product.
const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  datePublished: PUBLISHED,
  dateModified: LAST_VERIFIED,
  author: { "@type": "Organization", name: SITE_NAME },
  publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": `${SITE_URL}/free-transcription-no-sign-up`,
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    {
      "@type": "ListItem",
      position: 2,
      name: "Free transcription without signing up",
      item: `${SITE_URL}/free-transcription-no-sign-up`,
    },
  ],
};

/**
 * NOTE ON NAMING COMPETITORS (deliberate omission).
 *
 * "is [brand] really free" queries exist and this page could chase them.
 * It doesn't, because publishing specific claims about someone else's
 * pricing means being wrong the week they change a tier — and being
 * caught wrong about a rival's pricing would destroy the one thing this
 * page is built on.
 *
 * The patterns below are stable, apply to every tool in the category,
 * and in aggregate the generic cluster is larger than any single brand
 * query. If brand pages are ever added, they need a review date and
 * someone actually re-checking the tiers.
 */
const PATTERNS = [
  {
    name: "The credit wall",
    tell: "A minutes or credits balance shown somewhere in the interface.",
    happens:
      "You get a small allowance — often 30 minutes — then a prompt to sign up for more. The first file works, which is what makes it feel free.",
  },
  {
    name: "The export paywall",
    tell: "No download button visible until after processing finishes.",
    happens:
      "Transcription is genuinely free. Getting the text out is the paid feature. You see your transcript on screen and can't take it anywhere.",
  },
  {
    name: "The length cap",
    tell: "A file-length limit mentioned only in small print, if at all.",
    happens:
      "Files under a few minutes go through. Anything longer — the interview, the lecture, the actual reason you came — hits a wall.",
  },
  {
    name: "The email gate",
    tell: '"No sign-up required" beside a Continue button that opens a form.',
    happens:
      "Processing runs without an account. Results need one. The claim is technically true and practically meaningless.",
  },
  {
    name: "The card on file",
    tell: 'A "free trial" that asks for payment details before the first file.',
    happens:
      "No money changes hands on day one, which is what lets it be called free. The charge arrives when the trial lapses, and cancelling is a separate errand you have to remember.",
  },
  {
    name: "The watermark",
    tell: "A free tier that returns a video rather than a subtitle file.",
    happens:
      "Common on caption tools. The captions are free; the burned-in branding across your footage is the price.",
  },
];

const CHECKLIST = [
  {
    question: "Where is the download button?",
    why: "If you can't see it before uploading, assume it needs an account. This is the most common gate and the least advertised.",
  },
  {
    question: "Is there a number that goes down?",
    why: "Minutes, credits, characters. Anything that depletes is a trial, whatever the page calls it.",
  },
  {
    question: "Does it want a card before the first file?",
    why: "A free tier and a free trial are different products. If payment details are required up front, you're being asked to remember to cancel.",
  },
  {
    question: "What's the longest file it takes?",
    why: "A tool that won't say is usually one where the answer is short. Yours is probably longer than their limit.",
  },
  {
    question: "What do the limits protect?",
    why: "Server cost or a paid tier. A limit with no upgrade behind it is a capacity decision. A limit with a pricing page behind it is a funnel.",
  },
  {
    question: "Does it say which model it runs?",
    why: "\"Advanced AI\" is not an answer. A named model is checkable; an accuracy percentage without methodology is a marketing number.",
  },
];

/**
 * Every answer opens with the answer. Extractive summarisers — the ones
 * behind AI Overviews — take the first clause, so an answer that spends
 * its opening sentence on setup gets skipped or misquoted. That's where
 * a site with no backlinks yet gets its first impressions.
 */
const faqs = [
  {
    question: "Why do free transcription tools ask for an account?",
    answer:
      "Because transcription costs real money per minute of audio — it runs on GPU hardware billed by the second. Most tools recover that by treating the free tier as lead generation: enough to prove it works, then an account to continue. That's a reasonable business model, but it isn't the same thing as free.",
  },
  {
    question: "Is any transcription tool genuinely free with no account?",
    answer:
      "Some are, including this one. What varies is what they cap instead — usually file length or how often you can submit. A tool with no cap at all and no account is either subsidised by something else or about to change.",
  },
  {
    question: "Is there a free transcription tool with no credit card?",
    answer:
      "Yes — this one never asks for payment details, because there is no paid tier to upgrade to. Worth checking specifically: a card requested before the first file usually means a trial that converts, not a free tier, and the two get described with the same word.",
  },
  {
    question: "What's the catch here?",
    answer: `Length and frequency. ${MAX_MINUTES} minutes per file and ${RATE_LIMIT}, both stated up front. There's no account, no credits, no export paywall and no paid tier — which also means there's nothing for those limits to push you toward.`,
  },
  {
    question: "Can I download SRT subtitles without paying?",
    answer:
      "Here, yes — TXT, SRT and VTT all download with no account. Export is the single most commonly paywalled feature in this category, so it's worth checking specifically rather than assuming.",
  },
  {
    question: "How do I transcribe something longer than the limit?",
    answer:
      "Split it first. Cutting at natural pauses rather than at fixed times keeps sentences intact, then each section transcribes separately and the text joins back together. Timestamps restart at zero per section, so caption files need each section's offset added.",
  },
];

export default function FreeTranscriptionPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <main className="mx-auto max-w-3xl px-4 pb-16">
        <section className="pt-14 sm:pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
            Free, and what that usually means
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
            Free transcription without signing up
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-text-muted">
            If you landed here after uploading a file somewhere else and hitting
            a sign-up prompt, you weren&apos;t imagining it. That&apos;s the
            standard shape of &quot;free&quot; in this category — no account to
            start, an account to finish.
          </p>
          <p className="mt-3 max-w-xl leading-relaxed text-text-muted">
            This page covers why it works that way, how to spot it before you
            waste an upload, and where the line falls here.
          </p>

          {/* Visible date, not just schema. Editorial pages in this SERP
              are listicles that get refreshed quarterly and say so; an
              undated page reads as abandoned next to them. Says what was
              re-checked rather than "updated", which on most sites means
              a build ran. */}
          <p className="mt-6 font-mono text-xs text-text-subtle">
            Published <time dateTime={PUBLISHED}>{formatDate(PUBLISHED)}</time>
            {LAST_VERIFIED !== PUBLISHED && (
              <>
                {" · "}patterns and limits re-checked{" "}
                <time dateTime={LAST_VERIFIED}>{formatDate(LAST_VERIFIED)}</time>
              </>
            )}
          </p>
        </section>

        {/* Pattern recognition, not a hit list. Useful to someone
            evaluating any tool in the category, which is what makes it
            worth linking to — a page that only says "we're the good one"
            is an ad, and gets read as one. */}
        <section className="border-t border-graphite-800 py-12 sm:py-14">
          <SectionHeading
            eyebrow="The patterns"
            title={`${PATTERNS.length} ways free stops being free`}
            description="Every tool in this category uses at least one. None of them are dishonest exactly — they're all disclosed somewhere. They're just disclosed after you've committed."
          />

          <ol className="mt-8 space-y-6">
            {PATTERNS.map((pattern, index) => (
              <li key={pattern.name} className="border-t border-graphite-800 pt-4">
                <p className="font-mono text-xs text-amber-500">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 font-semibold text-text-primary">{pattern.name}</h3>
                <p className="mt-1.5 leading-relaxed text-text-muted">{pattern.happens}</p>
                <p className="mt-2 text-sm text-text-subtle">
                  <span className="font-medium text-text-muted">Tell:</span> {pattern.tell}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* The asset. If anything on this site gets cited or linked, it's
            a checklist that works against every tool in the category —
            including this one.

            The headings count off the arrays rather than saying "five",
            so adding a pattern can't leave the title lying. That's the
            same class of bug as the hardcoded limits, and on this page
            of all pages a miscount is the kind of small wrongness that
            costs the whole argument. */}
        <section className="border-t border-graphite-800 py-12 sm:py-14">
          <SectionHeading
            eyebrow="Before you upload"
            title={`${CHECKLIST.length} questions worth thirty seconds`}
            description="Ask these of any transcription tool, this one included. All of them are answerable from the landing page — if one isn't, that's the answer."
          />

          <dl className="mt-8 divide-y divide-graphite-800 border-y border-graphite-800">
            {CHECKLIST.map((item) => (
              <div key={item.question} className="py-5">
                <dt className="font-medium text-text-primary">{item.question}</dt>
                <dd className="mt-1.5 leading-relaxed text-text-muted">{item.why}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="border-t border-graphite-800 py-12 sm:py-14">
          <SectionHeading
            eyebrow="Same questions, our answers"
            title="Where this one lands"
            description="Including the parts that aren't favourable."
          />

          <div className="mt-8 overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Question</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Answer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3">Where&apos;s the download button?</td>
                  <td className="px-4 py-3 text-text-primary">
                    On the result. TXT, SRT and VTT, no account.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Any number that goes down?</td>
                  <td className="px-4 py-3 text-text-primary">No credits, no total cap.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Card before the first file?</td>
                  <td className="px-4 py-3 text-text-primary">Never. There&apos;s nothing to buy.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Longest file?</td>
                  <td className="px-4 py-3 text-text-primary">{MAX_MINUTES} minutes. Hard limit.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">What do the limits protect?</td>
                  <td className="px-4 py-3 text-text-primary">
                    GPU cost. There is no paid tier.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Which model?</td>
                  <td className="px-4 py-3 text-text-primary">{TRANSCRIPTION_MODEL}.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 space-y-3 leading-relaxed text-text-muted">
            <p>
              The honest downsides, since the checklist above doesn&apos;t ask
              for them: no speaker labels, no transcript editor, no batch mode,
              and {RATE_LIMIT.toLowerCase()} means a couple of quick retries will
              hit a cooldown. If you need to process fifty files or label who
              said what, a paid tool is the right answer and this isn&apos;t it.
            </p>
            {/* Was "in under a minute". The transcription worker spins
                down when idle and takes about a minute to wake, so the
                first run of the day can't be under one — and a page whose
                entire argument is "nobody states the real number" cannot
                be the page with the optimistic number on it. */}
            <p>
              What it is: a transcript, in your hands, usually in a minute or
              two — the first run after a quiet period spends about a minute
              waking the server up — without a form.
            </p>
          </div>
        </section>

        <section className="border-t border-graphite-800 py-12 sm:py-14">
          <SectionHeading eyebrow="Start" title="Pick the one that matches what you have" />

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                href: "/audio-to-text",
                label: "Audio to Text",
                body: "MP3, WAV, M4A, FLAC and more.",
              },
              {
                href: "/youtube-to-text",
                label: "YouTube to Text",
                body: "Paste a link, nothing to download.",
              },
              {
                href: "/video-to-text",
                label: "Video to Text",
                body: "MP4 or MOV straight in, SRT out.",
              },
            ].map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                prefetch={false}
                className="group relative block overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 p-5 transition-colors duration-200 hover:border-amber-500/40 hover:bg-graphite-850 focus:outline-none focus-visible:border-amber-500/50 focus-visible:ring-2 focus-visible:ring-amber-500/30"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-y-5 left-0 w-[2px] origin-center scale-y-0 rounded-full bg-amber-500 transition-transform duration-200 group-hover:scale-y-100 group-focus-visible:scale-y-100 motion-reduce:transition-none"
                />
                <h3 className="flex items-center gap-1 font-semibold text-text-primary transition-colors group-hover:text-amber-400">
                  {tool.label}
                  <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100" />
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">{tool.body}</p>
              </Link>
            ))}
          </div>

          <p className="mt-6 leading-relaxed text-text-muted">
            Not ready to upload anything? Each one has a{" "}
            <Link href="/audio-to-text" prefetch={false} className="text-amber-400 hover:underline">
              sample result
            </Link>{" "}
            you can look at first — the whole output, exports included, without
            sending a file.
          </p>
        </section>

        <div className="border-t border-graphite-800 py-12 sm:py-14">
          <FAQSection eyebrow="Questions" faqs={faqs} />
        </div>
      </main>
    </>
  );
}