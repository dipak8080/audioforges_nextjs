import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How AudioForges collects, uses, and protects your data.",
  alternates: { canonical: `${SITE_URL}/privacy` },
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
            data we collect when you use our site and tools.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">2. Information we collect</h2>
          <p>
            <strong className="text-text-primary">URLs and files you submit:</strong>{" "}
            when you use our converter or analyzer, the YouTube URL or audio file you
            submit is sent to our backend server to process your request. We do not
            permanently store the audio files or URLs you submit — they are processed
            and discarded.
          </p>
          <p>
            <strong className="text-text-primary">Usage analytics:</strong> we use
            Google Analytics to understand aggregate traffic patterns (pages visited,
            approximate location, device type). This data is anonymized and not tied
            to your identity.
          </p>
          <p>
            <strong className="text-text-primary">Advertising cookies:</strong> we
            display ads through Adsterra, which may set cookies
            to show relevant ads. These third parties may use cookies to serve ads
            based on your prior visits to this or other websites.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">3. Third-party services</h2>
          <p>
            We use the following third-party services, each with their own privacy
            policies: Google Analytics, Google AdSense, Adsterra, and our hosting
            providers (Vercel for the site, VPS Dime for backend processing).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">4. Cookies</h2>
          <p>
            We use cookies for basic site functionality and, via our advertising
            partners, to serve relevant ads. You can disable cookies in your browser
            settings, though this may affect site functionality and ad relevance.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">5. Your rights</h2>
          <p>
            You may request information about data we hold or request deletion by
            contacting us at the email listed on our{" "}
            <a href="/contact" className="text-amber-400 hover:underline">Contact page</a>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">6. Changes to this policy</h2>
          <p>
            We may update this policy from time to time. Changes will be posted on
            this page with an updated revision date.
          </p>
        </section>
      </div>
    </main>
  );
}