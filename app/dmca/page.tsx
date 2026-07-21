import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DMCA Policy",
  description: "AudioForges' DMCA takedown policy and copyright compliance process.",
  alternates: { canonical: "https://audioforges.com/dmca" },
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
            do not host, index, or distribute copyrighted content ourselves — no
            files are stored after processing completes.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">Responsibility for content</h2>
          <p>
            Users are solely responsible for ensuring they have the legal right to
            process any content submitted to our tools, per our{" "}
            <a href="/terms" className="text-amber-400 hover:underline">Terms of Service</a>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">Filing a DMCA notice</h2>
          <p>
            If you believe our service has been used to infringe your copyright,
            contact us via our{" "}
            <a href="/contact" className="text-amber-400 hover:underline">Contact page</a>{" "}
            with:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>A description of the copyrighted work you believe was infringed</li>
            <li>The specific URL or details of the infringing use</li>
            <li>Your contact information</li>
            <li>A statement that you have a good-faith belief the use is unauthorized</li>
            <li>A statement, under penalty of perjury, that you are authorized to act on behalf of the rights holder</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">Our response</h2>
          <p>
            We will review valid notices promptly and take appropriate action, which
            may include restricting access to the service for the reported use.
          </p>
        </section>
      </div>
    </main>
  );
}