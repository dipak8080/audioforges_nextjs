"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

export interface FAQItem {
  /** The question text, used in both the schema and the visible heading. */
  question: string;
  /**
   * Plain-text answer. This is what feeds the FAQPage JSON-LD schema, so it
   * must always be provided even when `answerNode` is used for a richer
   * visual version - schema.org's Answer.text field can't hold JSX/links.
   */
  answer: string;
  /**
   * Optional richer version for on-page display only (e.g. an answer that
   * contains an inline <Link>). When provided, this renders instead of the
   * plain `answer` string - but `answer` is still what goes into the schema,
   * so keep the two in sync in meaning even if one has a link and the other
   * doesn't.
   */
  answerNode?: React.ReactNode;
}

/**
 * Renders both the FAQPage JSON-LD schema AND the visible accordion UI from
 * a single array - the two can never drift out of sync, because there's
 * only one place the content is written. Replaces the old pattern of a
 * hand-written `faqJsonLd` object plus a separately hand-written JSX block
 * repeating the same questions and answers.
 *
 * HEADING (2026-08-17): `eyebrow` and `title` are optional, so every
 * existing call site keeps its current output. Pass an eyebrow on pages
 * that use the mono-eyebrow section heading and the FAQ stops reading as
 * if it belongs to a different page.
 */
export function FAQSection({
  faqs,
  eyebrow,
  title = "Frequently asked questions",
}: {
  faqs: FAQItem[];
  eyebrow?: string;
  title?: string;
}) {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <section className="space-y-6">
        <div>
          {eyebrow && (
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
              {eyebrow}
            </p>
          )}
          <h2
            className={`text-2xl font-bold tracking-tight text-text-primary sm:text-3xl ${
              eyebrow ? "mt-3" : ""
            }`}
          >
            {title}
          </h2>
        </div>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <FAQItemRow key={i} faq={faq} />
          ))}
        </div>
      </section>
    </>
  );
}

function FAQItemRow({ faq }: { faq: FAQItem }) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();

  return (
    <div
      className={`rounded-lg border bg-graphite-900 transition-colors ${
        isOpen ? "border-amber-500/30" : "border-graphite-800"
      }`}
    >
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="w-full flex items-center justify-between gap-4 px-4 sm:px-5 py-3.5 text-left rounded-lg hover:bg-graphite-850/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50 transition-colors"
      >
        <span className="text-sm sm:text-[15px] font-medium text-text-primary">
          {faq.question}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-amber-400" : "text-text-subtle"
          }`}
        />
      </button>
      {/* grid-rows 0fr/1fr trick: animates to the answer's natural height
          without measuring it in JS, and collapses back to zero cleanly. */}
      <div
        id={panelId}
        role="region"
        aria-hidden={!isOpen}
        className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <p className="px-4 sm:px-5 pb-4 text-sm text-text-muted leading-relaxed">
            {faq.answerNode ?? faq.answer}
          </p>
        </div>
      </div>
    </div>
  );
}