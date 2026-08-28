import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getFeatureFlags } from "@/lib/api/railway";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";
import { PricingTable } from "@/components/credits/PricingTable";
import { StemCompare } from "@/components/credits/StemCompare";
import { TOOLS } from "@/lib/data/tools";
import { SITE_URL } from "@/lib/constants";
import EmailLink from "@/components/EmailLink";

/**
 * WHY THIS PAGE 404s WHILE THE PAYWALL IS OFF
 *
 * The Ko-fi shop is a public URL that exists whether or not this site links
 * to it. An env var can't take it down. So while PAYWALL_ENABLED is false,
 * the job of the frontend is to make sure there is NO reachable path from
 * audioforges.com to a buy button — otherwise someone can pay for credits
 * that have nothing to spend on.
 *
 * notFound() is the right tool: no partial page, no flash of prices, and
 * Next serves the real 404. Flipping PAYWALL_ENABLED brings it back with no
 * deploy.
 */

/**
 * Two level-matched clips of the same bar of the same track, ~20s each,
 * dropped in /public/audio/. StemCompare renders nothing until BOTH are set,
 * so this page ships correct today and gains its best asset with no code
 * change. Pick a dense mix with a long reverb tail — the standard model's
 * bleed has to be audible on laptop speakers or the demo argues against us.
 */
const DEMO_STANDARD = "";
const DEMO_STUDIO = "";

/** Mirrors separation_hq_max_duration_seconds from GET /limits. */
// RAISED 360 -> 600 on 2026-08-28: HQ now accepts the same 10 minutes as
// the standard tier. Mirrors features.separation_hq_max_duration_seconds
// from GET /limits.
const HQ_MAX_SECONDS = 600;

