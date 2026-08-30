import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getFeatureFlags } from "@/lib/api/railway";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";
import { PricingTable } from "@/components/credits/PricingTable";
import { StemCompare } from "@/components/credits/StemCompare";
import { TOOLS } from "@/lib/data/tools";
import { SITE_URL } from "@/lib/constants";
import { getLimits, durationLabel } from "@/lib/api/limits";
import EmailLink from "@/components/EmailLink";

/**
 * WHY THIS PAGE 404s WHILE THE PAYWALL IS OFF
 *
 * The Ko-fi shop is a public URL that exists whether or not this site links to
 * it. An env var can't take it down. So while PAYWALL_ENABLED is false, the
 * job of the frontend is to make sure there is NO reachable path from
 * audioforges.com to a buy button — otherwise someone can pay for credits that
 * have nothing to spend on.
 *
 * notFound() is the right tool: no partial page, no flash of prices, and Next
 * serves the real 404. Flipping PAYWALL_ENABLED brings it back with no deploy.
 *
 * ── THIS PASS: THE PRICE WAS NOT ON THE PRICING PAGE ───────────────────
 *
 * 1. THE ORDER WAS WRONG, AND IT WAS THE WHOLE PROBLEM. Above <PricingTable />
 *    sat an eyebrow, an H1 phrased as a question, a paragraph, a seven-row
 *    spec panel and an audio demo — roughly two screens before a number
 *    appeared. Almost everyone landing here arrives from a paywall they just
 *    hit, mid-task, wanting one figure. They were given an essay first.
 *
 *    The packs now sit directly under the H1. Everything that justifies the
 *    price comes after it, which is the order someone actually reads in: how
 *    much → what do I get → why should I believe you.
 *
 * 2. THE FREE-TOOL COUNT WAS WRONG, AND THE FRAMING UNDERSOLD THE TRUTH. It
 *    read `liveToolCount - 1`, subtracting one paid tool, on a page whose own
 *    spec panel names two paid things and whose own comment says "five metered
 *    tools".
 *
 *    But no tool here is paid. Separation and audio-to-MIDI are free tools
 *    that each have an optional heavier MODE. "40 free tools plus 2 paid ones"
 *    is a weaker and less accurate claim than "every tool is free; two of them
 *    have an optional paid mode" — so the arithmetic is gone entirely.
 *
 * 3. THE LENGTH CAP IS DERIVED. HQ_MAX_SECONDS was hardcoded at 600 under two
 *    stacked comments, both claiming to mirror GET /limits, one of them stale
 *    from the 360 → 600 change. It reads from featureDurations.separationHq
 *    now, like every other figure on the site.
 *
 * 4. THE DEMO IS LIVE. Both clips are in /public/audio/, so StemCompare now
 *    renders instead of returning null — the page's single most persuasive
 *    element, and until today every argument here was made in prose.
 *
 *    ⚠️ Check StemCompare's <audio> tags carry preload="none" before shipping.
 *    The two WAVs are ~6.9MB together; without that attribute every visitor
 *    downloads both on page load whether or not they press play. See the note
 *    on the constants below.
 *
 * INDEXING: no `robots` key, so this inherits the site default and IS
 * indexable — deliberately, since 2026-08-29. Worth confirming it's in
 * app/sitemap.ts too: nothing links here except a paywall, so without a
 * sitemap entry the only discovery path is hitting a limit first.
 */

/**
 * Two level-matched clips of the same bar of the same track, ~20s each.
 * StemCompare renders nothing until BOTH are set — they are now, so the demo
 * is live.
 *
 * ⚠️ THESE ARE WAV, ~3.4MB EACH — about 6.9MB on a page whose job is to load
 * fast for someone who just hit a paywall mid-task. That is roughly ten times
 * the whole rest of the page.
 *
 * It is the right format to SHIP from (the argument is audio quality, and
 * serving a lossy file to demonstrate separation quality invites the obvious
 * retort), but it is the wrong thing to DOWNLOAD unasked. Two fixes, in order
 * of value:
 *
 *   1. StemCompare's <audio> elements must carry preload="none". Without it
 *      the browser fetches both files on page load, so every visitor pays
 *      6.9MB whether or not they press play. Check that before shipping — it
 *      matters more than the format does.
 *   2. If the payload still hurts, 192kbps MP3 brings it to ~600KB. The bleed
 *      being demonstrated sits well above the compression floor, so it stays
 *      clearly audible.
 */
const DEMO_STANDARD = "/audio/demo-vocals-standard.wav";
const DEMO_STUDIO = "/audio/demo-vocals-studio.wav";

