import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Prose } from "@/components/ui/Prose";
import { ogForGuide } from "@/lib/og";

const guide = getGuideBySlug("lalal-ai-alternative")!;

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

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: guide.title,
  description: guide.description,
  datePublished: guide.publishedDate,
  dateModified: guide.updatedDate,
  author: { "@type": "Organization", name: "AudioForges" },
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
      name: "Is there a LALAL.AI alternative that does not need a subscription?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. AudioForges runs vocal removal free at Standard quality with no account, and Studio Quality costs one credit per song. Credits are bought once, start at $3 for 10, and never expire.",
      },
    },
    {
      "@type": "Question",
      name: "Do LALAL.AI minutes expire?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "On LALAL.AI's subscription plans the minutes reset each billing period, so unused minutes do not roll over. AudioForges credits have no expiry date.",
      },
    },
    {
      "@type": "Question",
      name: "Is the separation quality comparable?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "AudioForges Studio Quality runs a RoFormer-class model on a GPU. There is a published comparison page with the same track through each tier so you can listen before spending anything, and every visitor gets one free Studio run a month on their own song.",
      },
    },
  ],
};

export default function LalalAlternativeGuidePage() {
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
            If you only remove vocals from a song now and then, a monthly plan is
            the wrong shape for the job. This page is for people who liked what
            LALAL.AI does but not how it charges for it. The short version:
            AudioForges does the same two-stem split, free at Standard quality,
            and charges per song for Studio Quality instead of per month.
          </p>

          <h2 id="the-problem">What people actually complain about</h2>
          <p>
            LALAL.AI&apos;s separation is good. The complaints are almost all
            about the billing model, and they repeat in every review thread:
          </p>
          <dl>
            <dt>Minutes reset every month</dt>
            <dd>
              Plans are sold as minutes of audio per billing period. Whatever
              you do not use is gone when the period rolls over, so a quiet
              month is money spent on nothing.
            </dd>

            <dt>The free tier is a preview</dt>
            <dd>
              Ten minutes total. That is two or three songs, and the better
              processing modes cost two to three times the minutes of a plain
              run, so a single four-minute track can eat most of the allowance.
            </dd>

            <dt>No pay-as-you-go</dt>
            <dd>
              As of September 2026 there is no way to buy one song&apos;s worth.
              The entry plan is around $10 a month, and you need to sign in to
              buy anything.
            </dd>
          </dl>
          <p>
            None of that is a quality issue. It is a pricing model built for
            studios that separate stems every day, applied to everyone.
          </p>

          <h2 id="what-changes">What AudioForges does differently</h2>
          <dl>
            <dt>Standard quality is free, no account</dt>
            <dd>
              Paste a YouTube link or drop a file, get vocals and instrumental
              back, mix them in the browser, download the WAVs. No sign-up, no
              email, no trial clock.
            </dd>

            <dt>Studio Quality is one credit per song</dt>
            <dd>
              Credits start at 10 for $3, which works out to about 30 cents a
              song. Buy once, use whenever. They never expire, and a failed run
              is refunded automatically.
            </dd>

            <dt>You hear it on your own song before paying</dt>
            <dd>
              Every visitor gets one free Studio Quality run a month. Run your
              own track through it and decide with your ears, not a demo clip.
            </dd>

            <dt>Payment without an account</dt>
            <dd>
              Pay by card or PayPal inside the page. Credits land in the
              browser that bought them, with a sign-in link by email if you want
              them on another device.
            </dd>
          </dl>

          <h2 id="quality">Is the quality actually comparable?</h2>
          <p>
            Standard runs Demucs, the same open model most free tools use.
            Studio Quality runs a RoFormer-class model on a GPU, the same family
            behind the current top entries on public separation benchmarks. The
            honest way to judge it is to listen: the{" "}
            <Link href="/vocal-remover-comparison">
              vocal remover comparison
            </Link>{" "}
            puts one track through both tiers with the exact processing times,
            and your free monthly Studio run does the same on any song you
            choose.
          </p>
          <p>
            Where LALAL.AI still wins: it offers more stem types than the
            two-stem and four-stem splits here, and it has desktop apps. If you
            need a dedicated piano or wind stem, or batch processing of a whole
            library every week, a subscription there is the better fit.
          </p>

          <h2 id="cost">What it costs in practice</h2>
          <p>
            Ten songs a month at Studio Quality on AudioForges is $3, and the
            credits carry over if you skip a month. The same ten songs on a
            monthly plan cost the plan price whether you use it or not. If you
            separate more than about thirty songs every single month, the
            subscription math starts to catch up. Below that, per-song pricing
            is cheaper, and most people are well below that.
          </p>

          <h2 id="how-to-switch">How to try it in two minutes</h2>
          <ol>
            <li>Open the vocal remover and drop a file, or paste a YouTube link.</li>
            <li>Run it free at Standard and check the result in the mixer.</li>
            <li>
              Press Run at Studio Quality. The first one each month is free, so
              nothing to buy until you have heard it.
            </li>
          </ol>
        </Prose>

        <div className="mt-10 flex flex-wrap gap-3 border-t border-graphite-800 pt-8">
          <Link href="/vocal-remover" className={buttonStyles({ size: "lg" })}>
            Vocal Remover
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/youtube-vocal-remover"
            className={buttonStyles({ size: "lg", variant: "outline" })}
          >
            YouTube Vocal Remover
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/pricing" className={buttonStyles({ size: "lg", variant: "outline" })}>
            Pricing
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}