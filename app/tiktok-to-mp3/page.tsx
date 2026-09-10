import type { Metadata } from "next";
import Link from "next/link";
import { TikTokToMp3Form } from "@/components/converter/TikTokToMp3Form";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { Prose } from "@/components/ui/Prose";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { ProofStrip } from "@/components/tools/ProofStrip";
import { CompareTable } from "@/components/tools/CompareTable";
import { BitrateChainDiagram } from "@/components/tools/BitrateChainDiagram";
import { PageByline } from "@/components/tools/PageByline";
import { SITE_URL } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { ogForTool } from "@/lib/og";

/**
 * TITLE — READ BEFORE EDITING.
 *
 * `title` is `{ absolute: PAGE_TITLE }`, not a bare string. Passing a string
 * opts INTO the `title.template` in the root layout, which appends
 * " | AudioForges". A crawl confirmed the rendered title was 57 chars with the
 * brand on it despite a comment asserting otherwise — the comment described
 * intent, the template quietly overrode it. `absolute` is the only form that
 * actually suppresses the template.
 *
 * The reasoning: no "| AudioForges" on a commercial query against established
 * competitors. Fourteen characters of a brand nobody searches for is worse
 * spent than fourteen characters of search concept. Add it back when the brand
 * is worth searching for — GSC currently records zero queries containing
 * "audioforges".
 *
 * DOWNLOADER INTENT: "converter" and "downloader" describe the same action to
 * a user and different intents to a search engine, and half this SERP's query
 * space is phrased as the latter. Bing Keyword Research, three months to
 * 30 Aug 2026, puts numbers on it:
 *
 *   tiktok to mp3            26.7K   head term — keeps position zero
 *   tiktok mp3               12.2K
 *   tiktok mp3 downloader     7.2K
 *   tiktok downloader mp3     5.7K   ~19.7K of demand is phrased as
 *   tiktok audio downloader   4.2K   "downloader", and the title carried
 *   tiktok sound downloader   2.6K   only the verb "Download", not the noun
 *   tiktok mp3 converter      4.7K
 *
 * So "Free Audio Downloader" replaces "Free MP3 Download": same length class,
 * matching a cluster nearly as large as the head term rather than a phrase
 * nobody types. "Converter" stays — it leads the head term and it is what
 * the tool is called.
 */
const PAGE_TITLE = "TikTok to MP3 Converter – Free Audio Downloader";
const PAGE_DESCRIPTION =
  "Free TikTok to MP3 converter and audio downloader. Paste a TikTok link and download the sound as an MP3 in seconds — no app, no account, no watermark.";

/** From the rate-limit table rather than typed into a sentence. The FAQ used
 *  to say "30 conversions per hour" as a literal. */
const RATE_LIMIT = getRateLimitLabel("tiktok-to-mp3") ?? "30 per hour";

const UPDATED = "2026-09-10";

