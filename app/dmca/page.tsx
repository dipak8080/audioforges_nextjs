import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/constants";
import EmailLink from "@/components/EmailLink";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Prose } from "@/components/ui/Prose";
import { ogImage } from "@/lib/og";

const PAGE_TITLE = "DMCA Policy";
const PAGE_DESCRIPTION =
  "Read the AudioForges DMCA Policy to report copyright infringement, submit takedown notices, and learn our compliance process.";

/** Update whenever the policy text changes — it's a claim about the text
 *  below it, so a stale date is worse than no date. */
const LAST_UPDATED = "2026-07-01";

const OG_IMAGE = ogImage(
  "DMCA Policy",
  "How to report copyright infringement and submit a takedown notice.",
  "Legal"
);

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/dmca` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/dmca`,
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

export default function DmcaPage() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <Breadcrumb items={[{ name: "DMCA Policy" }]} className="mb-8" />

      <header>
        <h1 className="measure-wide text-4xl font-bold leading-[1.06] tracking-[-0.02em] text-text-primary sm:text-5xl">
          DMCA Policy
        </h1>
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.14em] text-text-subtle">
          Last updated{" "}
          <time dateTime={LAST_UPDATED}>
            {new Date(LAST_UPDATED).toLocaleDateString("en-GB", {
              month: "long",
              year: "numeric",
            })}
          </time>
        </p>
      </header>

      <Prose className="mt-10">
        <h2 id="position">Our position</h2>
        <p>
          AudioForges is a processing tool: users submit a URL or file, and our
          servers perform the requested conversion or analysis on their behalf.
          We do not host, index, or distribute copyrighted content ourselves. We
          comply with valid copyright notices in accordance with applicable law.
        </p>

        <h2 id="responsibility">Responsibility for content</h2>
        <p>
          Users are solely responsible for ensuring they have the legal right to
          process any content submitted to our tools, per our{" "}
          <Link href="/terms">Terms of Service</Link>.
        </p>

        <h2 id="filing">Filing a DMCA notice</h2>
        <p>
          If you believe our service has been used to infringe your copyright,
          contact us at{" "}
          <EmailLink user="dmca" domain="audioforges.com" /> or via our{" "}
          <Link href="/contact">Contact page</Link>, with a written notice that
          includes:
        </p>
        <ul>
          <li>
            A physical or electronic signature of the copyright owner or
            authorized representative
          </li>
          <li>A description of the copyrighted work you believe was infringed</li>
          <li>
            The specific URL or details of the infringing use, sufficient for us
            to locate it
          </li>
          <li>Your contact information (name, address, phone, email)</li>
          <li>
            A statement that you have a good-faith belief the use is unauthorized
          </li>
          <li>
            A statement, under penalty of perjury, that you are authorized to act
            on behalf of the rights holder
          </li>
        </ul>
        <p>
          Please note that submitting a false or bad-faith DMCA notice may carry
          legal consequences for the person submitting it.
        </p>

        <h2 id="response">Our response</h2>
        <p>
          We will review valid notices promptly and take appropriate action,
          which may include restricting access to the service for the reported
          use.
        </p>

        <h2 id="counter-notice">Counter-notice</h2>
        <p>
          If you believe content or access was restricted in error or
          misidentification, you may submit a counter-notice with your contact
          information, identification of the restricted material, a statement
          under penalty of perjury that you have a good-faith belief the
          restriction was a mistake, and a statement consenting to the
          jurisdiction of the federal court in your district.
        </p>

        <h2 id="repeat-infringers">Repeat infringers</h2>
        <p>
          We reserve the right to restrict or terminate access to our tools for
          users who are the subject of repeated, valid copyright infringement
          notices.
        </p>
      </Prose>
    </main>
  );
}