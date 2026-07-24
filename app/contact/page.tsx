import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Contact the AudioForges team for support, bug reports, feature requests, copyright inquiries, or general questions about our free audio tools.",
  alternates: {
    canonical: `${SITE_URL}/contact`,
  },
  openGraph: {
    title: "Contact Us",
    description:
      "Contact the AudioForges team for support, bug reports, feature requests, copyright inquiries, or general questions about our free audio tools.",
    url: `${SITE_URL}/contact`,
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
    title: "Contact Us",
    description:
      "Contact the AudioForges team for support, bug reports, feature requests, copyright inquiries, or general questions about our free audio tools.",
    images: ["/images/og-default.png"],
  },
};

const contactJsonLd = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  url: `${SITE_URL}/contact`,
  name: "AudioForges Contact",
};

export default function ContactPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }}
      />

      <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16 text-center space-y-8">
        <div className="space-y-6">
          <h1 className="text-3xl font-bold text-text-primary">
            Contact Us
          </h1>

          <p className="text-text-muted">
            Need help with an AudioForges tool, want to report a bug, request a
            feature, or contact us about copyright? We&apos;d be happy to help.
          </p>

          <a
            href="mailto:contact@audioforges.com"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 text-graphite-950 font-medium px-6 py-3 hover:bg-amber-400 transition-colors"
          >
            <Mail className="h-4 w-4" />
            contact@audioforges.com
          </a>

          <p className="text-sm text-text-subtle">
            We typically respond within 2–3 business days. Response times may
            be longer during busy periods.
          </p>
        </div>

        <section className="space-y-3 text-left max-w-xl mx-auto">
          <h2 className="text-xl font-semibold text-text-primary">
            What you can contact us about
          </h2>
          <ul className="list-disc list-inside text-text-muted space-y-2">
            <li>Technical issues or bugs</li>
            <li>Feature requests and suggestions</li>
            <li>Copyright or DMCA inquiries</li>
            <li>Questions about our audio tools</li>
            <li>General feedback</li>
          </ul>
        </section>

        <section className="text-sm text-text-subtle">
          <p>
            Need to report a copyright issue? See our{" "}
            <Link href="/dmca" className="text-amber-400 hover:underline">
              DMCA Policy
            </Link>
            . Have questions about how we handle data? See our{" "}
            <Link href="/privacy" className="text-amber-400 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </section>
      </main>
    </>
  );
}