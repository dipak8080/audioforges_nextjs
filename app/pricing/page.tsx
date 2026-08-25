import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CreditCard, Infinity as InfinityIcon, RotateCcw, ShieldCheck } from "lucide-react";
import { getFeatureFlags } from "@/lib/api/railway";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";
import { PricingTable } from "@/components/credits/PricingTable";
import { TOOLS } from "@/lib/data/tools";
import { SITE_URL } from "@/lib/constants";
import EmailLink from "@/components/EmailLink";

/**
 * WHY THIS PAGE 404s WHILE THE PAYWALL IS OFF
 *
 * The Ko-fi shop is a public URL that exists whether or not this site
 * links to it. An env var can't take it down. So while PAYWALL_ENABLED is
 * false, the job of the frontend is to make sure there is NO reachable
 * path from audioforges.com to a buy button — otherwise someone can pay
 * for credits that have nothing to spend on.
 *
 * notFound() is the right tool: no partial page, no flash of prices, and
 * Next serves the real 404. Combined with the noindex below, Google never
 * banks a pricing page that doesn't work yet.
 *
 * Flipping PAYWALL_ENABLED brings it back with no deploy.
 */

const PAGE_TITLE = "Pricing — Studio Quality credits";
const PAGE_DESCRIPTION =
  "Studio Quality separation runs on credits. No subscription, credits never expire, and every other AudioForges tool stays free.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/pricing` },
  // Deliberate. Until real buyers have completed the flow in production,
  // an indexed pricing page is a liability: it competes with the "free X"
  // queries the tool pages rank on, and a 404 that Google has already
  // crawled as a live page is worse than one it never saw.
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
      "Yes. Every tool on the site is free and unlimited, including standard vocal removal and stem splitting, with full-quality downloads and no watermark. Credits apply to one thing only: Studio Quality separation, which runs a much heavier model on a GPU.",
  },
  {
    question: "Do credits expire?",
    answer:
      "No. Credits stay on your account until you use them. There is no subscription, no monthly minimum, and nothing recurring to cancel.",
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
    question: "How much does one credit get me?",
    answer:
      "One Studio Quality separation of a track up to 6 minutes long. Longer tracks aren't supported at Studio Quality yet, and the site tells you before charging anything.",
  },
  {
    question: "How do I use credits on another device?",
    answer:
      "Choose 'Already bought? Sign in' and enter the email you paid with. We'll send a sign-in link that attaches your credits to that browser. The link expires after 30 minutes.",
  },
];

export default async function PricingPage() {
  const { paywallEnabled } = await getFeatureFlags();
  if (!paywallEnabled) notFound();

  const liveToolCount = TOOLS.filter((t) => t.status === "live").length;

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <div className="max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
          Pricing
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          Studio Quality, when you need it
        </h1>
        <p className="mt-4 leading-relaxed text-text-muted">
          Standard separation is free and unlimited — it always will be. Studio
          Quality runs a much heavier model on a GPU, and that costs real money
          per track, so it runs on credits. Buy once, use them whenever.
        </p>
      </div>

      <div className="mt-10">
        <PricingTable />
      </div>

      {/* The three facts that matter, stated once, prominently. */}
      <ul className="mt-8 grid gap-3 sm:grid-cols-3">
        <ValueProp icon={<CreditCard className="h-4 w-4" />} title="No subscription">
          One payment. Nothing recurring, nothing to cancel.
        </ValueProp>
        <ValueProp icon={<InfinityIcon className="h-4 w-4" />} title="Never expires">
          Credits sit on your account until you use them.
        </ValueProp>
        <ValueProp icon={<RotateCcw className="h-4 w-4" />} title="Automatic refunds">
          A failed run returns its credit without you asking.
        </ValueProp>
      </ul>

      {/*
        The comparison. No competitor is named — naming them dates the page
        the moment they change their plans, and it reads as insecure. The
        contrast speaks for itself because the left column is what everyone
        who has shopped for this already recognises.
      */}
      <section className="mt-16">
        <SectionHeading
          eyebrow="How this differs"
          title="Credits, not a subscription"
          description="Most tools in this category sell monthly minutes. If you don't use them, they're gone, and the charge repeats whether you opened the site or not."
        />
        <div className="mt-6 overflow-hidden rounded-xl border border-graphite-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-graphite-800 bg-graphite-900">
                <th className="w-1/3 px-4 py-3 text-left font-medium text-text-subtle">
                  &nbsp;
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
              <CompareRow label="Unused capacity" them="Expires each month" us="Never expires" />
              <CompareRow label="Free tier" them="Preview only, no download" us="Full download, no watermark" />
              <CompareRow label="Account" them="Required to start" us="Not required" />
              <CompareRow label="Failed job" them="Usually still counted" us="Refunded automatically" />
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-16">
        <SectionHeading
          eyebrow="Still free"
          title={`The other ${liveToolCount - 1}+ tools cost nothing`}
          description="Credits apply to Studio Quality separation only. Everything else on the site runs on cheap CPU processing and stays free, unlimited, and sign-up free."
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

function ValueProp({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="rounded-xl border border-graphite-800 bg-graphite-900 p-4">
      <div className="flex items-center gap-2 text-amber-400">
        {icon}
        <span className="text-sm font-medium text-text-primary">{title}</span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{children}</p>
    </li>
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