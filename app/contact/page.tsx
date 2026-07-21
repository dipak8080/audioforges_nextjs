import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the AudioForges team.",
  alternates: {
    canonical: `${SITE_URL}/contact`,
  },
};

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16 text-center space-y-6">
      <h1 className="text-3xl font-bold text-text-primary">
        Contact Us
      </h1>

      <p className="text-text-muted">
        Questions, bug reports, DMCA notices, or feedback — reach out anytime.
      </p>

      <a
        href="mailto:contact@audioforges.com"
        className="inline-flex items-center gap-2 rounded-lg bg-amber-500 text-graphite-950 font-medium px-6 py-3 hover:bg-amber-400 transition-colors"
      >
        <Mail className="h-4 w-4" />
        contact@audioforges.com
      </a>

      <p className="text-sm text-text-subtle">
        We typically respond within 2–3 business days.
      </p>
    </main>
  );
}