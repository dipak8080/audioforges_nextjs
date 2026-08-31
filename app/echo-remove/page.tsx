import type { Metadata } from "next";
import Link from "next/link";
import { EchoRemoveForm } from "@/components/converter/EchoRemoveForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { ogForTool } from "@/lib/og";
import {
  getLimits,
  durationCapFor,
  durationLabel,
  retentionSentences,
} from "@/lib/api/limits";

const PAGE_TITLE = "Free Echo Remover";
const SOCIAL_TITLE = "Free Echo Remover — Reduce Echo & Slap-Back in Recordings";
const PAGE_DESCRIPTION =
  "Reduce or remove echo from audio recordings online free. Improve voice recordings, podcasts, and interviews by cutting room echo and slap-back. No sign-up.";

const OG_IMAGE = ogForTool("echo-remove", "Free Echo Remover");

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/echo-remove` },
  openGraph: {
    title: SOCIAL_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/echo-remove`,
    siteName: SITE_NAME,
    type: "website",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SOCIAL_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Echo Remover",
  url: `${SITE_URL}/echo-remove`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Reduces mild room echo",
    "Reduces repeated/slap echo",
    "No sign-up required",
    "No watermark",
  ],
};

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.

// Every figure comes from /limits. The old hand-written sentence here said
// "up to 80MB and 20 minutes" — the size was right, the length wrong by forty
// minutes. It was one true sentence from the transcription guide copied into
// six pages where it wasn't true.
export default async function EchoRemovePage() {
  const relatedTools = getRelatedTools("echo-remove", 5);

  const limits = await getLimits();
  const durationCap = durationCapFor(limits, "echo-remove");
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const faqs = [
    {
      question: "Does this fully remove echo?",
      answer:
        "It reduces mild room echo and repeated slap-back echo well, but it doesn't perform full acoustic dereverberation — heavy reverb from a large or empty room won't be fully eliminated.",
    },
    {
      question: "What's the difference between echo, reverb, and slap-back?",
      answer:
        "Slap-back is a single, distinct repeat off a hard surface — common in small tiled or hard-walled rooms. Reverb is the accumulated wash of countless overlapping reflections in a larger space, without a single clear repeat. This tool handles slap-back and mild room echo well; it isn't designed for heavy reverb.",
    },
    {
      question: "Can I remove echo from Zoom or phone recordings?",
      answer:
        "Yes — phone recordings, Zoom calls, and voice memos with mild room echo are exactly the kind of source material this tool handles well.",
    },
    {
      question: "What kind of echo does this work best on?",
      answer:
        "Mild room echo on speech recordings and repeated/slap echo. It's not designed for cleaning heavy reverb from concert halls or large empty spaces.",
    },
    {
      question: "Is this really free?",
      answer: "Yes — completely free, no sign-up, no watermark on the output.",
    },
    {
      question: "What formats are supported, and is there a size limit?",
      answer:
        durationCap === null
          ? `${formatList}, up to ${limits.maxUploadMb}MB per upload.`
          : `${formatList}, up to ${limits.maxUploadMb}MB and ${durationLabel(durationCap)} long.`,
    },
    {
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Echo Remover" }]} />
        }
        title="Free Echo Remover"
        lede="Reduce mild room echo and slap-back in a recording, free, no sign-up, no watermark."
        tool={<EchoRemoveForm />}
      >
        {/* Expectation-setting, so it sits directly under the tool rather than
            in a section further down. Mono label rather than a heading: this
            says the same thing as the echo-vs-reverb section and one FAQ
            answer, and a third h2 repeating it would clutter the outline. */}
        <section className="rounded-xl border border-graphite-800 bg-graphite-900 p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-400">
            What this does, and doesn&apos;t, fix
          </p>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            This tool reduces mild room echo and repeated slap-back echo well. It
            does not perform full acoustic dereverberation — heavy reverb from a
            large or empty room won&apos;t be fully eliminated. Think
            &quot;reduce,&quot; not &quot;remove completely.&quot;
          </p>
        </section>

        <FeatureStrip
          features={[
            { title: "One click", desc: "No settings to tune — just upload." },
            { title: "Fast", desc: "Most files process in a few seconds." },
            {
              title: "No sign-up",
              desc:
                durationCap === null
                  ? `No account, no email, no watermark. Up to ${limits.maxUploadMb}MB per file.`
                  : `No account, no email, no watermark. Up to ${limits.maxUploadMb}MB and ${durationLabel(durationCap)}.`,
            },
          ]}
        />

        <ToolSection id="how-to" title="How to reduce echo in a recording">
          <ol>
            <li>Upload an {formatList} file.</li>
            <li>The tool gates out the quiet trailing reflections that create the echo.</li>
            <li>Download the cleaned-up result.</li>
          </ol>
        </ToolSection>

        <ToolSection id="why-echo" title="Why recordings get echo">
          <p>
            Echo happens when sound reflects off hard surfaces — walls, ceilings,
            glass, tile — before reaching the microphone. Instead of picking up
            only the direct sound, the mic also captures those delayed
            reflections, which is what makes speech sound distant or hollow.
            Rooms with little furniture, carpet, or soft surfaces to absorb sound
            tend to produce the strongest echo, since there&apos;s nothing to
            dampen the reflections bouncing around.
          </p>
          <p>
            Recording closer to the microphone, adding soft furnishings, or using
            acoustic panels all reduce echo before it&apos;s ever captured. This
            tool works on the other end of that problem — reducing echo
            that&apos;s already baked into a recording after the fact.
          </p>
        </ToolSection>

        <ToolSection id="echo-vs-reverb" title="Echo vs. reverb vs. slap-back">
          <p>
            These terms get used interchangeably, but they&apos;re different
            problems. <strong>Slap-back echo</strong> is a single, distinct repeat
            off a hard surface — a tiled bathroom, a hallway, an empty room with
            bare walls. <strong>Reverb</strong> is the accumulated wash of
            countless overlapping reflections in a larger space, without one clean
            repeat to point to — a concert hall or an empty gymnasium produces
            reverb, not slap-back. This tool works by gating out quiet trailing
            reflections, which handles slap-back and mild room echo well. Heavy
            reverb doesn&apos;t offer that same clean separation between direct
            sound and reflection, which is why it&apos;s outside what this tool
            can fully fix.
          </p>
          <p>
            Want the full explanation of why one gates out cleanly and the other
            doesn&apos;t?{" "}
            <Link href="/guides/fixing-echo-in-home-recordings">
              Read How to Fix Echo in Home Recordings
            </Link>
            .
          </p>
        </ToolSection>

        <ToolSection id="when-to-use" title="When to use this">
          <p>
            Good fits: a phone recording made in a tiled bathroom or hallway, a
            voice memo with a faint repeat, a Zoom call recorded in an untreated
            room, or an interview recorded in a slightly echoey space. This works
            on audio from any source — phone, laptop, camera, Zoom, Discord,
            Teams, OBS, whatever recorded it — as long as it&apos;s a supported
            file format with mild room echo rather than heavy reverb.
          </p>
          <p>
            For speech recordings that also have background noise or inconsistent
            loudness alongside the echo, try the{" "}
            <Link href="/voice-clean">Voice Cleaner</Link> first — it handles
            denoising and normalization in the same pass. If you want direct
            control over noise reduction strength instead, the{" "}
            <Link href="/noise-remove">Noise Remover</Link> is the more adjustable
            option.
          </p>
        </ToolSection>

        <RelatedToolsGrid tools={relatedTools} />

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}