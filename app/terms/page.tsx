import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Read the AudioForges Terms of Service, including acceptable use, copyright responsibilities, service limitations, liability, and user obligations.",
  alternates: { canonical: `${SITE_URL}/terms` },
  openGraph: {
    title: "Terms of Service",
    description:
      "Read the AudioForges Terms of Service, including acceptable use, copyright responsibilities, service limitations, liability, and user obligations.",
    url: `${SITE_URL}/terms`,
    siteName: "AudioForges",
    type: "website",
    images: [
      {
        url: "/images/og-default.png",
        width: 1200,
        height: 630,
        alt: "AudioForges",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service",
    description:
      "Read the AudioForges Terms of Service, including acceptable use, copyright responsibilities, service limitations, liability, and user obligations.",
    images: ["/images/og-default.png"],
  },
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold text-text-primary mb-2">Terms of Service</h1>
      <p className="text-sm text-text-subtle mb-8">Last updated: July 2026</p>

      <div className="space-y-8 text-text-muted leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">1. Acceptance of terms</h2>
          <p>
            By using AudioForges, you agree to these terms. If you don&apos;t agree,
            please don&apos;t use the site.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">2. Use of the service</h2>
          <p>
            AudioForges provides tools to convert and analyze audio, including
            extracting audio from user-submitted video URLs. You are solely
            responsible for ensuring you have the legal right to download, convert,
            or process any content you submit — including that it is your own
            content, is royalty-free, Creative Commons licensed, public domain, or
            that you have explicit permission from the rights holder.
          </p>
          <p>
            AudioForges does not host, store, or distribute copyrighted material. We
            act only as a processing tool at the user&apos;s request.
          </p>
          <p>
            AudioForges currently does not require user accounts for most features.
            Uploaded files are processed only for the requested operation and are
            not retained longer than necessary to complete processing — you are
            responsible for keeping your own copies of any files you upload or
            results you generate.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">3. Prohibited use</h2>
          <p>
            You may not use AudioForges to infringe copyright, circumvent digital
            rights protections for commercial resale, or process content you do not
            have the right to access.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">4. Usage limits and availability</h2>
          <p>
            We may apply usage limits, file size limits, processing queues, or rate
            limits on any tool to ensure fair use and maintain service availability
            for everyone. These limits may change without notice.
          </p>
          <p>
            Because AudioForges is a free service, features may be modified,
            suspended, or discontinued at any time without prior notice.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">5. No warranty</h2>
          <p>
            The service is provided &quot;as is&quot; without warranties of any kind. We do
            not guarantee uninterrupted availability, accuracy of analysis results
            (key/BPM detection), or fitness for any particular purpose.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">6. Limitation of liability</h2>
          <p>
            AudioForges and its operators are not liable for any damages arising from
            use of the service, including but not limited to copyright claims
            resulting from content you chose to process.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">7. Changes to these terms</h2>
          <p>
            We may update these terms periodically. Continued use of the site after
            changes constitutes acceptance of the updated terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">8. Contact</h2>
          <p>
            Questions about these terms? Reach out via our{" "}
            <Link href="/contact" className="text-amber-400 hover:underline">Contact page</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}