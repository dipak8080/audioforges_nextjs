import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Read the AudioForges Privacy Policy to learn how we collect, use, store, and protect your data, including cookies, analytics, and your privacy rights.",
  alternates: { canonical: `${SITE_URL}/privacy` },
  openGraph: {
    title: "Privacy Policy",
    description:
      "Read the AudioForges Privacy Policy to learn how we collect, use, store, and protect your data, including cookies, analytics, and your privacy rights.",
    url: `${SITE_URL}/privacy`,
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
    title: "Privacy Policy",
    description:
      "Read the AudioForges Privacy Policy to learn how we collect, use, store, and protect your data, including cookies, analytics, and your privacy rights.",
    images: ["/images/og-default.png"],
  },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold text-text-primary mb-2">Privacy Policy</h1>
      <p className="text-sm text-text-subtle mb-8">Last updated: July 2026</p>

      <div className="space-y-8 text-text-muted leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">1. Overview</h2>
          <p>
            AudioForges (&quot;we&quot;, &quot;us&quot;) provides free audio tools including
            YouTube-to-audio conversion and audio analysis. This policy explains what
            data we collect when you use our site and tools, and how it&apos;s used.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">2. Information we collect</h2>
          <p>
            <strong className="text-text-primary">URLs and files you submit:</strong>{" "}
            when you use our converter or analyzer, the YouTube URL or audio file you
            submit is sent to our backend server solely to process your request.
            Uploaded files and submitted URLs are processed only for the time needed
            to complete that request. Temporary processing files are automatically
            deleted after processing finishes, or after a short retention period if
            required for system reliability. We do not permanently store or
            distribute the audio files or URLs you submit.
          </p>
          <p>
            <strong className="text-text-primary">Usage analytics:</strong> we use
            Google Analytics to understand aggregate traffic patterns (pages
            visited, approximate location, device type). Analytics data is
            processed according to Google&apos;s own privacy practices; we use it in
            aggregate and do not use it to individually identify visitors.
          </p>
          <p>
            <strong className="text-text-primary">Server logs:</strong> like most
            websites, our hosting and backend infrastructure automatically records
            basic technical information for security and reliability purposes,
            such as IP address, browser type, request timestamps, and error logs.
            These logs are used for troubleshooting and abuse prevention, not for
            tracking individual users across sessions.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">3. Advertising</h2>
          <p>
            We do not currently display third-party advertisements. If advertising
            is introduced in the future, this Privacy Policy will be updated to
            describe it before those services are enabled.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">4. Third-party services</h2>
          <p>
            We currently use Google Analytics to understand aggregate site usage,
            and our hosting providers — Vercel for the website, and VPS Dime for
            backend processing — to run the site and tools. Each of these providers
            has its own privacy policy governing how they handle data.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">5. Cookies</h2>
          <p>
            We use a small number of cookies for basic site functionality
            (&quot;essential cookies&quot;) and, via Google Analytics, cookies that
            help us understand aggregate traffic patterns
            (&quot;analytics cookies&quot;). We do not currently use advertising
            cookies. You can disable cookies in your browser settings, though this
            may affect site functionality.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">6. How we use your information</h2>
          <p>
            Any file or URL you submit is used solely to provide the tool
            functionality you requested — converting, analyzing, or otherwise
            processing that specific submission. We do not use submitted content
            for any other purpose.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">7. Security</h2>
          <p>
            We use HTTPS encryption for data in transit, restrict server access to
            what&apos;s necessary to operate the service, and take reasonable
            measures to protect the infrastructure our tools run on. No method of
            transmission or storage is 100% secure, but we work to keep processing
            infrastructure secure and minimize what data is retained in the first
            place.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">8. Children&apos;s privacy</h2>
          <p>
            AudioForges is not directed toward children under 13, and we do not
            knowingly collect personal information from children.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">9. Your rights</h2>
          <p>
            You may request information about data we hold or request deletion by
            contacting us at the email listed on our{" "}
            <Link href="/contact" className="text-amber-400 hover:underline">Contact page</Link>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">10. Changes to this policy</h2>
          <p>
            We may update this policy from time to time. Changes will be posted on
            this page with an updated revision date.
          </p>
        </section>
      </div>
    </main>
  );
}