const OG_IMAGE = ogForTool("tiktok-to-mp3", "Free TikTok to MP3 Converter");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  // `keywords` removed — ignored by Google since 2009, treated as a spam
  // signal by Bing, and every term it held is now in the body copy below.
  alternates: { canonical: `${SITE_URL}/tiktok-to-mp3` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/tiktok-to-mp3`,
    siteName: "AudioForges",
    type: "website",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "TikTok to MP3 Converter & Audio Downloader",
  url: `${SITE_URL}/tiktok-to-mp3`,
  dateModified: UPDATED,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Convert TikTok videos to MP3",
    "TikTok audio downloader — sounds and full videos as MP3",
    "Works with vt.tiktok.com and vm.tiktok.com share links",
    "No sign-up required",
    "No watermark",
    "Preview before download",
  ],
};

// No aggregateRating, deliberately: two of the three pages currently ranking
// for this term carry review markup backed by testimonials that read as
// invented. There's no honest version of that for a tool with no review
// system, and it's a manual-action risk.
//
// HowTo schema REMOVED. It was kept here on the grounds that it costs nothing
// and non-Google parsers still read it — but it had already drifted: three
// steps in the markup against four in the visible list. A second copy of the
// steps that silently diverges is exactly the failure the other tool pages
// dropped HowTo to avoid, and Google retired the rich result in 2023.
//
// FAQPage comes from <FAQSection />, BreadcrumbList from <Breadcrumb />.

const FAILURE_CASES = [
  ["Photo / slideshow posts", "No video track, so there is no audio to extract"],
  ["Private or deleted videos", "The link has to be publicly viewable"],
  [
    "Age-restricted posts",
    "TikTok requires a logged-in session, which we deliberately don't use",
  ],
  ["Region-locked posts", "Blocked at TikTok's end; a different network won't change it"],
  ["Videos over 10 minutes", "TikTok's own ceiling, and ours"],
];

const faqs = [
  {
    question: "How do I convert a TikTok video to MP3?",
    answer:
      "Tap Share on the TikTok video and choose Copy link, paste that link into the converter above, then click Convert to MP3. The audio comes back as an MP3 you can play before downloading — usually within a few seconds.",
  },
  {
    question: "What audio quality do I get?",
    answer:
      "A 128kbps MP3 at 44.1kHz. That's double the rate of TikTok's own audio, which we measured at roughly 64kbps AAC, so nothing audible is lost in the conversion. Converters advertising 320kbps are encoding that same 64kbps source into a file two and a half times larger with identical sound.",
    answerNode: (
      <>
        A 128kbps MP3 at 44.1kHz. That&apos;s double the rate of TikTok&apos;s
        own audio, which we measured at roughly 64kbps AAC, so nothing audible
        is lost in the conversion. Converters advertising 320kbps are encoding
        that same 64kbps source into a file two and a half times larger with
        identical sound —{" "}
        <Link
          href="/guides/tiktok-audio-quality-explained"
          className="text-amber-400 hover:underline"
        >
          read TikTok Audio Quality: Why 320 kbps Is a Myth
        </Link>{" "}
        for the measurements.
      </>
    ),
  },
  {
    question: "Why won't my TikTok link convert to MP3?",
    answer:
      "Most often it's a photo or slideshow post rather than a video: those have no audio track to extract. Private, deleted and age-restricted videos can't be fetched either, and some posts are region-locked by TikTok. The converter names which one it hit rather than showing a generic error.",
  },
  {
    question: "Can I download a TikTok MP3 on iPhone or Android?",
    answer:
      "Yes, in any mobile browser with nothing to install. On iPhone, copy the link in the TikTok app, open this page in Safari, and the MP3 saves to Files under Downloads. On Android it lands in your Downloads folder and appears in any music player or file manager.",
  },
  {
    question: "Can I download TikTok sounds as well as full videos?",
    answer:
      "Yes — a TikTok sound and a TikTok video are the same thing from the converter's point of view. Paste the link to any public video using the sound and you get that sound as an MP3. There is no separate sounds page to visit; the audio track is what gets extracted either way.",
  },
  {
    question: "Does it work with short vt.tiktok.com links?",
    answer:
      "Yes. Share links from the app (vt.tiktok.com and vm.tiktok.com), full www.tiktok.com video URLs, /t/ share links and m.tiktok.com mobile links are all supported. Tracking parameters on the end of the URL are ignored.",
  },
  {
    question: "Can I use TikTok audio in my own videos?",
    answer:
      "That depends on the sound and where you're posting. Personal listening is generally fine; reusing someone's original sound in monetised or commercial work usually needs their permission, and commercial music on TikTok is licensed to TikTok rather than to you. Credit the original creator and check the rules of the platform you're publishing to.",
  },
  {
    question: "Do you keep the files I convert?",
    answer:
      "Converted audio is held briefly in a server-side cache so a repeat request for the same video doesn't have to be processed twice, then evicted automatically. Nothing is tied to an account, because there are no accounts.",
  },
];

export default function TikTokToMp3Page() {
  const relatedTools = getRelatedTools("tiktok-to-mp3", 5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "TikTok to MP3" }]} />}
        meta={["No account", "No app", "128kbps, honestly"]}
        title="TikTok to MP3 Converter"
        lede="Paste a TikTok link and download the sound as an MP3. No account, no app, and a bitrate that matches what TikTok actually serves."
        tool={<TikTokToMp3Form />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Output",
              value: "128kbps MP3 at 44.1kHz",
              note: "Double TikTok's own rate, which we measured at about 64kbps AAC. Nothing audible is lost, and no size is wasted.",
            },
            {
              label: "The file",
              value: "One MP3 per link, named after the video",
              note: "No spoken tag, no watermark, no bundled installer. Sounds and full videos are the same extraction.",
            },
            {
              label: "Limits",
              value: `${RATE_LIMIT}, up to 10 minutes`,
              note: "Public videos only. vt.tiktok.com short links work. Photo and slideshow posts have no audio to take.",
            },
          ]}
        />

        <ToolSection id="how-to" title="Three steps, nothing to install" bleed>
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              ["Copy the link", "Share button in the app, then Copy link. Both tiktok.com and vt.tiktok.com short links work."],
              ["Paste it above", "The audio is fetched server-side. Nothing reaches your device until you press Download."],
              ["Download", "One MP3, named after the video. On iPhone it lands in Files; on Android, in Downloads."],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5">
                <p className="font-mono text-[11px] text-amber-400">Step {i + 1}</p>
                <p className="mt-1.5 font-medium text-text-primary">{t}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </ToolSection>

        <ToolSection id="quality" title="Why 128kbps, and why 320 is a myth here" bleed>
          <BitrateChainDiagram
            outputLabel="128 kbps MP3"
            outputWidth={124}
            ceilingNote="nothing past this line was ever sent"
            caption="TikTok serves its audio at roughly 64kbps AAC, measured, not assumed. A 128kbps MP3 gives the encoder twice the source rate, which is enough headroom that nothing audible is lost in the conversion. A 320kbps export of the same 64kbps source is a file two and a half times larger with identical sound. Converters advertising it are counting on you not checking."
          />
          <Prose className="mt-5">
            <p>
              The measurements and the method are in{" "}
              <Link href="/guides/tiktok-audio-quality-explained">TikTok Audio Quality: Why 320 kbps Is a Myth</Link>.
              If you need the file in another format, run the MP3 through the{" "}
              <Link href="/convert">Audio Converter</Link>.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="failures" title="Links that cannot be converted, by anyone" bleed>
          <CompareTable
            columns={["Why it fails"]}
            highlight={-1}
            rows={FAILURE_CASES.map(([type, why]) => ({ label: type, cells: [{ state: "no", text: why }] }))}
            footnote="The converter names which case it hit rather than showing a generic error. Any other failure is usually transient; wait a few seconds and run it again."
          />
        </ToolSection>

        <ToolSection id="next" title="After the MP3" bleed>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Make a ringtone", "Cut it to a notification-length clip.", "/guides/tiktok-sound-to-ringtone"],
              ["Remove the vocals", "Instrumental or acapella from the sound.", "/vocal-remover"],
              ["Find key and BPM", "For sampling or a mashup.", "/key-finder"],
              ["Trim it", "Just the section you need, lossless.", "/trim"],
            ].map(([title, desc, href]) => (
              <Link
                key={href}
                href={href}
                prefetch={false}
                className="group rounded-xl border border-graphite-800 bg-graphite-900 p-4 transition-colors hover:border-amber-500/40"
              >
                <p className="font-medium text-text-primary group-hover:text-amber-400">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">{desc}</p>
              </Link>
            ))}
          </div>
          <Prose className="mt-5">
            <p>
              Whether you can use the sound depends on the sound and where you post it. Personal listening is
              generally fine; reusing someone&apos;s original sound in monetised or commercial work usually needs
              their permission, and commercial music on TikTok is licensed to TikTok rather than to you. Credit the
              creator and check the rules of the platform you are publishing to.
            </p>
          </Prose>
        </ToolSection>

        <FAQSection faqs={faqs} />

        <RelatedToolsGrid tools={relatedTools} />

        <PageByline
          updated={UPDATED}
          legal="This tool is for content you own or have permission to use. You are responsible for having the right to download and use anything you convert. AudioForges does not host, store or distribute copyrighted material."
        />
      </ToolPageShell>
    </>
  );
}