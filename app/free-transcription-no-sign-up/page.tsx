import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Prose } from "@/components/ui/Prose";
import { FAQSection } from "@/components/faq/FAQSection";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { TRANSCRIPTION_MODEL } from "@/lib/api/transcription";
import { ogImage } from "@/lib/og";
import { getLimits, windowFor, rateLimitLabel, durationLabel } from "@/lib/api/limits";

/**
 * PUBLISHED is fixed. LAST_VERIFIED moves when the patterns, the limits or
 * the model actually change — not on every deploy. These were one constant,
 * so dateModified could never differ from datePublished and the freshness
 * signal was stale from the day it shipped.
 */
// `: string` is load-bearing — without it TS narrows both to literal types
// and flags the LAST_VERIFIED !== PUBLISHED check below as impossible.
const PUBLISHED: string = "2026-08-20";
const LAST_VERIFIED: string = "2026-08-31";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

// 37 chars → 51 with the suffix. Targets the generic cluster ("free
// transcription no sign up", "transcribe without an account") rather than
// brand queries — see the note on competitor naming below.
const PAGE_TITLE = "Free Transcription Without Signing Up";
const PAGE_DESCRIPTION =
  "Why most free transcription tools ask for an account halfway through, how to spot it before you upload, and where to get one with no sign-up or card.";

