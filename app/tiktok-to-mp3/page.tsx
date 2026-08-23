import type { Metadata } from "next";
import Link from "next/link";
import { TikTokToMp3Form } from "@/components/converter/TikTokToMp3Form";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

/**
 * KEYWORD TARGETS (18 Aug 2026, Ahrefs phrase-match):
 *   tiktok to mp3            >10,000/mo  Easy
 *   tiktok to mp3 converter   >1,000/mo  Easy
 *   convert tiktok to mp3       >100/mo  Hard
 *   tiktok to mp3 file/player   >100/mo
 *
 * DOWNLOADER INTENT (23 Aug 2026, SE Ranking content brief): the top ten
 * pages for this term collectively rank for a second phrase family this
 * page did not previously contain anywhere in its visible copy —
 * "tiktok audio downloader" (1,900/mo), "mp3 downloader" (49,500/mo),
 * "tiktok mp3 downloader", "tiktok video downloader", "tiktok sounds"
 * (410/mo, plural). Every one of those was already sitting in the
 * `keywords` meta array below, which Google has ignored since 2009. The
 * "TikTok audio downloader" section further down puts them in body text,
 * where they are actually read. Converter and downloader are adjacent but
 * distinct intents — one implies a format change, the other implies
 * getting a file off a platform — and a page that only speaks one of them
 * is invisible to half the query space.
 *
 * TITLE — READ BEFORE EDITING (23 Aug 2026):
 * `title` is `{ absolute: PAGE_TITLE }`, not a bare string. Passing a
 * string opts INTO the `title.template` defined in the root layout, which
 * appends " | AudioForges". A site crawl confirmed the rendered title was
 * "TikTok to MP3 Converter – Free MP3 Download | AudioForges" (57 chars)
 * despite the comment below asserting the brand was omitted — the comment
 * described intent, the template quietly overrode it. `absolute` is the
 * only form that actually suppresses the template.
 *
 * The original reasoning, which still holds: no "| AudioForges" on a
 * commercial query against established competitors. Fourteen characters
 * of a brand nobody searches for yet is worse spent than fourteen
 * characters of search concept. Add it back when the brand is worth
 * searching for — GSC currently records zero queries containing
 * "audioforges", so that day is not today.
 *
 * H1 keeps the site's "Free X Converter" pattern. It contains the exact
 * primary phrase as a substring, so trimming it to a bare "TikTok to
 * MP3" would remove the strongest CTR modifier and the secondary keyword
 * without making the match any more exact.
 */

