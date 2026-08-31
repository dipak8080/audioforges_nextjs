import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { SITE_URL } from "@/lib/constants";
import EmailLink from "@/components/EmailLink";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Prose } from "@/components/ui/Prose";
import { ogImage } from "@/lib/og";

const PAGE_TITLE = "Contact Us";
const PAGE_DESCRIPTION =
  "Contact the AudioForges team for support, bug reports, feature requests, copyright inquiries, or general questions about our free audio tools.";

const OG_IMAGE = ogImage(
  "Contact AudioForges",
  "Support, bug reports, feature requests and copyright inquiries.",
  "Contact"
);

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/contact`,
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

      <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <Breadcrumb items={[{ name: "Contact" }]} className="mb-8" />

        <header>
          <h1 className="measure-wide text-4xl font-bold leading-[1.06] tracking-[-0.02em] text-text-primary sm:text-5xl">
            Contact us
          </h1>
          <p className="measure mt-5 text-lg leading-relaxed text-text-muted sm:text-xl">
            Need help with a tool, want to report a bug, request a feature, or
            get in touch about copyright? We&apos;d be happy to help.
          </p>
        </header>

        <div className="mt-8">
          <EmailLink
            user="contact"
            domain="audioforges.com"
            className={buttonStyles({ size: "lg" })}
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
          </EmailLink>
          <p className="mt-3 text-sm text-text-subtle">
            We typically respond within 2–3 business days. Response times may be
            longer during busy periods.
          </p>
        </div>

        <section className="mt-14 space-y-4">
          <h2 className="measure text-2xl font-bold tracking-tight text-text-primary">
            What you can contact us about
          </h2>
          <Prose>
            <ul>
              <li>Technical issues or bugs</li>
              <li>Feature requests and suggestions</li>
              <li>Copyright or DMCA inquiries</li>
              <li>Questions about our audio tools</li>
              <li>General feedback</li>
            </ul>
            <p>
              Need to report a copyright issue? See our{" "}
              <Link href="/dmca">DMCA Policy</Link>. Have questions about how we
              handle data? See our <Link href="/privacy">Privacy Policy</Link>.
            </p>
          </Prose>
        </section>
      </main>
    </>
  );
}