import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/constants";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Prose } from "@/components/ui/Prose";
import { ogImage } from "@/lib/og";

const PAGE_TITLE = "Refund Policy";
const PAGE_DESCRIPTION =
  "AudioForges credits are a digital product delivered instantly. All sales are final. Credits from a failed job are returned automatically.";

const LAST_UPDATED = "2026-09-24";

const OG_IMAGE = ogImage("Refund Policy", "Digital credits, delivered instantly. All sales are final.", "Legal");

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/refunds` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/refunds`,
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

export default function RefundsPage() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <Breadcrumb items={[{ name: "Refund Policy" }]} className="mb-8" />

      <header>
        <h1 className="measure-wide text-4xl font-bold leading-[1.06] tracking-[-0.02em] text-text-primary sm:text-5xl">
          Refund Policy
        </h1>
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.14em] text-text-subtle">
          Last updated{" "}
          <time dateTime={LAST_UPDATED}>
            {new Date(LAST_UPDATED).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time>
        </p>
      </header>

      <Prose className="mt-10">
        <p>
          <strong>All credit purchases are final.</strong> Credits are a digital product. They are
          delivered to your browser the moment your payment is confirmed, and they can be used
          straight away. Because of this, we do not offer refunds, returns, or exchanges once a
          purchase is complete.
        </p>

        <h2 id="why">Why there are no refunds</h2>
        <p>
          You can test every credit tool before paying. Every visitor gets free runs each month on
          the same GPU tools that credits pay for, at the same quality, and every other tool on the
          site is free and unlimited. By the time you buy, you have already seen exactly what you
          are paying for. Credits never expire, so there is no pressure to use them quickly, and
          they work on every credit tool, including ones added after you bought them.
        </p>

        <h2 id="final">What this means</h2>
        <ul>
          <li>No refunds for unused or partly used credits.</li>
          <li>No refunds for change of mind, buying the wrong pack, or buying more than you needed.</li>
          <li>No refunds because a result did not sound the way you hoped. Separation and
            transcription are automatic processes and results vary with the source material, which
            is why the free runs exist.</li>
          <li>Credits cannot be transferred to another person or exchanged for cash.</li>
          <li>Opening a payment dispute for a purchase that was delivered may result in the credits
            from that purchase being removed.</li>
        </ul>

        <h2 id="failed-jobs">The one automatic exception: failed jobs</h2>
        <p>
          If a job that used credits fails, the credits for that job are returned to your balance
          automatically, usually within seconds and always within a few hours. A three credit job
          returns all three. You never have to ask, and you never lose credits to a failure on our
          side.
        </p>

        <h2 id="problems">Credits that did not arrive</h2>
        <p>
          If you paid and your balance did not update, this is a delivery problem, not a refund
          request, and we fix it. Email{" "}
          <a href="mailto:contact@audioforges.com">contact@audioforges.com</a> with the email
          address you paid with and roughly when you paid. Purchase problems are looked at before
          anything else, and the credits are attached to you by hand.
        </p>

        <h2 id="processor">Who processes your payment</h2>
        <p>
          Purchases are processed by Dodo Payments, our reseller and Merchant of Record. Your
          receipt comes from Dodo Payments, which may also review a refund request under its own
          terms, shown at checkout.
        </p>

        <h2 id="law">Your legal rights</h2>
        <p>
          Nothing in this policy removes rights that consumer law in your country gives you and
          that cannot be excluded by agreement. Where such a law requires a refund, we will provide
          one.
        </p>

        <h2 id="terms">Related</h2>
        <p>
          This policy is part of our <Link href="/terms">Terms of Service</Link>. Prices and pack
          sizes are on the <Link href="/pricing">pricing page</Link>.
        </p>
      </Prose>
    </main>
  );
}