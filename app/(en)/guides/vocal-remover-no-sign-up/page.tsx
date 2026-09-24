import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";
import { CompareRig, type CompareLane } from "@/components/credits/CompareRig";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Prose } from "@/components/ui/Prose";
import { ogForGuide } from "@/lib/og";

const guide = getGuideBySlug("vocal-remover-no-sign-up")!;

const OG_IMAGE = ogForGuide(guide);

export const metadata: Metadata = {
  title: guide.title,
  description: guide.description,
  alternates: { canonical: `${SITE_URL}/guides/${guide.slug}` },
  openGraph: {
    title: guide.title,
    description: guide.description,
    url: `${SITE_URL}/guides/${guide.slug}`,
    siteName: "AudioForges",
    type: "article",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: guide.title,
    description: guide.description,
    images: [OG_IMAGE.url],
  },
};

const BENCH = "/audio/bench";

const LANES: CompareLane[] = [
  { id: "original", title: "Original", note: "The mix, untouched", src: `${BENCH}/bench-original.mp3` },
  { id: "af-standard", title: "AF Standard", note: "Free, no account", src: `${BENCH}/bench-audioforges-standard.mp3` },
  { id: "af-studio", title: "AF Studio Quality", note: "First run free", src: `${BENCH}/bench-audioforges-studio.mp3` },
];

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: guide.title,
  description: guide.description,
  datePublished: guide.publishedDate,
  dateModified: guide.updatedDate,
  author: { "@type": "Person", name: "Dipak Sah" },
  url: `${SITE_URL}/guides/${guide.slug}`,
  mainEntityOfPage: `${SITE_URL}/guides/${guide.slug}`,
  image: `${SITE_URL}${OG_IMAGE.url}`,
  publisher: { "@type": "Organization", name: "AudioForges" },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is there a vocal remover that works without signing up?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. AudioForges and VocalRemover.org both separate vocals with no account and let you download the result. Of the eight tools we tested in September 2026, the other six asked for a sign-up, a verified email, or a paid plan before the first full download.",
      },
    },
    {
      "@type": "Question",
      name: "Do free vocal removers put a watermark on the audio?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Audible watermarks are rare in this category. None of the eight tools we tested stamped one on the output. The real catches are different: preview-only players, monthly upload caps, trial minutes behind an account, and export credits that run out before your first download.",
      },
    },
    {
      "@type": "Question",
      name: "What is the catch with a no sign up vocal remover?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Usually quality or caps. VocalRemover.org is free with no account but has a 10 MB cap and left the vocal audible in our test. AudioForges Standard is free with no account and a full WAV download; the paid Studio tier exists for cleaner separation, and you only make an account if you buy credits.",
      },
    },
  ],
};

interface Row {
  tool: string;
  account: string;
  free: string;
  gate: string;
}

const ROWS: Row[] = [
  { tool: "AudioForges", account: "No", free: "Full WAV download, Standard quality", gate: "Account only if you buy credits" },
  { tool: "VocalRemover.org", account: "No", free: "Full download, 2 stems", gate: "10 MB cap, weakest result in our test" },
  { tool: "StemSplit", account: "Yes, verified email", free: "10 trial minutes", gate: "Sign-up before the first result" },
  { tool: "Fadr", account: "Yes", free: "MP3 stems", gate: "Sign-up before the first result" },
  { tool: "Gaudio Studio", account: "Yes", free: "20 trial minutes", gate: "Sign-up, and the slowest processing we timed" },
  { tool: "Moises", account: "Yes", free: "5 uploads a month, 5-minute files", gate: "Built around the mobile app" },
  { tool: "LALAL.AI", account: "Yes", free: "Preview player only", gate: "Paid plan to download anything" },
  { tool: "Media.io", account: "Yes", free: "5 credits", gate: "Not enough credits to export one file" },
];

export default function VocalRemoverNoSignUpPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <Breadcrumb
          items={[{ name: "Guides", href: "/guides" }, { name: guide.title }]}
          className="mb-8"
        />

        <header>
          <h1 className="measure-wide text-4xl font-bold leading-[1.06] tracking-[-0.02em] text-text-primary sm:text-5xl">
            {guide.title}
          </h1>
          <div className="mt-5">
            <GuideByline publishedDate={guide.publishedDate} updatedDate={guide.updatedDate} />
          </div>
        </header>

        <Prose className="mt-10">
          <p>
            You can remove the vocals from a song right now with no account, no
            email, and no watermark on the result. Upload the file to the{" "}
            <Link href="/vocal-remover">AudioForges vocal remover</Link>, wait
            about twenty seconds, download the instrumental
            as a WAV. Nothing to sign, nothing to verify, nothing stamped on
            your audio.
          </p>
          <p>
            We run AudioForges, so that opening line is also an ad. The rest of
            this page is the part you should hold us to: what every tool in this
            category actually asks for before you get a file, measured by
            signing up for all of them in September 2026 and running the same
            41-second clip through each.
          </p>

          <h2 id="what-they-ask">What each tool asks for before you get a file</h2>
          <div className="not-prose my-6 overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-graphite-900 text-xs uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Tool</th>
                  <th className="px-4 py-3 font-medium">Account required</th>
                  <th className="px-4 py-3 font-medium">What you get free</th>
                  <th className="px-4 py-3 font-medium">The gate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                {ROWS.map((r) => (
                  <tr key={r.tool} className="align-top">
                    <td className="px-4 py-3 font-medium text-text-primary">{r.tool}</td>
                    <td className="px-4 py-3 text-text-muted">{r.account}</td>
                    <td className="px-4 py-3 text-text-muted">{r.free}</td>
                    <td className="px-4 py-3 text-text-muted">{r.gate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Two of eight work without an account. The full quality comparison
            between all of these, with audio you can hear, is in our{" "}
            <Link href="/guides/best-free-vocal-remover">
              best free vocal remover test
            </Link>
            .
          </p>

          <h2 id="watermarks">Do free vocal removers add watermarks?</h2>
          <p>
            Mostly no, and it is worth being straight about this because the
            fear comes from video tools, where free exports really do get
            stamped. Audio tools gate you differently. None of the eight
            services we tested put an audible watermark on the output. What
            they do instead: LALAL.AI gives you a preview player and no
            download on the free plan. Media.io gave us five credits, which was
            not enough to export a single file. Moises caps you at five uploads
            a month. StemSplit and Gaudio hold their trial minutes behind a
            sign-up. VocalRemover.org is genuinely free and open, and delivered
            the weakest separation of the group.
          </p>
          <p>
            So the questions that matter are not about watermarks. They are:
            can you download the full file, in what quality, and what do they
            want from you first. That is what the table above answers.
          </p>

          <h2 id="how-to">Remove vocals with no sign up, step by step</h2>
          <ol>
            <li>
              Open the <Link href="/vocal-remover">vocal remover</Link>. Drop in
              an MP3, WAV, FLAC or M4A.
            </li>
            <li>
              Wait for the separation. On our 41-second test clip, Standard
              finished in 21 seconds. Longer songs take proportionally longer.
            </li>
            <li>
              Download the instrumental, the vocals, or both as WAV files, or
              adjust the mix first in the built-in mixer. No account, no email,
              no watermark, at any point.
            </li>
          </ol>

          <h2 id="hear-it">Hear the free tier before you use it</h2>
          <p>
            The honest limitation of our free Standard tier: in the moments
            where the singer pauses, a faint trace of the vocal can remain. You
            can hear exactly that below, next to the original and next to the
            Studio Quality tier that removes it. Switch lanes while it plays.
          </p>
          <div className="not-prose my-6">
            <CompareRig
              lanes={LANES}
              headline="Original, Standard, Studio"
              subline="Click a lane to switch while it plays. Drag on a lane to loop a section."
            />
          </div>
          <p>
            Every visitor gets one Studio Quality run a month free. After that
            it is one credit a song, from $3 for ten credits, and credits never
            expire.
          </p>

          <h2 id="why-no-account">Why we do not ask for an account</h2>
          <p>
            An account solves one problem: keeping purchased credits attached
            to you. So that is the only time we ask for one. For everything
            else, an email address is a price, and tools that charge it are not
            free, they are paid in a different currency. Your uploads are
            processed and then deleted from our servers automatically. We would
            rather you come back because the result was clean than because we
            have your inbox.
          </p>

          <h2 id="method">How we tested</h2>
          <p>
            One song we hold the rights to, the same 41-second section through
            every tool on its free tier in September 2026, accounts created
            wherever one was demanded. Processing times measured from submit to
            result. The full results, audio included, are in the{" "}
            <Link href="/guides/best-free-vocal-remover">
              best free vocal remover test
            </Link>
            , and the detailed comparison of our own two tiers is on the{" "}
            <Link href="/vocal-remover-comparison">vocal remover comparison</Link>{" "}
            page.
          </p>
        </Prose>

        <div className="mt-10 flex flex-wrap gap-3 border-t border-graphite-800 pt-8">
          <Link href="/vocal-remover" className={buttonStyles({ size: "lg" })}>
            Remove vocals, no sign up
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/guides/best-free-vocal-remover"
            className={buttonStyles({ size: "lg", variant: "outline" })}
          >
            The full 8-tool test
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}