const PAGE_TITLE = "Pricing — AudioForges credits";
const PAGE_DESCRIPTION =
  "One credit runs one GPU-heavy job. No subscription, credits never expire, and every other tool on AudioForges stays free.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/pricing` },
  /*
    INDEXED as of 2026-08-29. This was noindex while the paywall was still
    provisional, for two reasons that no longer hold:

      - "a 404 Google has crawled as a live page is worse than one it never
        saw" — true while PAYWALL_ENABLED might be flipped back off, which
        makes this route call notFound(). It is now load-bearing for five
        metered tools and is not going off.
      - "it competes with the 'free X' queries the tool pages rank on" — the
        tool pages own those terms and this page targets a different intent
        entirely: someone who has already met a limit and is looking for a
        price. Those are not the same searcher.

    The cost of leaving it hidden was concrete: the only route to the page
    that sells anything was to hit a paywall first, so it earned no organic
    traffic at all.
  */
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

  const limits = await getLimits();

  // Was hardcoded at 600 under two comments both claiming to mirror /limits,
  // one of them left over from the 360 → 600 change on 2026-08-28.
  const hqMaxLabel = durationLabel(limits.featureDurations.separationHq);

  // No arithmetic. Nothing here is a paid TOOL — two free tools have an
  // optional paid MODE, which is both the accurate statement and the stronger
  // one. The old `liveToolCount - 1` subtracted a paid tool that doesn't exist.
  const liveToolCount = TOOLS.filter((t) => t.status === "live").length;

  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      {/*
        Framed around CREDITS, not around vocal separation. Credits are the
        currency for anything needing a GPU, and that set will grow. Writing
        this as "the Studio Quality page" would mean rewriting it, and
        re-earning its rankings, the first time that happens.
      */}
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
          Credits
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          Pay once, per heavy job
        </h1>
        <p className="mt-4 max-w-xl leading-relaxed text-text-muted">
          Most of AudioForges runs on cheap CPU processing and is free and
          unlimited — that never changes. A few jobs need a GPU and cost real
          money per run, so those take one credit each.
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

      {/*
        THE PACKS, DIRECTLY UNDER THE H1.

        This used to sit below the spec panel and the demo — about two screens
        down. Nearly everyone who reaches this page arrives from a paywall they
        just hit, mid-task, and wants one number. Making them scroll past an
        argument to find it is the single biggest problem this page had.
      */}
      <div className="mt-8">
        <PricingTable />
      </div>

      {/*
        THE SPEC PANEL. Now the ANSWER to the price rather than the preamble to
        it. Six rows of plain fact do more work than any amount of pricing
        copy, and they read like the file-info panel of a DAW, which is the
        register this audience already trusts.
      */}
      <section className="mt-16">
        <SectionHeading
          eyebrow="What you get"
          title="One credit, one job"
          description="Both metered jobs cost the same, and both are optional heavier modes of tools that are otherwise free."
        />
        <dl className="mt-6 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900">
          <div className="flex items-baseline justify-between border-b border-graphite-800 bg-graphite-950/40 px-4 py-3">
            <span className="font-mono text-sm font-semibold tabular-nums text-amber-400">
              1 credit
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-subtle">
              Any GPU-backed job
            </span>
          </div>
          {/* Was headed "Studio Quality separation" and described only that.
              Multi-track MIDI is metered under the same 1-credit rule, and a
              spec panel that names one of two makes the other look like a
              surprise charge. */}
          <SpecRow label="You get">
            Studio Quality separation — vocals and instrumental, or a full
            four-stem split
          </SpecRow>
          <SpecRow label="Or">
            Multi-track MIDI — one track per detected instrument
          </SpecRow>
          <SpecRow label="Source">An audio file, or a YouTube link</SpecRow>
          <SpecRow label="Track length">
            Up to {hqMaxLabel}. Longer tracks are blocked before anything is
            charged
          </SpecRow>
          <SpecRow label="Files back">
            WAV, full quality, no watermark, no length limit on playback
          </SpecRow>
          <SpecRow label="Turnaround">Usually one to two minutes</SpecRow>
          <SpecRow label="If it fails">
            The credit comes straight back, without you asking
          </SpecRow>
        </dl>
      </section>

      {/* The A/B. Sits directly after the spec panel: the rows say what you
          get, this says what it sounds like — which is the only claim on this
          page a reader can check for themselves rather than take on trust. */}
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

      {/*
        THE COUNT IS GONE. It read "The other {liveToolCount - 1}+ tools cost
        nothing" — minus one, on a page naming two paid things.

        More importantly the framing was weaker than the truth. No tool here is
        paid: separation and audio-to-MIDI are free tools with an optional
        heavier mode. Saying that is both accurate and a better claim than any
        arithmetic.
      */}
      <section className="mt-16">
        <SectionHeading
          eyebrow="Still free"
          title="Every tool is free. Two have an optional paid mode."
          description={`All ${liveToolCount} tools run free and unlimited with no sign-up. Credits apply only to the two heavier modes above — never to a tool as a whole.`}
        />
        <div className="mt-6 rounded-xl border border-graphite-800 bg-graphite-900 p-5">
          <p className="text-sm leading-relaxed text-text-muted">
            Conversion, trimming, volume, pitch, tempo, noise removal, silence
            splitting, transcription, key and BPM detection, YouTube and TikTok
            extraction — all free, with no metering and no plans to add any.
            Standard vocal removal and stem splitting are free too, with
            full-quality downloads and no watermark.{" "}
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