const OG_IMAGE = ogImage(
  "Free transcription without signing up",
  "Six ways free stops being free, and how to spot each one before you upload.",
  "Guide"
);

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  // `keywords` removed. It was the last page on the site still emitting it —
  // ignored by Google since 2009, treated as a spam signal by Bing, and a
  // poor look on the page arguing against marketing theatre.
  alternates: { canonical: `${SITE_URL}/free-transcription-no-sign-up` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/free-transcription-no-sign-up`,
    siteName: SITE_NAME,
    type: "article",
    publishedTime: PUBLISHED,
    modifiedTime: LAST_VERIFIED,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

// Article, not WebApplication — this page is editorial. The tool schema lives
// on the three tool pages it links to; duplicating it here would put four
// WebApplication entities on one site for one product.
const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  datePublished: PUBLISHED,
  dateModified: LAST_VERIFIED,
  author: { "@type": "Organization", name: SITE_NAME },
  publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  image: `${SITE_URL}${OG_IMAGE.url}`,
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": `${SITE_URL}/free-transcription-no-sign-up`,
  },
};

// BreadcrumbList comes from <Breadcrumb />; FAQPage from <FAQSection />.

/**
 * NOTE ON NAMING COMPETITORS (deliberate omission).
 *
 * "is [brand] really free" queries exist and this page could chase them. It
 * doesn't, because publishing specific claims about someone else's pricing
 * means being wrong the week they change a tier — and being caught wrong
 * about a rival's pricing would destroy the one thing this page is built on.
 *
 * The patterns below are stable, apply to every tool in the category, and in
 * aggregate the generic cluster is larger than any single brand query. If
 * brand pages are ever added, they need a review date and someone actually
 * re-checking the tiers.
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
    why: '"Advanced AI" is not an answer. A named model is checkable; an accuracy percentage without methodology is a marketing number.',
  },
];

const TOOL_LINKS = [
  { href: "/audio-to-text", label: "Audio to Text", body: "MP3, WAV, M4A, FLAC and more." },
  { href: "/youtube-to-text", label: "YouTube to Text", body: "Paste a link, nothing to download." },
  { href: "/video-to-text", label: "Video to Text", body: "MP4 or MOV straight in, SRT out." },
];

export default async function FreeTranscriptionPage() {
  /*
    DERIVED END-TO-END, not from the hand table with a literal fallback.
    That fallback read "2 per 5 minutes" — the figure this route carried
    before 2026-08-26 — so the branch that only runs when something is
    already broken printed a number twelve times too generous. On the page
    whose entire argument is that nobody states the real number, that is the
    worst possible place for a stale one.
  */
  const limits = await getLimits();

  const rateLimit = rateLimitLabel(
    limits.rateLimits.speech_to_text ?? 2,
    windowFor(limits, "speech_to_text")
  );
  const maxLength = durationLabel(limits.featureDurations.transcription);

  /**
   * Every answer opens with the answer. Extractive summarisers — the ones
   * behind AI Overviews — take the first clause, so an answer that spends its
   * opening sentence on setup gets skipped or misquoted.
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
        "This one never asks for payment details before a file, and never asks for an account at all. There is a paid option — credits, bought once, for people who transcribe a lot — but nothing is required up front and no card is stored. Worth checking specifically elsewhere: a card requested before the first file usually means a trial that converts, not a free tier, and the two get described with the same word.",
    },
    {
      question: "What's the catch here?",
      answer: `Length, frequency, and a monthly allowance. ${maxLength} per file, ${rateLimit}, and a couple of free transcriptions a month — after that a run costs one credit, roughly 20–30 cents. All stated up front. There is still no account, no card, and no export paywall: every transcript downloads as TXT, SRT and VTT whether you paid or not.`,
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <main id="main" className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:pt-14">
        <Breadcrumb
          items={[{ name: "Free transcription without signing up" }]}
          className="mb-8"
        />

        <header>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
            Free, and what that usually means
          </p>
          <h1 className="measure-wide mt-5 text-4xl font-bold leading-[1.04] tracking-[-0.025em] text-text-primary sm:text-5xl">
            Free transcription without signing up
          </h1>
          <Prose className="mt-5">
            <p className="text-lg">
              If you landed here after uploading a file somewhere else and
              hitting a sign-up prompt, you weren&apos;t imagining it.
              That&apos;s the standard shape of &quot;free&quot; in this
              category — no account to start, an account to finish.
            </p>
            <p>
              This page covers why it works that way, how to spot it before you
              waste an upload, and where the line falls here.
            </p>
          </Prose>

          {/* Visible date, not just schema. Editorial pages in this SERP are
              listicles refreshed quarterly that say so; an undated page reads
              as abandoned beside them. Says what was re-checked rather than
              "updated", which on most sites means a build ran. */}
          <p className="mt-6 font-mono text-xs text-text-subtle">
            Published <time dateTime={PUBLISHED}>{formatDate(PUBLISHED)}</time>
            {LAST_VERIFIED !== PUBLISHED && (
              <>
                {" · "}patterns and limits re-checked{" "}
                <time dateTime={LAST_VERIFIED}>{formatDate(LAST_VERIFIED)}</time>
              </>
            )}
          </p>
        </header>

        {/* Pattern recognition, not a hit list. Useful to someone evaluating
            any tool in the category, which is what makes it worth linking to —
            a page that only says "we're the good one" is an ad and reads as
            one. */}
        <section className="mt-14 border-t border-graphite-800 py-14">
          <SectionHeading
            eyebrow="The patterns"
            title={`${PATTERNS.length} ways free stops being free`}
            description="Every tool in this category uses at least one. None of them are dishonest exactly — they're all disclosed somewhere. They're just disclosed after you've committed."
          />

          <ol className="mt-8 space-y-6">
            {PATTERNS.map((pattern, index) => (
              <li key={pattern.name} className="measure border-t border-graphite-800 pt-4">
                <p className="font-mono text-xs text-amber-500">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 font-semibold text-text-primary">{pattern.name}</h3>
                <p className="mt-1.5 leading-relaxed text-text-body">{pattern.happens}</p>
                <p className="mt-2 text-sm text-text-subtle">
                  <span className="font-medium text-text-muted">Tell:</span> {pattern.tell}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* The asset. If anything on this site gets cited or linked, it's a
            checklist that works against every tool in the category —
            including this one.

            The headings count off the arrays rather than saying "five", so
            adding a pattern can't leave the title lying. Same class of bug as
            a hardcoded limit, and on this page a miscount costs the whole
            argument. */}
        <section className="border-t border-graphite-800 py-14">
          <SectionHeading
            eyebrow="Before you upload"
            title={`${CHECKLIST.length} questions worth thirty seconds`}
            description="Ask these of any transcription tool, this one included. All of them are answerable from the landing page — if one isn't, that's the answer."
          />

          <Prose className="mt-8">
            <dl>
              {CHECKLIST.map((item) => (
                <Fragment key={item.question}>
                  <dt>{item.question}</dt>
                  <dd>{item.why}</dd>
                </Fragment>
              ))}
            </dl>
          </Prose>
        </section>

        <section className="border-t border-graphite-800 py-14">
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
                  {/*
                    THIS ROW USED TO SAY "No credits, no total cap." True until
                    transcription became metered, and leaving it would have made
                    this the page running Pattern 01 while printing a checklist
                    for spotting it.
                  */}
                  <td className="px-4 py-3">Any number that goes down?</td>
                  <td className="px-4 py-3 text-text-primary">
                    Yes — a small free monthly allowance, then credits.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Card before the first file?</td>
                  <td className="px-4 py-3 text-text-primary">Never. Nothing is stored, ever.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Longest file?</td>
                  <td className="px-4 py-3 text-text-primary">{maxLength}. Hard limit.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">What do the limits protect?</td>
                  <td className="px-4 py-3 text-text-primary">
                    GPU cost — and past the free allowance, yes, a paid tier.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Which model?</td>
                  <td className="px-4 py-3 text-text-primary">{TRANSCRIPTION_MODEL}.</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/*
            The page has to say this itself. Its whole argument is that these
            tools disclose the gate after you've committed — so the moment one
            of the patterns applies here, it belongs stated outright rather
            than inferred from a table row.
          */}
          <div className="measure mt-6 rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-4">
            <p className="text-[1.0625rem] leading-relaxed text-text-body">
              <span className="font-medium text-text-primary">
                Which pattern do we use?
              </span>{" "}
              Pattern 01, the credit wall — partly. There is a small free
              allowance each month, and past it a transcription costs one
              credit. What we don&apos;t do is the other five: no account, no
              email, no card, no export paywall, no watermark, and the length
              limit is on this page rather than in small print. The download
              button works identically whether you paid or not — export is the
              most commonly gated feature in this category and it is never
              gated here.{" "}
              <Link
                href="/pricing"
                prefetch={false}
                className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
              >
                What credits cost
              </Link>
              .
            </p>
          </div>

          <Prose className="mt-5">
            <p>
              The honest downsides, since the checklist above doesn&apos;t ask
              for them: no speaker labels, no transcript editor, no batch mode,
              and {rateLimit.toLowerCase()} means a couple of quick retries will
              hit a cooldown. The free allowance is also shared with the Studio
              Quality separation tools, so a heavy week on those leaves less
              here. If you need to process fifty files or label who said what, a
              paid tool is the right answer and this isn&apos;t it.
            </p>
            {/* Was "in under a minute". The transcription worker spins down
                when idle and takes about a minute to wake, so the first run of
                the day can't be under one — and a page whose argument is
                "nobody states the real number" cannot carry the optimistic
                one. */}
            <p>
              What it is: a transcript, in your hands, usually in a minute or
              two — the first run after a quiet period spends about a minute
              waking the server up — without a form.
            </p>
          </Prose>
        </section>

        <section className="border-t border-graphite-800 py-14">
          <SectionHeading eyebrow="Start" title="Pick the one that matches what you have" />

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {TOOL_LINKS.map((tool) => (
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

          <Prose className="mt-6">
            <p>
              Not ready to upload anything? Each one has a{" "}
              <Link href="/audio-to-text" prefetch={false}>
                sample result
              </Link>{" "}
              you can look at first — the whole output, exports included,
              without sending a file.
            </p>
          </Prose>
        </section>

        <div className="border-t border-graphite-800 py-14">
          <FAQSection eyebrow="Questions" faqs={faqs} />
        </div>
      </main>
    </>
  );
}