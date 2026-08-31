import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/constants";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Prose } from "@/components/ui/Prose";
import { ogImage } from "@/lib/og";

const PAGE_TITLE = "Terms of Service";
const PAGE_DESCRIPTION =
  "Read the AudioForges Terms of Service, including acceptable use, copyright responsibilities, service limitations, liability, and user obligations.";

/** Update whenever the terms text changes — it's a claim about the text below
 *  it, so a stale date is worse than no date. */
const LAST_UPDATED = "2026-08-01";

const OG_IMAGE = ogImage(
  "Terms of Service",
  "Acceptable use, copyright responsibilities, limits and liability.",
  "Legal"
);

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/terms` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/terms`,
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

export default function TermsPage() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <Breadcrumb items={[{ name: "Terms of Service" }]} className="mb-8" />

      <header>
        <h1 className="measure-wide text-4xl font-bold leading-[1.06] tracking-[-0.02em] text-text-primary sm:text-5xl">
          Terms of Service
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
        <h2 id="acceptance">1. Acceptance of terms</h2>
        <p>
          By using AudioForges, you agree to these terms. If you don&apos;t
          agree, please don&apos;t use the site.
        </p>

        <h2 id="use-of-service">2. Use of the service</h2>
        <p>
          AudioForges provides tools to convert and analyze audio, including
          extracting audio from user-submitted video URLs. You are solely
          responsible for ensuring you have the legal right to download,
          convert, or process any content you submit — including that it is your
          own content, is royalty-free, Creative Commons licensed, public domain,
          or that you have explicit permission from the rights holder.
        </p>
        <p>
          AudioForges does not host, store, or distribute copyrighted material.
          We act only as a processing tool at the user&apos;s request.
        </p>
        <p>
          AudioForges currently does not require user accounts for most features.
          Uploaded files are processed only for the requested operation and are
          not retained longer than necessary to complete processing — you are
          responsible for keeping your own copies of any files you upload or
          results you generate. Some processing, including AI vocal separation
          and stem splitting, runs on third-party compute infrastructure under
          the same no-permanent-storage handling; see our{" "}
          <Link href="/privacy">Privacy Policy</Link> for the specific providers
          involved.
        </p>
        <p>
          Some browser-based tools, including the instrument tuner and the online
          voice recorder, analyze microphone input directly in your browser
          rather than uploading it to AudioForges servers. These tools do not
          involve file uploads or server-side processing of your microphone
          audio.
        </p>

        <h2 id="prohibited-use">3. Prohibited use</h2>
        <p>
          You may not use AudioForges to infringe copyright, circumvent digital
          rights protections or access restrictions on copyrighted content, or
          process content you do not have the right to access.
        </p>

        <h2 id="limits">4. Usage limits and availability</h2>
        <p>
          We may apply usage limits, file size limits, processing queues, or rate
          limits on any tool to ensure fair use and maintain service availability
          for everyone. These limits may change without notice.
        </p>
        <p>
          Because AudioForges is a free service, features may be modified,
          suspended, or discontinued at any time without prior notice.
        </p>

        <h2 id="no-warranty">5. No warranty</h2>
        <p>
          The service is provided &quot;as is&quot; without warranties of any
          kind. We do not guarantee uninterrupted availability, accuracy of
          analysis results (key/BPM detection), or fitness for any particular
          purpose.
        </p>

        <h2 id="liability">6. Limitation of liability</h2>
        <p>
          AudioForges and its operators are not liable for any damages arising
          from use of the service, including but not limited to copyright claims
          resulting from content you chose to process.
        </p>

        <h2 id="changes">7. Changes to these terms</h2>
        <p>
          We may update these terms periodically. Continued use of the site after
          changes constitutes acceptance of the updated terms.
        </p>

        <h2 id="contact">8. Contact</h2>
        <p>
          Questions about these terms? Reach out via our{" "}
          <Link href="/contact">Contact page</Link>.
        </p>
      </Prose>
    </main>
  );
}