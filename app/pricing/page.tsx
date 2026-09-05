import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getFeatureFlags } from "@/lib/api/railway";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";
import { PricingTable } from "@/components/credits/PricingTable";
import { StemCompare } from "@/components/credits/StemCompare";
import { TOOLS } from "@/lib/data/tools";
import { SITE_URL } from "@/lib/constants";
import { getLimits, durationLabel } from "@/lib/api/limits";
import { ogImage } from "@/lib/og";
import EmailLink from "@/components/EmailLink";

/**
 * WHY THIS PAGE 404s WHILE THE PAYWALL IS OFF
 *
 * The Ko-fi shop is a public URL that exists whether or not this site links to
 * it. An env var can't take it down. So while PAYWALL_ENABLED is false, the
 * frontend's job is to make sure there is NO reachable path from
 * audioforges.com to a buy button — otherwise someone can pay for credits that
 * have nothing to spend on.
 *
 * notFound() is the right tool: no partial page, no flash of prices, and Next
 * serves the real 404. Flipping PAYWALL_ENABLED brings it back with no deploy.
 *
 * ORDER MATTERS ON THIS PAGE. Nearly everyone here arrives from a paywall they
 * just hit, mid-task, wanting one number. The packs sit directly under the H1;
 * everything justifying the price comes after it. That's the order people
 * actually read in: how much → what do I get → why should I believe you.
 */

/** Two level-matched clips of the same bar of the same track, ~20s each.
 *  StemCompare renders nothing until both are set. WAV on purpose — the claim
 *  is separation quality, and demonstrating it with a lossy file invites the
 *  obvious retort. StemCompare keeps them at preload="metadata" until first
 *  play, so the ~6.9MB isn't fetched for visitors who never press it. */
const DEMO_STANDARD = "/audio/demo-vocals-standard.wav";
const DEMO_STUDIO = "/audio/demo-vocals-studio.wav";

const PAGE_TITLE = "Pricing — AudioForges credits";
const PAGE_DESCRIPTION =
  "Credits run the GPU-heavy jobs — most one credit each. No subscription, credits never expire, and every other tool on AudioForges stays free.";

const OG_IMAGE = ogImage(
  "Pay once, per heavy job",
  "Credits run the GPU jobs. No subscription, and credits never expire.",
  "Pricing"
);

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/pricing` },
  /*
    INDEXED as of 2026-08-29 — no `robots` key, so this inherits the site
    default. It was noindex while the paywall was provisional, for two reasons
    that no longer hold: a 404 Google has crawled as a live page is worse than
    one it never saw (only true while PAYWALL_ENABLED might flip back off, and
    it won't — the metered tools depend on it), and it competes with the
    "free X" queries the tool pages rank on (it doesn't; those pages own those
    terms, and this one targets someone who has already met a limit and wants
    a price). The cost of hiding it was concrete: the only route to the page
    that sells anything was to hit a paywall first.
  */
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/pricing`,
    siteName: "AudioForges",
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

