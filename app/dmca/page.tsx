import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "DMCA Policy",
  description:
    "Read the AudioForges DMCA Policy to report copyright infringement, submit takedown notices, and learn our compliance process.",
  alternates: { canonical: `${SITE_URL}/dmca` },
  openGraph: {
    title: "DMCA Policy",
    description:
      "Read the AudioForges DMCA Policy to report copyright infringement, submit takedown notices, and learn our compliance process.",
    url: `${SITE_URL}/dmca`,
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
    title: "DMCA Policy",
    description:
      "Read the AudioForges DMCA Policy to report copyright infringement, submit takedown notices, and learn our compliance process.",
    images: ["/images/og-default.png"],
  },
};

export default function DmcaPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold text-text-primary mb-2">DMCA Policy</h1>
      <p className="text-sm text-text-subtle mb-8">Last updated: July 2026</p>

      <div className="space-y-8 text-text-muted leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">Our position</h2>
          <p>
            AudioForges is a processing tool: users submit a URL or file, and our
            servers perform the requested conversion or analysis on their behalf. We
            do not host, index, or distribute copyrighted content ourselves. We
            comply with valid copyright notices in accordance with applicable law.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">Responsibility for content</h2>
          <p>
            Users are solely responsible for ensuring they have the legal right to
            process any content submitted to our tools, per our{" "}
            <Link href="/terms" className="text-amber-400 hover:underline">Terms of Service</Link>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">Filing a DMCA notice</h2>
          <p>
            If you believe our service has been used to infringe your copyright,
            contact us at{" "}
            <span className="text-amber-400 select-all">dmca@audioforges.com</span>{" "}
            or via our{" "}
            <Link href="/contact" className="text-amber-400 hover:underline">Contact page</Link>,
            with a written notice that includes:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>A physical or electronic signature of the copyright owner or authorized representative</li>
            <li>A description of the copyrighted work you believe was infringed</li>
            <li>The specific URL or details of the infringing use, sufficient for us to locate it</li>
            <li>Your contact information (name, address, phone, email)</li>
            <li>A statement that you have a good-faith belief the use is unauthorized</li>
            <li>A statement, under penalty of perjury, that you are authorized to act on behalf of the rights holder</li>
          </ul>
          <p>
            Please note that submitting a false or bad-faith DMCA notice may carry
            legal consequences for the person submitting it.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">Our response</h2>
          <p>
            We will review valid notices promptly and take appropriate action, which
            may include restricting access to the service for the reported use.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">Counter-notice</h2>
          <p>
            If you believe content or access was restricted in error or
            misidentification, you may submit a counter-notice with your contact
            information, identification of the restricted material, a statement
            under penalty of perjury that you have a good-faith belief the
            restriction was a mistake, and a statement consenting to the
            jurisdiction of the federal court in your district.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">Repeat infringers</h2>
          <p>
            We reserve the right to restrict or terminate access to our tools for
            users who are the subject of repeated, valid copyright infringement
            notices.
          </p>
        </section>
      </div>
    </main>
  );
}