import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { SITE_URL } from "@/lib/constants";
import EmailLink from "@/components/EmailLink";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Prose } from "@/components/ui/Prose";
import { ogImage } from "@/lib/og";

const PAGE_TITLE = "Contact";
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
            Contact
          </h1>
          <p className="measure mt-5 text-lg leading-relaxed text-text-muted sm:text-xl">
            One person builds and runs AudioForges, and one person reads this inbox. A bug, a
            tool that gave a bad result, a purchase that did not show up, a copyright notice,
            or a feature you keep wishing was here: write.
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
            Replies usually take a day or two. Purchase problems get looked at first.
          </p>
        </div>

        <section className="mt-14">
          <h2 className="measure text-2xl font-bold tracking-tight text-text-primary">
            What helps me fix it fast
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              ["A tool gave a bad result", "Which tool, the file type and length, and what you expected. If the source is public, a link to it. The models and their limits are on each tool page, so check there first in case it is a known case."],
              ["Credits did not arrive", "The email you paid with and roughly when. That is enough to find the payment and attach it by hand."],
              ["Something is broken", "The page, the browser, and what happened. A screenshot of any error is worth more than a description of it."],
              ["Copyright", "Use the DMCA process rather than this address; it has the details a valid notice needs and is handled the same day."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-xl border border-graphite-800 bg-graphite-900 p-4">
                <p className="font-medium text-text-primary">{t}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{d}</p>
              </div>
            ))}
          </div>
          <Prose className="mt-6">
            <p>
              Copyright notices: <Link href="/dmca">DMCA policy</Link>. How data is handled:{" "}
              <Link href="/privacy">privacy policy</Link>. Who is behind the site:{" "}
              <Link href="/about">about</Link>.
            </p>
          </Prose>
        </section>
      </main>
    </>
  );
}