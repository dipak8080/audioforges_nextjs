import Link from "next/link";
import { VocalRemoverForm } from "@/components/converter/VocalRemoverForm";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { StemCompare } from "@/components/credits/StemCompare";
import { Prose } from "@/components/ui/Prose";
import { ProofStrip } from "@/components/tools/ProofStrip";
import { ForgeMixerCard } from "@/components/tools/ForgeMixerCard";
import { StemUseGrid } from "@/components/tools/StemUseGrid";
import { CompareTable } from "@/components/tools/CompareTable";
import { PageByline } from "@/components/tools/PageByline";
import { SITE_URL } from "@/lib/constants";
import { getFeatureFlags } from "@/lib/api/railway";
import {
  getLimits,
  windowFor,
  rateLimitLabel,
  sharedAllowanceFor,
  sharedAllowanceLabel,
} from "@/lib/api/limits";
import type { VocalRemoverDict } from "@/lib/i18n/vocal-remover";

const DEMO_STANDARD = "/audio/demo-vocals-standard.mp3";
const DEMO_STUDIO = "/audio/demo-vocals-studio.mp3";

export async function LocalizedVocalRemoverPage({ dict }: { dict: VocalRemoverDict }) {
  const { separationHqEnabled } = await getFeatureFlags();
  const limits = await getLimits();

  const standardAllowance = sharedAllowanceFor(limits, "separate");
  const standardLimitLabel = standardAllowance
    ? sharedAllowanceLabel(standardAllowance)
    : rateLimitLabel(limits.rateLimits.separate, windowFor(limits, "separate"));
  const hqLimitLabel = rateLimitLabel(
    limits.rateLimits.separate_hq,
    windowFor(limits, "separate_hq")
  );
  const maxUploadLabel = `${limits.maxUploadMb}MB`;

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ");

  const faqs: FAQItem[] = [
    ...dict.faqs.slice(0, 2),
    {
      question: dict.formatsFaq.question,
      answer: dict.formatsFaq.answer.replace("{formats}", formatList).replace("{size}", maxUploadLabel),
    },
    ...dict.faqs.slice(2),
  ];

  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: dict.appName,
    alternateName: dict.appAlternateNames,
    url: `${SITE_URL}${dict.path}`,
    inLanguage: dict.locale,
    dateModified: dict.updated,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        wide
        breadcrumb={
          <Breadcrumb items={[{ name: dict.breadcrumbTools, href: "/tools" }, { name: dict.breadcrumbSelf }]} />
        }
        title={dict.heroTitle}
        lede={dict.heroLede}
        meta={dict.heroMeta}
        tool={
          <VocalRemoverForm
            hqAvailable={separationHqEnabled}
            standardLimit={standardAllowance}
            hqLimitText={hqLimitLabel}
            demoStandardSrc={DEMO_STANDARD}
            demoStudioSrc={DEMO_STUDIO}
          />
        }
      >
        <ProofStrip proofs={dict.proofs} />

        {separationHqEnabled && (
          <ToolSection id="hear-the-difference" title={dict.hear.title}>
            <p>{dict.hear.intro}</p>
            <StemCompare
              standardSrc={DEMO_STANDARD}
              studioSrc={DEMO_STUDIO}
              stemLabel={dict.hear.stemLabel}
              trackLabel={dict.hear.trackLabel}
              cues={dict.hear.cues}
            />
            <p className="text-xs text-text-subtle">{dict.hear.credit}</p>
          </ToolSection>
        )}

        <ToolSection id="forge-mixer" title={dict.mixer.title} bleed>
          <Prose className="mb-5">
            <p>{dict.mixer.intro}</p>
          </Prose>
          <ForgeMixerCard points={dict.mixer.points} />
        </ToolSection>

        <ToolSection id="what-you-get" title={dict.stems.title} bleed>
          <StemUseGrid outputs={dict.stems.outputs} jobs={dict.stems.jobs} />
        </ToolSection>

        {separationHqEnabled && (
          <ToolSection id="standard-vs-studio" title={dict.tiers.title} bleed>
            <CompareTable
              columns={dict.tiers.columns}
              highlight={1}
              rows={[
                {
                  label: dict.tiers.labels.model,
                  cells: [{ text: "htdemucs", mono: true }, { text: "MelBand RoFormer", mono: true }],
                },
                {
                  label: dict.tiers.labels.bleed,
                  cells: [
                    { state: "partial", text: dict.tiers.bleedCells[0] },
                    { state: "yes", text: dict.tiers.bleedCells[1] },
                  ],
                },
                {
                  label: dict.tiers.labels.artifacts,
                  cells: [
                    { state: "partial", text: dict.tiers.artifactCells[0] },
                    { state: "yes", text: dict.tiers.artifactCells[1] },
                  ],
                },
                {
                  label: dict.tiers.labels.time,
                  cells: [{ text: dict.tiers.timeCells[0], mono: true }, { text: dict.tiers.timeCells[1], mono: true }],
                },
                {
                  label: dict.tiers.labels.limit,
                  cells: [
                    {
                      text: standardLimitLabel,
                      mono: true,
                      sub: standardAllowance ? dict.tiers.limitSubStandard : undefined,
                    },
                    { text: hqLimitLabel, mono: true, sub: dict.tiers.limitSubHq },
                  ],
                },
                {
                  label: dict.tiers.labels.cost,
                  cells: [
                    { text: dict.tiers.costCells[0] },
                    { text: dict.tiers.costCells[1], sub: dict.tiers.costSubHq },
                  ],
                },
              ]}
            />
          </ToolSection>
        )}

        <ToolSection id="free-alternative" title={dict.compare.title} bleed>
          <Prose className="mb-5">
            <p>{dict.compare.intro}</p>
          </Prose>
          <CompareTable
            columns={dict.compare.columns}
            highlight={0}
            rows={dict.compare.rows}
            footnote={dict.compare.footnote}
          />
          <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-5">
            <p className="font-medium text-text-primary">{dict.compare.ctaTitle}</p>
            <p className="mt-1.5 text-sm text-text-muted">{dict.compare.ctaBody}</p>
          </div>
        </ToolSection>

        <FAQSection faqs={faqs} />

        <div className="text-sm text-text-muted">
          <Link href="/vocal-remover" className="text-amber-400 hover:underline">
            English version
          </Link>
        </div>

        <PageByline updated={dict.updated} note={dict.byline.note} legal={dict.byline.legal} />
      </ToolPageShell>
    </>
  );
}