export default async function PricingPage() {
  const { paywallEnabled, paywallTools } = await getFeatureFlags();
  if (!paywallEnabled) notFound();

  const limits = await getLimits();
  const hqMaxLabel = durationLabel(limits.featureDurations.separationHq);

  /**
   * Whether audio-to-sheet actually CHARGES right now, resolved live from the
   * backend flag — never assumed. While PAYWALL_TOOL_AUDIO_TO_SHEET_ENABLED is
   * off the tool runs free (charged: "none"), so it must not appear here as a
   * paid tool at all: not in the cost table, not in the metered count, not in
   * the free-tier FAQ. Flip the env and it appears at 3 credits with no deploy.
   * This is the same rule railway.ts states for the "1 credit" badge.
   */
  const sheetCharges = Boolean(paywallTools["audio-to-sheet"]);
  const mixCharges = Boolean(paywallTools["audio-to-midi-hq-mix"]);
  const anyThreeCredit = sheetCharges || mixCharges;

  /**
   * Every metered job and what it costs — the one place cost is stated, so the
   * one-credit tools and the three-credit one can't drift apart in prose. Each
   * carries its OWN output formats and length note, because those genuinely
   * differ per tool: a blanket "Files back: WAV" was true only for separation,
   * and became a lie the moment a tool that returns PDF joined the list.
   */
  const meteredJobs: { name: string; cost: number; detail: string }[] = [
    {
      name: "Studio Quality separation",
      cost: 1,
      detail: `Cleaner vocals and instrumental, or a full four-stem split, from a heavier model. Up to ${hqMaxLabel}. Returns WAV, full quality, no watermark.`,
    },
    {
      name: "High-accuracy MIDI — piano or guitar",
      cost: 1,
      detail:
        "A model trained for that one instrument. Best on solo recordings; can isolate the part from a mix first. Returns MIDI.",
    },
    ...(mixCharges
      ? [
          {
            name: "Full-mix MIDI",
            cost: 3,
            detail:
              "Splits the track into stems, then transcribes each with the model best at it — bass, piano, guitar, vocals and other on separate tracks, tempo set from the detected BPM. One separation plus up to four transcriptions is why it's three.",
          },
        ]
      : []),
    {
      name: "Transcription",
      cost: 1,
      detail: "Audio, video or a YouTube link, turned into text.",
    },
    ...(sheetCharges
      ? [
          {
            name: "Audio to sheet music",
            cost: 3,
            detail:
              "A recording engraved into readable notation — PDF, MusicXML, MIDI and SVG. A multi-stage GPU-plus-engraving job with a higher-value output, which is why it's three rather than one.",
          },
        ]
      : []),
  ];

  // No arithmetic. Nothing here is a paid TOOL — free tools have optional paid
  // MODES, which is both accurate and the stronger claim.
  const liveToolCount = TOOLS.filter((t) => t.status === "live").length;

  // The metered list named in the "still free" FAQ, kept in step with what
  // actually charges. Understating this is the one error that becomes a refund.
  const meteredList = sheetCharges
    ? "Studio Quality separation, high-accuracy MIDI, transcription, and audio-to-sheet-music"
    : "Studio Quality separation, high-accuracy MIDI, and transcription";

  const faqs: FAQItem[] = [
    {
      question: "Is AudioForges still free?",
      answer: `Yes. Every tool that runs on ordinary CPU processing is free and unlimited, with full-quality downloads and no watermark — including standard vocal removal, stem splitting and standard audio-to-MIDI. Credits apply only to jobs that need a GPU, which today means ${meteredList}. Everything on cheap processing stays free and there are no plans to change that.`,
    },
    {
      question: "Why do some jobs cost more than one credit?",
      answer:
        "Most GPU jobs are a single model run and cost one credit. A few do more work for a single result: full-mix MIDI splits the track into stems and runs a separate transcription on each, and audio-to-sheet-music runs a transcription, then tempo and key analysis, then engraves the score — so those cost three credits. The cost of a job tracks the work behind it, not the tool it came from.",
    },
    {
      question: "What's the difference between standard and Studio Quality?",
      answer:
        "The same job run through a heavier model. Standard separation is good enough for reference tracks, practice, and DJ edits, and it's what most people need. Studio Quality pulls cleaner stems out of dense mixes — less instrumental bleed in the vocal, less vocal ghost in the instrumental — which matters when the stem is going into a release rather than a rehearsal. Run both on the same track and keep whichever you prefer: every visitor gets free runs each month, and the tool shows how many you have left before you spend one.",
    },
    {
      question: "Do credits expire?",
      answer:
        "No. Credits stay on your account until you use them, and they work on any tool that takes credits — including ones added after you bought them. There is no subscription, no monthly minimum, and nothing recurring to cancel.",
    },
    {
      question: "What happens if a run fails?",
      answer:
        "Your credits are returned automatically. Refunds are handled server-side the moment a job reaches a failed state, and a background sweeper catches anything that never reports back at all. A three-credit job refunds all three. You never have to ask.",
    },
    {
      question: "Do I need an account?",
      answer:
        "No. Credits are tied to your browser. You give an email at checkout only so we can match your Ko-fi payment back to you — Ko-fi's payment notification doesn't tell us who paid, so the email is the link. If you later want your credits on a different device, you can sign in with that same email.",
    },
    {
      question: "How do I use credits on another device?",
      answer:
        "Choose 'Already bought? Sign in' and enter the email you paid with. We'll send a sign-in link that attaches your credits to that browser. The link expires after 30 minutes. If both devices are in front of you, the account menu can show a QR code instead, which is faster.",
    },
  ];

  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <Breadcrumb items={[{ name: "Pricing" }]} className="mb-8" />

      {/*
        Framed around CREDITS, not around any one tool. Credits are the currency
        for anything needing a GPU, and that set grows. Writing this as "the
        Studio Quality page" would mean rewriting it, and re-earning its
        rankings, the first time that happens — which it just did.
      */}
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">Credits</p>
        <h1 className="measure-wide mt-5 text-4xl font-bold leading-[1.04] tracking-[-0.025em] text-text-primary sm:text-5xl">
          Pay once, per heavy job
        </h1>
        <p className="measure mt-5 text-lg leading-relaxed text-text-muted">
          Most of AudioForges runs on cheap CPU processing and is free and
          unlimited — that never changes. A few jobs need a GPU and cost real
          money per run, so those take credits
          {anyThreeCredit ? " — most one credit each, a few a little more" : " — one credit each"}.
        </p>

        {/* Three facts, stated before the packs rather than after them. These
            are the objections someone brings TO a price, so they belong beside
            it, not three sections down. */}
        <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em] text-text-subtle">
          {["No subscription", "Never expires", "Refunded if a run fails"].map((fact) => (
            <li key={fact} className="flex items-center gap-1.5">
              <span aria-hidden className="h-1 w-1 rounded-full bg-amber-400" />
              {fact}
            </li>
          ))}
        </ul>
      </header>

      {/* THE PACKS, DIRECTLY UNDER THE H1 — see the note at the top. */}
      <div className="mt-8">
        <PricingTable />
      </div>

      {/*
        THE COST TABLE — the ANSWER to the price rather than the preamble to it.
        Replaces the old "one credit, one job" spec header, which stopped being
        true when a three-credit job joined. Rows of plain fact do more work
        than pricing copy and read like a DAW's file-info panel, the register
        this audience already trusts.
      */}
      <section className="mt-16">
        <SectionHeading
          eyebrow="What you get"
          title="What each job costs"
          description={
            sheetCharges
              ? "Every GPU-backed job is priced by the work behind it. Most are one credit; a couple do more for a single result and cost more."
              : "Every GPU-backed job costs the same one credit, whichever tool it came from."
          }
        />
        <dl className="mt-6 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900">
          {meteredJobs.map((job) => (
            <div
              key={job.name}
              className="flex flex-col gap-1 border-b border-graphite-800 px-4 py-4 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4"
            >
              <dt className="flex shrink-0 items-baseline gap-2 sm:w-44">
                <span className="font-mono text-sm font-semibold tabular-nums text-amber-400">
                  {job.cost} {job.cost === 1 ? "credit" : "credits"}
                </span>
              </dt>
              <dd className="text-sm leading-relaxed text-text-primary">
                <span className="font-medium">{job.name}</span>
                <span className="mt-0.5 block text-text-muted">{job.detail}</span>
              </dd>
            </div>
          ))}
        </dl>

        {sheetCharges && (
          <p className="mt-3 text-sm text-text-subtle">
            A sheet-music song is 3 credits, so the packs above are roughly 3, 10 and 33 songs.
          </p>
        )}

        {/* The facts that ARE common to every metered job, once the per-job
            differences (cost, formats, length) are out of the way. */}
        <dl className="mt-4 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900">
          <SpecRow label="Source">An audio file, or a YouTube link</SpecRow>
          <SpecRow label="Files back">Full quality, no watermark, no playback limit</SpecRow>
          <SpecRow label="Turnaround">Usually one to two minutes</SpecRow>
          <SpecRow label="If it fails">Every credit comes straight back, without you asking</SpecRow>
        </dl>
      </section>

      {/* The A/B. The rows say what you get; this says what it sounds like —
          the only claim on this page a reader can check for themselves rather
          than take on trust. */}
      <div className="mt-8">
        <StemCompare
          standardSrc={DEMO_STANDARD}
          studioSrc={DEMO_STUDIO}
          stemLabel="Vocals"
          trackLabel="Dense mix, long reverb tail"
        />
      </div>

      {/*
        No competitor is named. Naming one dates the page the day they change
        their plans, and it reads as insecure. The left column is already
        recognisable to anyone who has shopped for this.
      */}
      <section className="mt-16">
        <SectionHeading
          eyebrow="How this differs"
          title="Credits, not a subscription"
          description="Most tools in this category sell monthly minutes. If you don't use them they're gone, and the charge repeats whether or not you opened the site."
        />
        <div className="mt-6 overflow-hidden rounded-xl border border-graphite-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-graphite-800 bg-graphite-900">
                <th className="w-1/3 px-4 py-3 text-left font-medium text-text-subtle">
                  <span className="sr-only">Comparison</span>
                </th>
                <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-text-subtle">
                  Typical subscription tool
                </th>
                <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-amber-400">
                  AudioForges
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-800">
              <CompareRow label="Billing" them="Monthly, recurring" us="One payment" />
              <CompareRow label="Unused capacity" them="Expires each month" us="Never expires" />
              <CompareRow
                label="Free tier"
                them="Preview only, no download"
                us="Full download, no watermark"
              />
              <CompareRow label="Account" them="Required to start" us="Not required" />
              <CompareRow
                label="Failed job"
                them="Usually still counted"
                us="Refunded automatically"
              />
            </tbody>
          </table>
        </div>
      </section>

      {/*
        NO ARITHMETIC. The metered count is meteredJobs.length, resolved from the
        live flags above — so it reads "three" while audio-to-sheet is free and
        "four" the moment it charges, with no edit here.

        TRANSCRIPTION WAS LISTED AS FREE AND HAS NOT BEEN SINCE 2026-08-29;
        audio-to-sheet is the same trap in waiting. A pricing page understating
        what it charges for is the one error that turns into a refund request,
        so this whole section is driven off meteredJobs / meteredList rather
        than a hand-written list that a later launch would leave stale.
      */}
      <section className="mt-16">
        <SectionHeading
          eyebrow="Still free"
          title="Almost everything is free and unlimited"
          description={`Of ${liveToolCount} tools, credits apply to ${meteredJobs.length} GPU-backed jobs. Everything else runs free with no sign-up and no metering.`}
        />
        <div className="mt-6 rounded-xl border border-graphite-800 bg-graphite-900 p-5">
          <p className="text-sm leading-relaxed text-text-muted">
            Conversion, trimming, volume, pitch, tempo, noise removal, silence
            splitting, key and BPM detection, standard audio-to-MIDI, YouTube
            and TikTok extraction — all free, with no metering and no plans to
            add any. Standard vocal removal and stem splitting are free too,
            with full-quality downloads and no watermark.{" "}
            <Link
              href="/tools"
              prefetch={false}
              className="text-amber-400 underline-offset-4 hover:underline"
            >
              Browse everything
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="mt-16">
        <FAQSection faqs={faqs} eyebrow="Questions" />
      </section>

      {/* h3, not h2 — a footnote under the page's content rather than a
          section sitting in the outline beside the real ones. */}
      <section className="mt-12 rounded-xl border border-graphite-800 bg-graphite-900 p-5">
        <h3 className="text-sm font-medium text-text-primary">
          Paid and something went wrong?
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
          Email us and we&apos;ll sort it out manually — include the email you
          paid with.{" "}
          <EmailLink
            user="contact"
            domain="audioforges.com"
            className="text-amber-400 underline-offset-4 hover:underline"
          />
        </p>
      </section>
    </main>
  );
}

function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-graphite-800 px-4 py-3 last:border-b-0 sm:flex-row sm:gap-4">
      <dt className="shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-text-subtle sm:w-36 sm:pt-0.5">
        {label}
      </dt>
      <dd className="text-sm leading-relaxed text-text-primary">{children}</dd>
    </div>
  );
}

function CompareRow({ label, them, us }: { label: string; them: string; us: string }) {
  return (
    <tr>
      <td className="px-4 py-3 font-medium text-text-subtle">{label}</td>
      <td className="px-4 py-3 text-text-muted">{them}</td>
      <td className="px-4 py-3 text-text-primary">{us}</td>
    </tr>
  );
}