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

const guide = getGuideBySlug("best-free-vocal-remover")!;

const OG_IMAGE = ogForGuide(guide);

export const metadata: Metadata = {
  title: { absolute: "Best Free Vocal Remover 2026: 8 Tools Tested on One Song" },
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
  { id: "af-studio", title: "AF Studio Quality", note: "37 sec · 1 credit", src: `${BENCH}/bench-audioforges-studio.mp3` },
  { id: "lalal", title: "LALAL.AI", note: "15 sec · screen-recorded", src: `${BENCH}/bench-lalal.mp3` },
  { id: "moises", title: "Moises", note: "9 sec + slow upload", src: `${BENCH}/bench-moises.mp3` },
  { id: "af-standard", title: "AF Standard", note: "21 sec · free", src: `${BENCH}/bench-audioforges-standard.mp3` },
  { id: "stemsplit", title: "StemSplit", note: "18 sec", src: `${BENCH}/bench-stemsplit.mp3` },
  { id: "gaudio", title: "Gaudio Studio", note: "57 sec", src: `${BENCH}/bench-gaudio.mp3` },
  { id: "fadr", title: "Fadr", note: "15 sec", src: `${BENCH}/bench-fadr.mp3` },
  { id: "vocalremover", title: "VocalRemover.org", note: "12 sec", src: `${BENCH}/bench-vocalremover-org.mp3` },
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
      name: "What is the best free vocal remover in 2026?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "On the same 41-second clip, the cleanest result that was actually downloadable on a free tier came from AudioForges Standard. LALAL.AI sounded as good as anything but its free plan blocks the download. VocalRemover.org and Fadr were free but had the most vocal bleed.",
      },
    },
    {
      "@type": "Question",
      name: "Which vocal remover has the least vocal bleed?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "LALAL.AI and AudioForges Studio Quality were the only two with no audible bleed on our test. Moises was close behind. AudioForges Standard and StemSplit had a little bleed in the silences, nothing under the full mix.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need an account to remove vocals for free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Not everywhere. VocalRemover.org and AudioForges work with no account. Moises, StemSplit, Fadr and Gaudio required a sign-up before the first result, and LALAL.AI and Media.io required a paid plan to download anything.",
      },
    },
  ],
};

interface Row {
  tool: string;
  time: string;
  account: string;
  download: string;
  verdict: string;
}

const ROWS: Row[] = [
  { tool: "AudioForges Studio", time: "37s", account: "No", download: "Full WAV, 1 free run a month, then 1 credit", verdict: "No bleed, clean silences" },
  { tool: "LALAL.AI", time: "15s", account: "Yes", download: "Preview only on free", verdict: "No bleed, level with Studio" },
  { tool: "Moises", time: "9s + slow upload", account: "Yes", download: "5 uploads a month, 5-min cap", verdict: "Clean, slightly dull" },
  { tool: "AudioForges Standard", time: "21s", account: "No", download: "Full WAV, free", verdict: "A little bleed in the silences" },
  { tool: "StemSplit", time: "18s", account: "Yes", download: "10 free minutes", verdict: "Slight bleed, close to Standard" },
  { tool: "Gaudio Studio", time: "57s", account: "Yes", download: "20-minute trial", verdict: "Bleed and artifacts in silences" },
  { tool: "Fadr", time: "15s", account: "Yes", download: "Free, MP3", verdict: "Heavy bleed in vocal-only bars" },
  { tool: "VocalRemover.org", time: "12s", account: "No", download: "Free, 10 MB cap", verdict: "Vocal audible throughout, noisy" },
  { tool: "Media.io", time: "n/a", account: "Yes", download: "5 credits, not enough to export", verdict: "Could not get a result" },
];

