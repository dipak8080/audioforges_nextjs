import type { Metadata } from "next";
import Link from "next/link";
import { TikTokToMp3Form } from "@/components/converter/TikTokToMp3Form";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { Prose } from "@/components/ui/Prose";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
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

const AUDIENCES = [
  ["Video editors", "Drop a trending sound into a Premiere, CapCut, or Resolve timeline"],
  ["Producers", "Sample a sound they hold or have been granted the rights to use"],
  ["Dancers and choreographers", "Keep a track for offline practice without the app open"],
  ["Anyone making a ringtone", "Cut a short clip down to a notification or ringtone"],
  ["Language learners", "Save native-speaker audio for repeat listening"],
];

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
    question: "Is this TikTok to MP3 converter free?",
    answer: `Yes, with no account and no payment. There's a limit of ${RATE_LIMIT.toLowerCase()} from one connection, which exists to keep the service running for everyone rather than to push you toward a paid tier — there isn't one.`,
  },
  {
    question: "Is this a TikTok audio downloader or a converter?",
    answer:
      "Both, in the sense that matters: it fetches the audio track off a public TikTok video and hands it back as an MP3 file. Tools calling themselves TikTok audio downloaders and tools calling themselves TikTok to MP3 converters are doing the same job — pull the sound off the platform, give you a file. There is no separate download step to find elsewhere.",
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
    question: "Do I need a TikTok account or the app?",
    answer:
      "Neither. The converter works from a public TikTok URL and never logs into TikTok on your behalf, so it never asks for credentials. The trade-off is that anything needing a login — age-restricted posts, private accounts — can't be converted.",
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
      />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "TikTok to MP3" }]} />
        }
        title="Free TikTok to MP3 Converter"
        lede="Paste a TikTok link and download the audio in seconds — no account or app required."
        tool={<TikTokToMp3Form />}
      >
        <FeatureStrip
          features={[
            {
              title: "Fast",
              desc: "A fresh conversion takes 2–8 seconds. Cached sounds return almost instantly.",
            },
            {
              title: "Clean file",
              desc: "No watermark, no audio tag, no sponsor message spliced onto the end.",
            },
            { title: "No sign-up", desc: "No account, no email, no app, no TikTok login." },
          ]}
        />

        {/* "Download TikTok MP3" is a distinct phrase in this SERP from "tiktok
            to mp3", and the one the incumbents lead with. It gets real
            sentences rather than a bare keyword heading — a heading with
            nothing under it is the filler pattern this page exists to beat. */}
        <ToolSection id="download" title="Download TikTok MP3">
          <p>
            Download TikTok audio as an MP3 straight from a video link — paste
            the URL above and the sound comes back as a file that plays on a
            phone, a laptop, or anything else that reads MP3. Nothing saves to
            your device until you choose to download, so you can listen first and
            check it&apos;s the right sound.
          </p>
          <p>
            A fresh conversion takes two to eight seconds. A sound someone has
            already pulled comes back from cache in a fraction of that, which is
            why a trending TikTok is usually instant while an obscure one takes a
            moment longer.
          </p>
        </ToolSection>

        {/* Added because the page spoke only "converter" language while half
            the query space for this SERP is phrased as "downloader". Written as
            an explanation of what you actually receive rather than a keyword
            shelf. */}
        <ToolSection id="downloader" title="TikTok audio downloader">
          <p>
            Used as a TikTok audio downloader, this does what a dedicated TikTok
            MP3 downloader does and stops there: it pulls the sound off a public
            video and gives you the file. There is no app to install, no
            extension, no second site to bounce through, and no step where you
            download the video first and strip the audio out yourself.
          </p>

          <h3>What you actually get</h3>
          <p>
            One MP3 file per link, at 128kbps and 44.1kHz, named after the video.
            No watermark, no spoken tag over the intro, no sponsor message welded
            onto the end — three things that are routine on free TikTok
            downloaders and that make the file useless for anything but
            listening. The audio is the audio, unmodified.
          </p>

          <h3>Downloading TikTok sounds</h3>
          <p>
            TikTok sounds work the same way as videos here, because they are the
            same thing underneath: paste a link to any public video using the
            sound and that sound comes back as an MP3. If you found a sound on
            its own TikTok page rather than on a video, open any post using it
            and copy that link instead — the sound page itself has no audio
            stream to fetch.
          </p>

          <h3>One at a time, and only public links</h3>
          <p>
            There is no batch mode and no queue. One link, one MP3, then paste
            the next. That&apos;s a deliberate limit rather than a missing
            feature — bulk TikTok downloaders are the ones that get blocked
            fastest, and a converter that works today is worth more than one that
            scrapes a hundred videos until it stops working entirely.
          </p>
        </ToolSection>

        <ToolSection id="how-to" title="How to convert TikTok to MP3">
          <p>
            Converting a TikTok to MP3 takes three steps and no software install.
            The converter pulls the audio track from the video URL you paste —
            you never need to download the video itself first, and the file only
            reaches your device when you press Download.
          </p>
          <ol>
            <li>
              Tap Share on the TikTok video and choose Copy link. On desktop, copy
              the URL from the address bar.
            </li>
            <li>Paste it into the converter above.</li>
            <li>Click Convert to MP3 and listen back to check the sound.</li>
            <li>Download the MP3 to your phone or computer.</li>
          </ol>

          <h3>On iPhone</h3>
          <p>
            Copy the link inside the TikTok app, open this page in Safari, and
            paste. The MP3 saves into the Files app under Downloads, where the
            Music app, VLC and GarageBand can all reach it. Nothing to install.
          </p>

          <h3>On Android</h3>
          <p>
            Same three steps in Chrome or any other browser. The file lands in
            your Downloads folder and shows up automatically in any music player
            or file manager that scans local storage.
          </p>
        </ToolSection>

        <ToolSection id="quality" title="TikTok MP3 audio quality">
          <p>
            You get a 128kbps MP3 at 44.1kHz. We don&apos;t advertise 320kbps,
            and it matters that we don&apos;t: the TikTok audio streams
            we&apos;ve measured come back at roughly <strong>64kbps AAC</strong>,
            so a 320kbps export would be two and a half times the file size
            carrying bit-for-bit the same audible content. Lossy audio
            can&apos;t be un-lost by moving it into a bigger container.
          </p>

          <h3>Why 320kbps claims are worth ignoring</h3>
          <p>
            128kbps is double the source rate, which gives the encoder enough
            headroom that nothing audible is dropped on the way through. Any
            converter promising 320kbps from a TikTok is either mistaken or
            counting on you not checking — and it takes about thirty seconds to
            check in Audacity.{" "}
            <Link href="/guides/tiktok-audio-quality-explained">
              Read TikTok Audio Quality: Why 320 kbps Is a Myth
            </Link>{" "}
            for the measurements and the reasoning.
          </p>
        </ToolSection>

        {/* The honest-limits section is the real differentiator. Every
            competitor page implies all of this works and none of them say what
            happens when it doesn't — so the person who hit one of these errors
            is back on Google with a question nobody wrote an answer to. */}
        <ToolSection id="failures" title="Why can't I download a TikTok MP3?" bleed>
          <Prose>
            <p>
              Some TikTok links can&apos;t be converted at all — by us or by
              anyone. The converter names which case it hit rather than showing a
              generic failure, but it&apos;s worth knowing the list before you
              paste a link and wonder what went wrong:
            </p>
          </Prose>
          <div className="mt-5 overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">Link type</th>
                  <th className="px-4 py-3 font-semibold">Why it fails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                {FAILURE_CASES.map(([type, why]) => (
                  <tr key={type}>
                    <td className="px-4 py-3 text-text-primary">{type}</td>
                    <td className="px-4 py-3">{why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Prose className="mt-5">
            <p>
              If a link fails for any other reason, it&apos;s usually transient —
              wait a few seconds and run it again.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="who-for" title="Who is this for?" bleed>
          <Prose>
            <p>
              TikTok audio gets pulled for a lot of different reasons, and most of
              them have nothing to do with reposting the video:
            </p>
          </Prose>
          <div className="mt-5 overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">Who</th>
                  <th className="px-4 py-3 font-semibold">What they do with the MP3</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                {AUDIENCES.map(([who, what]) => (
                  <tr key={who}>
                    <td className="px-4 py-3 text-text-primary">{who}</td>
                    <td className="px-4 py-3">{what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Prose className="mt-6">
            <h3>What to do after you download the MP3</h3>
            <p>
              Most of those want one more step after converting. Trim the clip
              down with the <Link href="/trim">Audio Trimmer</Link> and add a
              short <Link href="/fade">fade in and out</Link> so the cut
              doesn&apos;t click, or send it straight to the{" "}
              <Link href="/ringtone-maker">Ringtone Maker</Link>, which handles
              the 30-second cap and the M4R format iPhones expect.{" "}
              <Link href="/guides/tiktok-sound-to-ringtone">
                Read How to Make a Ringtone from a TikTok Sound
              </Link>{" "}
              for where to cut the hook and how to actually install it on your
              phone.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="about" title="About the TikTok to MP3 converter">
          <p>
            AudioForges&apos; TikTok converter is completely free and extracts
            the audio track from a video URL, delivering it as a standard{" "}
            <strong>MP3</strong> (128kbps, 44.1kHz stereo). It works with app
            share links (vt.tiktok.com, vm.tiktok.com), full www.tiktok.com video
            URLs, /t/ share links and m.tiktok.com mobile links — one video at a
            time, and only public ones.
          </p>
          <p>
            <strong>Common legitimate uses:</strong> saving your own uploads,
            keeping a sound for offline listening, pulling a clip for a project
            where you hold or have been granted the rights, and building a
            ringtone from audio you&apos;re entitled to use.
          </p>
          <p>
            Sampling it into a track instead? Run it through the{" "}
            <Link href="/key-finder">Key &amp; BPM Finder</Link> first so it sits
            in your project rather than fighting it, or pull the vocal out of it
            with the <Link href="/vocal-remover">Vocal Remover</Link>.
          </p>
        </ToolSection>

        <RelatedToolsGrid tools={relatedTools} />

        {/* h3, not h2 — a footnote under the page's content rather than a
            section sitting in the outline beside the real ones. */}
        <section className="rounded-xl border border-graphite-800 bg-graphite-900 p-5">
          <h3 className="font-semibold text-text-primary">Copyright &amp; fair use</h3>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            This tool is intended for downloading content you own the rights to,
            that is royalty-free or Creative Commons licensed, or that is in the
            public domain. Sounds on TikTok are often licensed to TikTok rather
            than to the person who posted them. You are solely responsible for
            ensuring you have the right to download and use any audio.
            AudioForges does not host, store, or distribute copyrighted material.
          </p>
        </section>

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}