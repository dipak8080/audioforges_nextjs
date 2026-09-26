import type { Metadata } from "next";
import Link from "next/link";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FAQSection } from "@/components/faq/FAQSection";
import { StudioPanel } from "./StudioPanel";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { ogImage } from "@/lib/og";
import { USE_CASES, USE_CASES_INDEXABLE } from "@/lib/studio/use-cases";

export function metadataForUseCase(slug: string): Metadata {
  const u = USE_CASES[slug];
  const url = `${SITE_URL}/${u.slug}`;
  const og = ogImage(u.h1, u.lede);
  return {
    title: { absolute: u.title },
    description: u.description,
    alternates: { canonical: url },
    robots: USE_CASES_INDEXABLE ? undefined : { index: false, follow: true },
    openGraph: { title: u.title, description: u.description, url, siteName: SITE_NAME, type: "website", images: [og] },
    twitter: { card: "summary_large_image", title: u.title, description: u.description, images: [og.url] },
  };
}

export function UseCasePage({ slug }: { slug: string }) {
  const u = USE_CASES[slug];
  return (
    <ToolPageShell
      wide
      breadcrumb={<Breadcrumb items={[{ name: "Studio", href: "/vocal-remover" }, { name: u.h1 }]} />}
      title={u.h1}
      lede={u.lede}
      meta={u.meta}
      tool={<StudioPanel preset={u.preset} />}
    >
      <ToolSection title="How it works">
        <ol>
          {u.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </ToolSection>

      <ToolSection title="Why it sounds better" bleed>
        <div className="grid gap-3 sm:grid-cols-3">
          {u.why.map((w) => (
            <div key={w.title} className="surface rounded-xl border border-graphite-800 bg-graphite-900 p-4">
              <p className="text-text-primary">{w.title}</p>
              <p className="mt-1 text-sm text-text-muted">{w.body}</p>
            </div>
          ))}
        </div>
      </ToolSection>

      <ToolSection title="Also in Studio" bleed>
        <div className="flex flex-wrap gap-2">
          {u.related.map((r) => (
            <Link
              key={r}
              href={`/${r}`}
              prefetch={false}
              className="rounded-full border border-graphite-700 px-3.5 py-1.5 text-sm text-text-body transition-colors hover:border-amber-500/50 hover:text-text-primary"
            >
              {USE_CASES[r]?.h1 ?? r}
            </Link>
          ))}
        </div>
      </ToolSection>

      <FAQSection faqs={u.faqs} />
    </ToolPageShell>
  );
}