export default function BestFreeVocalRemoverPage() {
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
            Most &quot;best vocal remover&quot; lists describe results. This one lets
            you hear them. We ran the same 41-second section of one song through
            eight tools on their free tiers, kept every instrumental, and put them
            side by side below. Same section, same source file, nothing edited
            afterwards.
          </p>
          <p>
            Two things up front. We run AudioForges, so read our verdicts with
            that in mind and use your own ears. And this is one track, one genre,
            one listener. It tells you how these tools behave on a dense pop mix
            with backing vocals. It does not settle every argument.
          </p>

          <h2 id="listen">Listen to all nine</h2>
          <p>
            Start with the original, then switch lanes while it plays. The
            playhead stays put, so you hear the same bar through each tool. Pay
            attention to the moments where the vocal drops out. That is where the
            weaker tools leave a ghost of the singer or a hiss where silence
            should be.
          </p>
          <div className="not-prose my-6">
            <CompareRig
              lanes={LANES}
              headline="Instrumental, every tool"
              subline="Click a lane to switch while it plays. Drag on a lane to loop a section."
            />
          </div>

          <h2 id="results">Results on the same clip</h2>
          <div className="not-prose my-6 overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-graphite-900 text-xs uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Tool</th>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Account</th>
                  <th className="px-4 py-3 font-medium">Free download</th>
                  <th className="px-4 py-3 font-medium">What we heard</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                {ROWS.map((r) => (
                  <tr key={r.tool} className="align-top">
                    <td className="px-4 py-3 font-medium text-text-primary">{r.tool}</td>
                    <td className="px-4 py-3 text-text-muted">{r.time}</td>
                    <td className="px-4 py-3 text-text-muted">{r.account}</td>
                    <td className="px-4 py-3 text-text-muted">{r.download}</td>
                    <td className="px-4 py-3 text-text-muted">{r.verdict}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Times are processing only, measured on a 41-second MP3. Upload time
            is excluded except where it dominated, which it did on Moises.
          </p>

          <h2 id="tool-by-tool">Tool by tool</h2>

          <h3>LALAL.AI</h3>
          <p>
            The best-sounding result of the paid tools and level with our Studio
            tier. No bleed, clean silences, and to our ears the two are
            interchangeable on this clip. The catch is the free plan: you can
            listen to a preview and that is all. We had to screen-record the
            player to get the clip above, which tells you what &quot;free&quot; means
            there. Plans start at $9.99 a month and minutes reset monthly.
          </p>

          <h3>Moises</h3>
          <p>
            Clean separation with no bleed, a little duller in the top end than
            LALAL or Studio. The experience is the problem: the site is built
            around the mobile app, the upload took minutes, and the free plan is
            five uploads a month behind an account. Good tool, wrong shape for a
            quick karaoke track.
          </p>

          <h3>StemSplit</h3>
          <p>
            Fine on the verse, a little bleed in the quiet moments, close to
            what our free Standard tier does on the same bars. Ten free minutes after
            signing up, then pay-as-you-go from 10 cents a minute. Honest
            pricing, and the closest result to our free tier among the paid
            tools.
          </p>

          <h3>Gaudio Studio</h3>
          <p>
            Slowest of the group at nearly a minute, and the result bled in the
            gaps between vocal lines, with artifacts where the singer stops. Twenty-minute trial, account
            required, then credit packs from $7. Its reputation is better than
            this clip; on other material it may earn it.
          </p>

          <h3>Fadr</h3>
          <p>
            Free with no hard limit, which is generous. The separation is not:
            wherever the vocal sat alone, a good deal of it stayed in the
            instrumental. Fine for a rough practice track, not for anything you
            would play to someone else.
          </p>

          <h3>VocalRemover.org</h3>
          <p>
            The most-used free vocal remover on the internet, no account, fast.
            Also the weakest result here: the vocal is still audible in the
            instrumental for most of the clip, with background noise and a
            screechy artifact underneath. It is the tool people find first and
            leave once they hear a better one.
          </p>

          <h3>Media.io</h3>
          <p>
            Signed up, got five free credits, and could not export a single
            result with them. No clip, because there was nothing to download.
          </p>

          <h3>AudioForges</h3>
          <p>
            Standard is free, no account, full WAV download, and on this clip it
            bled less than every other free tier. Where the singer pauses you can
            still catch a faint trace of the vocal, and that is the only place it
            shows. Studio runs the Forge 2 engine
            and removed that trace completely, with silence where the
            singer stops. Every visitor gets one Studio run a month free, then it
            is one credit a song, from $4.99 for 15, and the credits do not expire.
          </p>

          <h2 id="pick">Which one to use</h2>
          <dl>
            <dt>You want a clean result, free, right now</dt>
            <dd>
              AudioForges Standard. No account, real download, least bleed of the
              free tiers.
            </dd>
            <dt>You want the cleanest possible instrumental</dt>
            <dd>
              LALAL.AI and AudioForges Studio Quality sounded the same to us.
              One costs $9.99 a month, the other 25 to 33 cents a song with the
              first one free.
            </dd>
            <dt>You separate stems every day for work</dt>
            <dd>
              A LALAL.AI or Moises subscription will be cheaper than per-song
              credits past about thirty songs a month.
            </dd>
          </dl>

          <h2 id="method">How we tested</h2>
          <p>
            One song we hold the rights to, a 41-second section chosen because
            the vocal runs through nearly all of it over a full arrangement.
            Each tool received the same MP3 on its free tier in September 2026.
            We kept the instrumental output as delivered, converted to MP3 at the
            same bitrate for the player, and noted processing time from submit to
            result. Where a tool would not let us download, we recorded the
            browser and say so. All listening was done on Audio-Technica
            ATH-M50x headphones. Full comparison of our own two tiers with
            timings is on the{" "}
            <Link href="/vocal-remover-comparison">vocal remover comparison</Link>{" "}
            page.
          </p>
        </Prose>

        <div className="mt-10 flex flex-wrap gap-3 border-t border-graphite-800 pt-8">
          <Link href="/vocal-remover" className={buttonStyles({ size: "lg" })}>
            Try the Vocal Remover
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/guides/lalal-ai-alternative"
            className={buttonStyles({ size: "lg", variant: "outline" })}
          >
            LALAL.AI alternative
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}