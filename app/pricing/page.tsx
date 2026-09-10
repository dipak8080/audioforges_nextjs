import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getFeatureFlags } from "@/lib/api/railway";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";
import { PricingTable } from "@/components/credits/PricingTable";
import { StemCompare } from "@/components/credits/StemCompare";
import { CompareTable } from "@/components/tools/CompareTable";
import { ProofStrip } from "@/components/tools/ProofStrip";
import { PageByline } from "@/components/tools/PageByline";
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
 * audioforges.com to a buy button, otherwise someone can pay for credits that
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
 *  StemCompare renders nothing until both are set. WAV on purpose, the claim
 *  is separation quality, and demonstrating it with a lossy file invites the
 *  obvious retort. StemCompare keeps them at preload="metadata" until first
 *  play, so the ~6.9MB isn't fetched for visitors who never press it. */
const DEMO_STANDARD = "/audio/demo-vocals-standard.wav";
const DEMO_STUDIO = "/audio/demo-vocals-studio.wav";

const UPDATED = "2026-09-10";

const PAGE_TITLE = "Pricing – Credits, No Subscription";
const PAGE_DESCRIPTION =
  "Credits pay for the GPU jobs only, most one credit each. No subscription, credits never expire, failed runs refund. Every other AudioForges tool stays free.";

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
    INDEXED as of 2026-08-29, no `robots` key, so this inherits the site
    default. It was noindex while the paywall was provisional, for two reasons
    that no longer hold: a 404 Google has crawled as a live page is worse than
    one it never saw (only true while PAYWALL_ENABLED might flip back off, and
    it won't, the metered tools depend on it), and it competes with the
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
   * backend flag, never assumed. While PAYWALL_TOOL_AUDIO_TO_SHEET_ENABLED is
   * off the tool runs free (charged: "none"), so it must not appear here as a
   * paid tool at all: not in the cost table, not in the metered count, not in
   * the free-tier FAQ. Flip the env and it appears at 3 credits with no deploy.
   * This is the same rule railway.ts states for the "1 credit" badge.
   */
  const sheetCharges = Boolean(paywallTools["audio-to-sheet"]);
  const mixCharges = Boolean(paywallTools["audio-to-midi-hq-mix"]);
  const anyThreeCredit = sheetCharges || mixCharges;

  /**
   * Every metered job and what it costs, the one place cost is stated, so the
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
      name: "High-accuracy MIDI, piano or guitar",
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
              "Splits the track into stems, then transcribes each with the model best at it, bass, piano, guitar, vocals and other on separate tracks, tempo set from the detected BPM. One separation plus up to four transcriptions is why it's three.",
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
              "A recording engraved into readable notation, PDF, MusicXML, MIDI and SVG. A multi-stage GPU-plus-engraving job with a higher-value output, which is why it's three rather than one.",
          },
        ]
      : []),
  ];

  // No arithmetic. Nothing here is a paid TOOL, free tools have optional paid
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
      answer: `Yes. Every tool that runs on ordinary CPU processing is free and unlimited, with full-quality downloads and no watermark, including standard vocal removal, stem splitting and standard audio-to-MIDI. Credits apply only to jobs that need a GPU, which today means ${meteredList}. Everything on cheap processing stays free and there are no plans to change that.`,
    },
    {
      question: "Why do some jobs cost more than one credit?",
      answer:
        "Most GPU jobs are a single model run and cost one credit. A few do more work for a single result: full-mix MIDI splits the track into stems and runs a separate transcription on each, and audio-to-sheet-music runs a transcription, then tempo and key analysis, then engraves the score, so those cost three credits. The cost of a job tracks the work behind it, not the tool it came from.",
    },
    {
      question: "What's the difference between standard and Studio Quality?",
      answer:
        "The same job run through a heavier model. Standard separation is good enough for reference tracks, practice, and DJ edits, and it's what most people need. Studio Quality pulls cleaner stems out of dense mixes, less instrumental bleed in the vocal, less vocal ghost in the instrumental, which matters when the stem is going into a release rather than a rehearsal. Run both on the same track and keep whichever you prefer: every visitor gets free runs each month, and the tool shows how many you have left before you spend one.",
    },
    {
      question: "Do credits expire?",
      answer:
        "No. Credits stay on your account until you use them, and they work on any tool that takes credits, including ones added after you bought them. There is no subscription, no monthly minimum, and nothing recurring to cancel.",
    },
    {
      question: "What happens if a run fails?",
      answer:
        "Your credits are returned automatically. Refunds are handled server-side the moment a job reaches a failed state, and a background sweeper catches anything that never reports back at all. A three-credit job refunds all three. You never have to ask.",
    },
    {
      question: "Do I need an account?",
      answer:
        "No. Credits are tied to your browser. You give an email at checkout only so we can match your Ko-fi payment back to you, Ko-fi's payment notification doesn't tell us who paid, so the email is the link. If you later want your credits on a different device, you can sign in with that same email.",
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

      <header>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
          No subscription · Never expires · Refunded if a run fails
        </p>
        <h1 className="measure-wide mt-5 text-4xl font-bold leading-[1.04] tracking-[-0.025em] text-text-primary sm:text-5xl">
          Pay once, per heavy job
        </h1>
        <p className="measure mt-5 text-lg leading-relaxed text-text-muted">
          {liveToolCount} tools run on ordinary CPU processing and are free without limit. The few that need a GPU
          cost real money per run, so those take credits
          {anyThreeCredit ? ", most one credit each, a couple a little more" : ", one credit each"}. Everyone
          gets free runs every month before a credit is ever spent.
        </p>
      </header>

      <div className="mt-8">
        <PricingTable studioCredits={1} sheetCredits={sheetCharges ? 3 : 0} />
      </div>

      <section className="mt-16">
        <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">What one credit buys</h2>
        <div className="mt-6">
          <CompareTable
            columns={["Credits", "What you get"]}
            highlight={-1}
            gridClass="sm:grid-cols-[minmax(9rem,1fr)_5rem_2.2fr]"
            rows={meteredJobs.map((job) => ({
              label: job.name,
              cells: [
                { text: `${job.cost}`, mono: true },
                { text: job.detail },
              ],
            }))}
            footnote="Priced by the work behind the job, not the tool it came from. A single model run is one credit; a job that runs several models for one result costs more."
          />
        </div>
        <div className="mt-4">
          <ProofStrip
            proofs={[
              { label: "Source", value: "An audio file, or a YouTube link", note: "Same inputs as the free tier." },
              { label: "Files back", value: "Full quality, no watermark", note: "WAV for separation, MIDI or PDF for the rest. No playback limit." },
              { label: "Turnaround", value: "Usually one to two minutes", note: "If a run fails, every credit comes back without you asking." },
            ]}
          />
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Hear what the credit buys</h2>
        <p className="measure mt-3 text-text-muted">
          The vocal stem from both tiers, on the same song. Click a lane to switch while it plays; the playhead
          stays put. This is the only claim on the page you can check with your ears instead of taking on trust.
        </p>
        <div className="mt-6">
          <StemCompare
            standardSrc={DEMO_STANDARD}
            studioSrc={DEMO_STUDIO}
            stemLabel="Vocals"
            trackLabel="Dense mix, long reverb tail"
            cues={[
              { at: 6, label: "quiet passage" },
              { at: 19, label: "held note" },
              { at: 31, label: "reverb tail" },
            ]}
          />
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Credits, not a subscription</h2>
        <div className="mt-6">
          <CompareTable
            columns={["AudioForges credits", "LALAL.AI"]}
            highlight={0}
            rows={[
              {
                label: "How you pay",
                cells: [
                  { state: "yes", text: "Per job. Buy a pack, spend it when you need it" },
                  { state: "partial", text: "Monthly subscription, $9.99 to $19.99, plus one-time minute top-ups" },
                ],
              },
              {
                label: "Do they expire",
                cells: [
                  { state: "yes", text: "Never" },
                  { state: "unknown", text: "Not stated on their pricing page" },
                ],
              },
              {
                label: "Account needed",
                cells: [
                  { state: "yes", text: "No. Credits attach to your browser; an email links a payment to it" },
                  { state: "no", text: "Required for full results" },
                ],
              },
              {
                label: "Free tier",
                cells: [
                  { state: "yes", text: "Full-length standard runs, unlimited, plus free Studio runs monthly" },
                  { state: "partial", text: "Preview only. Full download is paid" },
                ],
              },
              {
                label: "If a run fails",
                cells: [
                  { state: "yes", text: "Credits refunded automatically" },
                  { state: "unknown", text: "Not stated" },
                ],
              },
            ]}
            footnote={`Checked against LALAL.AI's live pricing page on ${UPDATED}. Details may change.`}
          />
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Almost everything stays free</h2>
        <p className="measure mt-3 leading-relaxed text-text-muted">
          Credits apply only to {meteredList}. Standard vocal removal, stem splitting, standard audio-to-MIDI,
          every converter, the recorder, the tuner, the metronome and the rest run on cheap processing and stay
          free without limit, full-quality downloads, no watermark. There are no plans to change that.{" "}
          <Link href="/tools">See every tool</Link>.
        </p>
      </section>

      <section className="mt-16">
        <FAQSection faqs={faqs} />
      </section>

      <section className="mt-12 rounded-xl border border-graphite-800 bg-graphite-900 p-5">
        <h3 className="text-sm font-medium text-text-primary">Something wrong with a purchase?</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
          Credits not showing after paying, or a run that charged and never delivered: write to{" "}
          <EmailLink user="contact" domain="audioforges.com" className="text-amber-400 underline-offset-4 hover:underline" />{" "}
          with the email you paid with and it gets fixed by hand.
        </p>
      </section>

      <div className="mt-12">
        <PageByline updated={UPDATED} note="Prices and packs are read live from the backend" />
      </div>
    </main>
  );
}