const PAGE_TITLE = "Pricing — AudioForges credits";
const PAGE_DESCRIPTION =
  "One credit runs one GPU-heavy job. No subscription, credits never expire, and every other tool on AudioForges stays free.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/pricing` },
  // Deliberate. Until real buyers have completed the flow in production, an
  // indexed pricing page is a liability: it competes with the "free X"
  // queries the tool pages rank on, and a 404 Google has already crawled as
  // a live page is worse than one it never saw.
  //
  // Remove this block once the paywall has been on and stable for a week.
  robots: { index: false, follow: true },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/pricing`,
    type: "website",
  },
};

const faqs: FAQItem[] = [
  {
    question: "Is AudioForges still free?",
    answer:
      "Yes. Every tool on the site is free and unlimited, including standard vocal removal and stem splitting, with full-quality downloads and no watermark. Credits apply only to jobs that need a GPU, which today means Studio Quality separation and multi-track MIDI. Anything that runs on ordinary CPU processing is free and will stay that way — including standard audio-to-MIDI transcription.",
  },
  {
    question: "What's the difference between standard and Studio Quality?",
    answer:
      "The same job run through a heavier model. Standard separation is good enough for reference tracks, practice, and DJ edits, and it's what most people need. Studio Quality pulls cleaner stems out of dense mixes — less instrumental bleed in the vocal, less vocal ghost in the instrumental — which matters when the stem is going into a release rather than a rehearsal. Run both on the same track and keep whichever you prefer; your first two Studio Quality runs each month are free.",
  },
  {
    question: "Do credits expire?",
    answer:
      "No. Credits stay on your account until you use them, and they work on any tool that takes credits — including ones added after you bought them. There is no subscription, no monthly minimum, and nothing recurring to cancel.",
  },
  {
    question: "What happens if a run fails?",
    answer:
      "Your credit is returned automatically. Refunds are handled server-side the moment a job reaches a failed state, and a background sweeper catches anything that never reports back at all. You never have to ask.",
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

export default async function PricingPage() {
  const { paywallEnabled } = await getFeatureFlags();
  if (!paywallEnabled) notFound();

  const liveToolCount = TOOLS.filter((t) => t.status === "live").length;

  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      {/*
        Framed around CREDITS, not around vocal separation. Credits are the
        currency for anything needing a GPU, and that set will grow — API
        access, long transcription, whatever's next. Writing this as "the
        Studio Quality page" would mean rewriting it, and re-earning its
        rankings, the first time that happens.
      */}
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
        Credits
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
        What one credit buys
      </h1>
      <p className="mt-4 max-w-xl leading-relaxed text-text-muted">
        Most of AudioForges runs on cheap CPU processing and is free and
        unlimited — that never changes. A few jobs need a GPU and cost real
        money per run, so those use credits. Buy once, spend them whenever.
      </p>

      {/*
        THE SPEC PANEL. This is the whole reason the page exists.
        The old H1 was "One credit, one heavy job" — a slogan that never said
        what arrives. Six rows of plain fact do more work than any amount of
        pricing copy, and they read like the file-info panel of a DAW, which
        is the register this audience already trusts.
      */}
      <dl className="mt-8 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900">
        <div className="flex items-baseline justify-between border-b border-graphite-800 bg-graphite-950/40 px-4 py-3">
          <span className="font-mono text-sm font-semibold tabular-nums text-amber-400">
            1 credit
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-subtle">
            Any GPU-backed job
          </span>
        </div>
        {/* Was headed "Studio Quality separation" and described only that.
            Multi-track MIDI is now metered under the same 1-credit rule, and a
            spec panel that names one of two tools makes the other look like a
            surprise charge. The rows stay concrete — the point of this panel is
            that it answers "what do I actually get", which a generic
            "GPU-backed job" alone would not. */}
        <SpecRow label="You get">
          Studio Quality separation — vocals and instrumental, or a full
          four-stem split
        </SpecRow>
        <SpecRow label="Or">
          Multi-track MIDI — one track per detected instrument
        </SpecRow>
        <SpecRow label="Source">An audio file, or a YouTube link</SpecRow>
        <SpecRow label="Track length">
          Up to {Math.floor(HQ_MAX_SECONDS / 60)} minutes. Longer tracks are
          blocked before anything is charged
        </SpecRow>
        <SpecRow label="Files back">
          WAV, full quality, no watermark, no length limit on playback
        </SpecRow>
        <SpecRow label="Turnaround">Usually one to two minutes</SpecRow>
        <SpecRow label="If it fails">
          The credit comes straight back, without you asking
        </SpecRow>
      </dl>

      {/* Silent until the clips exist. */}
      <div className="mt-8">
        <StemCompare
          standardSrc={DEMO_STANDARD}
          studioSrc={DEMO_STUDIO}
          stemLabel="Vocals"
          trackLabel="Dense mix, long reverb tail"
        />
      </div>

      <div className="mt-10">
        <PricingTable />
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
                <th className="px-4 py-3 text-left font-medium text-text-muted">
                  Typical subscription tool
                </th>
                <th className="px-4 py-3 text-left font-medium text-amber-400">
                  AudioForges
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-800">
              <CompareRow label="Billing" them="Monthly, recurring" us="One payment" />
              <CompareRow
                label="Unused capacity"
                them="Expires each month"
                us="Never expires"
              />
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

      <section className="mt-16">
        <SectionHeading
          eyebrow="Still free"
          title={`The other ${liveToolCount - 1}+ tools cost nothing`}
          description="Credits apply only where a GPU is involved. Everything else runs on cheap CPU processing and stays free, unlimited, and sign-up free."
        />
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-graphite-800 bg-graphite-900 p-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-sm leading-relaxed text-text-muted">
            Conversion, trimming, volume, pitch, tempo, noise removal, silence
            splitting, transcription, key and BPM detection, YouTube and TikTok
            extraction — all free, with no metering and no plans to add any.{" "}
            <Link
              href="/tools"
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

      <section className="mt-12 rounded-xl border border-graphite-800 bg-graphite-900 p-5">
        <h2 className="text-sm font-medium text-text-primary">
          Paid and something went wrong?
        </h2>
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

function SpecRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-graphite-800 px-4 py-3 last:border-b-0 sm:flex-row sm:gap-4">
      <dt className="shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-text-subtle sm:w-36 sm:pt-0.5">
        {label}
      </dt>
      <dd className="text-sm leading-relaxed text-text-primary">{children}</dd>
    </div>
  );
}

function CompareRow({
  label,
  them,
  us,
}: {
  label: string;
  them: string;
  us: string;
}) {
  return (
    <tr>
      <td className="px-4 py-3 font-medium text-text-subtle">{label}</td>
      <td className="px-4 py-3 text-text-muted">{them}</td>
      <td className="px-4 py-3 text-text-primary">{us}</td>
    </tr>
  );
}