const PAGE_TITLE = "TikTok to MP3 Converter – Free MP3 Download";
const PAGE_DESCRIPTION =
  "Convert TikTok videos to MP3 online for free. Paste a TikTok link, download the audio in seconds, and listen on any device.";

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  keywords: [
    "tiktok to mp3",
    "tiktok to mp3 converter",
    "convert tiktok to mp3",
    "download tiktok mp3",
    "tiktok mp3 downloader",
    "tiktok audio downloader",
    "download tiktok audio",
    "tiktok to mp3 online",
    "tiktok to mp3 free",
    "tiktok sound downloader",
    "tiktok to mp3 iphone",
    "tiktok to mp3 android",
  ],
  alternates: {
    canonical: `${SITE_URL}/tiktok-to-mp3`,
  },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/tiktok-to-mp3`,
    siteName: "AudioForges",
    type: "website",
    images: [
      {
        url: "/images/og-default.png",
        width: 1200,
        height: 630,
        alt: "AudioForges",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/images/og-default.png"],
  },
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "TikTok to MP3 Converter",
  url: `${SITE_URL}/tiktok-to-mp3`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "Convert TikTok videos to MP3",
    "Download TikTok audio and sounds as MP3",
    "Works with vt.tiktok.com and vm.tiktok.com share links",
    "No sign-up required",
    "No watermark",
    "Preview before download",
  ],
};

// No aggregateRating, deliberately: two of the three pages currently
// ranking for this term carry review markup backed by testimonials that
// read as invented. There is no honest version of that for a tool with
// no review system, and it's a manual-action risk.

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: SITE_URL,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "TikTok to MP3",
      item: `${SITE_URL}/tiktok-to-mp3`,
    },
  ],
};

// HowTo rich results were retired by Google in 2023, so this no longer
// produces a SERP feature. Kept because it is accurate, costs nothing,
// and is still consumed by non-Google parsers — but do not expect it to
// do anything visible, and do not add more of it hoping otherwise.
const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Convert TikTok to MP3",
  step: [
    {
      "@type": "HowToStep",
      name: "Copy the link",
      text: "Tap Share on the TikTok video and choose Copy link, or copy the URL from your browser's address bar.",
    },
    {
      "@type": "HowToStep",
      name: "Paste it",
      text: "Paste the link into the converter. Full URLs and short vt.tiktok.com or vm.tiktok.com links both work.",
    },
    {
      "@type": "HowToStep",
      name: "Convert and download",
      text: "Click Convert to MP3, listen back to check it's the right sound, then download the file.",
    },
  ],
};

const faqs = [
  {
    question: "How do I convert a TikTok video to MP3?",
    answer:
      "Tap Share on the TikTok video and choose Copy link, paste that link into the converter above, then click Convert to MP3. The audio comes back as an MP3 you can play before downloading — usually within a few seconds.",
  },
  {
    question: "Is this TikTok to MP3 converter free?",
    answer:
      "Yes, with no account and no payment. There's a limit of 30 conversions per hour from one connection, which exists to keep the service running for everyone rather than to push you toward a paid tier — there isn't one.",
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free TikTok to MP3 Converter
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Convert TikTok videos to MP3 online for free. Paste a TikTok link
            and download the audio in seconds — no account or app required.
          </p>
        </header>

        <TikTokToMp3Form />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "Fast",
              desc: "A fresh conversion takes 2–8 seconds. Cached sounds return almost instantly.",
            },
            {
              title: "Clean file",
              desc: "No watermark, no audio tag, no sponsor message spliced onto the end.",
            },
            {
              title: "No sign-up",
              desc: "No account, no email, no app, no TikTok login.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2"
            >
              <p className="font-semibold text-text-primary">{f.title}</p>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        {/* "Download TikTok MP3" is a distinct phrase in this SERP from
            "tiktok to mp3", and the one the incumbents lead with. It gets
            a section with real sentences rather than a bare keyword
            heading stuck above the converter - a heading with nothing
            under it is the filler pattern this page exists to beat. */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Download TikTok MP3</h2>
          <p className="text-text-muted leading-relaxed">
            Download TikTok audio as an MP3 straight from a video link — paste
            the URL above and the sound comes back as a file that plays on a
            phone, a laptop, or anything else that reads MP3. Nothing saves to
            your device until you choose to download, so you can listen first
            and check it&apos;s the right sound.
          </p>
          <p className="text-text-muted leading-relaxed">
            A fresh conversion takes two to eight seconds. A sound someone has
            already pulled comes back from cache in a fraction of that, which is
            why a trending TikTok is usually instant while an obscure one takes
            a moment longer.
          </p>
        </section>

        {/* DOWNLOADER SECTION (23 Aug 2026) - added because the page spoke
            only "converter" language while half the query space for this
            SERP is phrased as "downloader". The two words describe the
            same action to a user and different intents to a search engine.
            Written as an explanation of what you actually receive rather
            than a keyword shelf: the H3s underneath carry the specifics,
            which is also what pulls the page toward the brief's 15-23
            heading range from its previous ten. */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            TikTok audio downloader
          </h2>
          <p className="text-text-muted leading-relaxed">
            Used as a TikTok audio downloader, this does what a dedicated TikTok
            MP3 downloader does and stops there: it pulls the sound off a public
            video and gives you the file. There is no app to install, no
            extension, no second site to bounce through, and no step where you
            download the video first and strip the audio out yourself.
          </p>

          <h3 className="text-xl font-semibold text-text-primary pt-2">
            What you actually get
          </h3>
          <p className="text-text-muted leading-relaxed">
            One MP3 file per link, at 128kbps and 44.1kHz, named after the
            video. No watermark, no spoken tag over the intro, no sponsor
            message welded onto the end — three things that are routine on free
            TikTok downloaders and that make the file useless for anything but
            listening. The audio is the audio, unmodified.
          </p>

          <h3 className="text-xl font-semibold text-text-primary pt-2">
            Downloading TikTok sounds
          </h3>
          <p className="text-text-muted leading-relaxed">
            TikTok sounds work the same way as videos here, because they are the
            same thing underneath: paste a link to any public video using the
            sound and that sound comes back as an MP3. If you found a sound on
            its own TikTok page rather than on a video, open any post using it
            and copy that link instead — the sound page itself has no audio
            stream to fetch.
          </p>

          <h3 className="text-xl font-semibold text-text-primary pt-2">
            One at a time, and only public links
          </h3>
          <p className="text-text-muted leading-relaxed">
            There is no batch mode and no queue. One link, one MP3, then paste
            the next. That&apos;s a deliberate limit rather than a missing
            feature — bulk TikTok downloaders are the ones that get blocked
            fastest, and a converter that works today is worth more than one
            that scrapes a hundred videos until it stops working entirely.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            How to convert TikTok to MP3
          </h2>
          <p className="text-text-muted leading-relaxed">
            Converting a TikTok to MP3 takes three steps and no software
            install. The converter pulls the audio track from the video URL you
            paste — you never need to download the video itself first, and the
            file only reaches your device when you press Download.
          </p>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>
              Tap Share on the TikTok video and choose Copy link. On desktop,
              copy the URL from the address bar.
            </li>
            <li>Paste it into the converter above.</li>
            <li>Click Convert to MP3 and listen back to check the sound.</li>
            <li>Download the MP3 to your phone or computer.</li>
          </ol>

          <h3 className="text-xl font-semibold text-text-primary pt-2">
            On iPhone
          </h3>
          <p className="text-text-muted leading-relaxed">
            Copy the link inside the TikTok app, open this page in Safari, and
            paste. The MP3 saves into the Files app under Downloads, where the
            Music app, VLC and GarageBand can all reach it. Nothing to install.
          </p>

          <h3 className="text-xl font-semibold text-text-primary pt-2">
            On Android
          </h3>
          <p className="text-text-muted leading-relaxed">
            Same three steps in Chrome or any other browser. The file lands in
            your Downloads folder and shows up automatically in any music player
            or file manager that scans local storage.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            TikTok MP3 audio quality
          </h2>
          <p className="text-text-muted leading-relaxed">
            You get a 128kbps MP3 at 44.1kHz. We don&apos;t advertise 320kbps,
            and it matters that we don&apos;t: the TikTok audio streams
            we&apos;ve measured come back at roughly{" "}
            <strong className="text-text-primary">64kbps AAC</strong>, so a
            320kbps export would be two and a half times the file size carrying
            bit-for-bit the same audible content. Lossy audio can&apos;t be
            un-lost by moving it into a bigger container.
          </p>

          <h3 className="text-xl font-semibold text-text-primary pt-2">
            Why 320kbps claims are worth ignoring
          </h3>
          <p className="text-text-muted leading-relaxed">
            128kbps is double the source rate, which gives the encoder enough
            headroom that nothing audible is dropped on the way through. Any
            converter promising 320kbps from a TikTok is either mistaken or
            counting on you not checking — and it takes about thirty seconds to
            check in Audacity.{" "}
            <Link
              href="/guides/tiktok-audio-quality-explained"
              className="text-amber-400 hover:underline"
            >
              Read TikTok Audio Quality: Why 320 kbps Is a Myth
            </Link>{" "}
            for the measurements and the reasoning.
          </p>
        </section>

        {/* The honest-limits section is the real differentiator. Every
            competitor page implies all of this works and none of them say
            what happens when it doesn't - so the person who hit one of
            these errors is back on Google with a question nobody wrote an
            answer to. */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            Why can&apos;t I download a TikTok MP3?
          </h2>
          <p className="text-text-muted leading-relaxed">
            Some TikTok links can&apos;t be converted at all — by us or by
            anyone. The converter names which case it hit rather than showing a
            generic failure, but it&apos;s worth knowing the list before you
            paste a link and wonder what went wrong:
          </p>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-sm text-left text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">Link type</th>
                  <th className="px-4 py-3 font-semibold">Why it fails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3 text-text-primary">Photo / slideshow posts</td>
                  <td className="px-4 py-3">No video track, so there is no audio to extract</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-text-primary">Private or deleted videos</td>
                  <td className="px-4 py-3">The link has to be publicly viewable</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-text-primary">Age-restricted posts</td>
                  <td className="px-4 py-3">TikTok requires a logged-in session, which we deliberately don&apos;t use</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-text-primary">Region-locked posts</td>
                  <td className="px-4 py-3">Blocked at TikTok&apos;s end; a different network won&apos;t change it</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-text-primary">Videos over 10 minutes</td>
                  <td className="px-4 py-3">TikTok&apos;s own ceiling, and ours</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-text-muted leading-relaxed">
            If a link fails for any other reason, it&apos;s usually transient —
            wait a few seconds and run it again.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Who is this for?</h2>
          <p className="text-text-muted leading-relaxed">
            TikTok audio gets pulled for a lot of different reasons, and most of
            them have nothing to do with reposting the video:
          </p>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-sm text-left text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">Who</th>
                  <th className="px-4 py-3 font-semibold">What they do with the MP3</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3 text-text-primary">Video editors</td>
                  <td className="px-4 py-3">Drop a trending sound into a Premiere, CapCut, or Resolve timeline</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-text-primary">Producers</td>
                  <td className="px-4 py-3">Sample a sound they hold or have been granted the rights to use</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-text-primary">Dancers and choreographers</td>
                  <td className="px-4 py-3">Keep a track for offline practice without the app open</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-text-primary">Anyone making a ringtone</td>
                  <td className="px-4 py-3">Cut a short clip down to a notification or ringtone</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-text-primary">Language learners</td>
                  <td className="px-4 py-3">Save native-speaker audio for repeat listening</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-xl font-semibold text-text-primary pt-2">
            What to do after you download the MP3
          </h3>
          <p className="text-text-muted leading-relaxed">
            Most of those want one more step after converting. Trim the clip
            down with the{" "}
            <Link href="/trim" className="text-amber-400 hover:underline">
              Audio Trimmer
            </Link>{" "}
            and add a short{" "}
            <Link href="/fade" className="text-amber-400 hover:underline">
              fade in and out
            </Link>{" "}
            so the cut doesn&apos;t click, or send it straight to the{" "}
            <Link href="/ringtone-maker" className="text-amber-400 hover:underline">
              Ringtone Maker
            </Link>
            , which handles the 30-second cap and the M4R format iPhones expect.{" "}
            <Link
              href="/guides/tiktok-sound-to-ringtone"
              className="text-amber-400 hover:underline"
            >
              Read How to Make a Ringtone from a TikTok Sound
            </Link>{" "}
            for where to cut the hook and how to actually install it on your
            phone.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            About the TikTok to MP3 converter
          </h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              AudioForges&apos; TikTok converter is completely free and extracts
              the audio track from a video URL, delivering it as a standard{" "}
              <strong className="text-text-primary">MP3</strong> (128kbps,
              44.1kHz stereo). It works with app share links
              (vt.tiktok.com, vm.tiktok.com), full www.tiktok.com video URLs,
              /t/ share links and m.tiktok.com mobile links — one video at a
              time, and only public ones.
            </p>
            <p>
              <strong className="text-text-primary">Common legitimate uses:</strong>{" "}
              saving your own uploads, keeping a sound for offline listening,
              pulling a clip for a project where you hold or have been granted
              the rights, and building a ringtone from audio you&apos;re
              entitled to use.
            </p>
            <p>
              Sampling it into a track instead? Run it through the{" "}
              <Link href="/key-finder" className="text-amber-400 hover:underline">
                Key &amp; BPM Finder
              </Link>{" "}
              first so it sits in your project rather than fighting it, or pull
              the vocal out of it with the{" "}
              <Link href="/vocal-remover" className="text-amber-400 hover:underline">
                Vocal Remover
              </Link>
              .
            </p>
          </div>
        </section>

        {relatedTools.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-text-primary">More free tools</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {relatedTools.map((tool) => (
                <Link
                  key={tool.slug}
                  href={`/${tool.slug}`}
                  className="rounded-xl border border-graphite-800 bg-graphite-900 p-4 hover:border-amber-500/40 transition-colors"
                >
                  <h3 className="font-semibold text-text-primary">{tool.name}</h3>
                  <p className="text-sm text-text-muted mt-1">{tool.shortDescription}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
          <h2 className="font-semibold text-text-primary">Copyright &amp; fair use</h2>
          <p className="text-sm text-text-muted leading-relaxed">
            This tool is intended for downloading content you own the rights to,
            that is royalty-free or Creative Commons licensed, or that is in the
            public domain. Sounds on TikTok are often licensed to TikTok rather
            than to the person who posted them. You are solely responsible for
            ensuring you have the right to download and use any audio.
            AudioForges does not host, store, or distribute copyrighted
            material.
          </p>
        </section>

        <FAQSection faqs={faqs} />
      </main>
    </>
  );
}