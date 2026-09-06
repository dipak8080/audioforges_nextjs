import type { Metadata } from "next";
import Link from "next/link";
import { YouTubeConverterForm } from "@/components/converter/YouTubeConverterForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { Prose } from "@/components/ui/Prose";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { ToolVideo } from "@/components/media/ToolVideo";
import { SITE_URL } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { ogForTool } from "@/lib/og";

/**
 * WHY THIS EXISTS AS A SEPARATE URL
 *
 * tools.ts states the rule: "One URL per underlying tool concept, not two
 * near-duplicate pages competing for the same search intent." This page is a
 * deliberate exception, and the exception has to be earned rather than
 * assumed, so the reasoning is recorded here.
 *
 * "youtube to wav" and "youtube to mp3" run on the same endpoint but they are
 * not the same search intent:
 *
 *   WAV — producers, DJs, sampling, DAW import. Wants: lossless container, no
 *         re-encode, sample rate, bit depth. Post-conversion step is a key
 *         finder or a stem splitter.
 *   MP3 — phones, cars, offline listening, storage. Wants: file size,
 *         bitrate, device compatibility, how many fit on a USB stick.
 *         Post-conversion step is a trim or a ringtone.
 *
 * Different people, different follow-up questions, different related tools.
 * Bing's own related-searches panel on "youtube to wav" surfaces "YouTube to
 * mp3" as the FIRST suggestion, which is the engine saying outright that it
 * treats these as adjacent-but-distinct queries.
 *
 * The duplicate risk is handled two ways: this page shares no body copy with
 * /youtube-to-wav (the WAV page's format-comparison table is NOT repeated
 * here), and the two cross-link with descriptive anchors so the relationship
 * reads as sibling rather than copy. IF A FUTURE EDIT MAKES THIS PAGE'S COPY
 * CONVERGE ON THE WAV PAGE'S, that is the signal to merge them back, not to
 * keep two thin pages.
 *
 * TITLE: `{ absolute: ... }`, never a bare string. A bare string opts into the
 * root layout's `title.template`, which appends " | AudioForges" — a crawl of
 * /youtube-to-wav confirmed it was serving 51 chars against 33 in source. On a
 * commercial query against mp3horde, ssstik and savefrom, fourteen characters
 * of a brand with zero recorded search volume is the worst possible use of
 * title space.
 *
 * The exact phrase leads. Bing weights exact-match placement at position zero
 * noticeably harder than Google does, and Bing is currently ~87% of this
 * site's organic traffic, so it gets to decide the word order.
 *
 * MEASURED, Bing Keyword Research, three months to 30 Aug 2026:
 *
 *   youtube to mp3             1.1M   head term — keeps position zero
 *   youtube mp3              509.6K
 *   youtube to mp3 converter 323.9K
 *   yt to mp3                  247K
 *   youtube converter        188.4K
 *   youtube mp3 converter    162.5K
 *   youtube downloader mp3   111.2K   <- was absent from the title
 *
 * "& Downloader" replaces "No Signup". Converter and downloader are the same
 * action to a user and different intents to an engine, and the downloader
 * phrasing is a six-figure cluster the title said nothing about. "No signup"
 * has no measurable search volume — it belongs in the description, where it
 * still does its CTR job.
 */
const PAGE_TITLE = "YouTube to MP3 Converter & Downloader – Free 320kbps";
const PAGE_DESCRIPTION =
  "Free YouTube to MP3 converter and downloader. Paste a link, get 320kbps audio in seconds — no signup, no watermark, no app, on phone or desktop.";

const OG_IMAGE = ogForTool("youtube-to-mp3", "YouTube to MP3 Converter");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  // `keywords` removed — ignored by Google since 2009, treated as a spam
  // signal by Bing, and every term it held already appears in the body copy.
  alternates: { canonical: `${SITE_URL}/youtube-to-mp3` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/youtube-to-mp3`,
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
  name: "YouTube to MP3 Converter & Downloader",
  url: `${SITE_URL}/youtube-to-mp3`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Convert YouTube videos to MP3",
    "320kbps CBR output",
    "Download YouTube audio without an app",
    "No sign-up required",
    "No watermark",
    "Supports YouTube Shorts",
  ],
};

// No aggregateRating. Same reasoning as /tiktok-to-mp3: the pages ranking
// above us carry review markup backed by testimonials that read as invented,
// there's no honest version of that for a tool with no review system, and it's
// a manual-action risk.
//
// FAQPage comes from <FAQSection />, BreadcrumbList from <Breadcrumb />.

const FILE_SIZES = [
  ["3-minute song", "~7 MB", "~30 MB"],
  ["10-minute mix", "~24 MB", "~100 MB"],
  ["1-hour podcast", "~140 MB", "~600 MB"],
  ["100 songs", "~700 MB", "~3 GB"],
];

const faqs = [
  {
    question: "How do I convert a YouTube video to MP3?",
    answer:
      "Copy the video URL from YouTube, paste it into the converter above, and click Convert to MP3. The file is ready in roughly 8 to 20 seconds and downloads when you click Download — nothing saves to your device before that.",
  },
  {
    question: "Is this YouTube to MP3 converter free?",
    answer:
      "Yes. No account, no email, no payment, and no watermark or spoken tag on the file. There's a short per-minute limit on how fast you can run conversions, which exists to keep the queue moving rather than to sell you an upgrade — there isn't one.",
  },
  {
    question: "What bitrate is the MP3?",
    answer:
      "320kbps CBR at 44.1kHz. Worth knowing what that actually means: YouTube serves audio as Opus at roughly 130-160kbps, so a 320kbps MP3 is not adding detail that was never in the source. What it does is guarantee the re-encode itself costs you nothing audible, because the encoder has far more headroom than the source needs.",
  },
  {
    question: "Is 320kbps really better than 128kbps here?",
    answer:
      "For a YouTube source, marginally — and only because the encoder has more room to work with. Anyone advertising 320kbps as if it recovers quality YouTube never sent is either mistaken or counting on you not checking. We offer it because a bigger file costs you nothing but disk space, not because it performs magic on the source.",
  },
  {
    question: "How big is the MP3 file?",
    answer:
      "At 320kbps, roughly 2.4MB per minute — so a four-minute song is about 9-10MB, and an hour-long podcast is about 140MB. If storage matters more than headroom, converting to WAV and re-encoding smaller elsewhere is the wrong route; just accept the 320kbps file, since it's already an order of magnitude smaller than the WAV equivalent.",
  },
  {
    question: "Will the MP3 play in my car stereo or on a USB stick?",
    answer:
      "Almost certainly. MP3 is the most widely supported audio format there is — car head units, USB players, older phones and cheap MP3 players read it when they reject almost everything else. That compatibility, not audio quality, is the actual reason to pick MP3 over WAV or FLAC.",
  },
  {
    question: "Does this work on iPhone and Android?",
    answer:
      "Yes, in any mobile browser, with nothing to install. On iPhone the MP3 saves into the Files app under Downloads. On Android it lands in your Downloads folder and is picked up automatically by any music player that scans local storage.",
  },
  {
    question: "Does it support YouTube Shorts?",
    answer:
      "Yes. Standard youtube.com/watch links, short youtu.be links and /shorts URLs all work. Playlists don't — the converter handles one video URL at a time.",
  },
  {
    question: "Why did my conversion fail?",
    answer:
      "The usual causes are a private, deleted or copyright-removed video, a region-restricted video unavailable from our server's location, or YouTube temporarily demanding extra verification. Trying a different video, or the same one a few minutes later, resolves most of these.",
  },
  {
    question: "Should I use MP3 or WAV?",
    answer:
      "MP3 if the file is going onto a phone, a car stereo, or a USB stick, or if you just want to listen to it. WAV if it's going into a DAW, a DJ deck, or a sampler, because every further process you apply to a lossy file works on top of decisions the encoder already made for you.",
    answerNode: (
      <>
        MP3 if the file is going onto a phone, a car stereo, or a USB stick, or
        if you just want to listen to it. WAV if it&apos;s going into a DAW, a DJ
        deck, or a sampler, because every further process you apply to a lossy
        file works on top of decisions the encoder already made for you — use the{" "}
        <Link href="/youtube-to-wav" className="text-amber-400 hover:underline">
          YouTube to WAV converter
        </Link>{" "}
        for that.
      </>
    ),
  },
  {
    question: "Is downloading YouTube audio legal?",
    answer:
      "It depends on the content and what you do with it: your own uploads, Creative Commons and public-domain material, and anything you have the rights holder's permission for are fine. Commercial music on YouTube is licensed to YouTube, not to you. You are responsible for how you use the tool.",
  },
];

export default function YouTubeToMp3Page() {
  const relatedTools = getRelatedTools("youtube-to-mp3", 5);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
      />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "YouTube to MP3" }]} />
        }
        title="YouTube to MP3 Converter"
        lede="Convert YouTube to MP3 free at 320kbps. Paste a link, download in seconds — no signup, no watermark, no app."
        /* defaultFormat="mp3" — without it the form loads with WAV preselected
           and the page promises something the tool doesn't offer on arrival.
           See YouTubeConverterForm's prop. */
        tool={<YouTubeConverterForm defaultFormat="mp3" />}
      >
        <FeatureStrip
          features={[
            {
              title: "320kbps",
              desc: "CBR at 44.1kHz — the highest MP3 rate, with room to spare over the source.",
            },
            {
              title: "Small files",
              desc: "About 2.4MB a minute. A four-minute track is under 10MB.",
            },
            {
              title: "Plays anywhere",
              desc: "Phones, car stereos, USB sticks, old MP3 players. MP3 is universal.",
            },
          ]}
        />

        <ToolSection id="how-to" title="How to convert YouTube to MP3">
          <p>
            Converting a YouTube video to MP3 takes three steps and no software
            install. The converter pulls the audio track straight from the URL you
            paste — you never download the video and strip the audio out yourself,
            and nothing reaches your device until you press Download.
          </p>
          <ol>
            <li>Copy a YouTube video, Shorts, or youtu.be URL.</li>
            <li>Paste it into the converter above — MP3 is already selected.</li>
            <li>Click Convert, then Download when the file is ready.</li>
          </ol>

          <h3>On iPhone</h3>
          <p>
            Copy the link in the YouTube app, open this page in Safari and paste.
            The MP3 saves into the Files app under Downloads, where the Music app,
            VLC and most other players can reach it.
          </p>

          <h3>On Android</h3>
          <p>
            Same steps in Chrome or any other browser. The file lands in your
            Downloads folder and appears automatically in any music player that
            scans local storage.
          </p>
        </ToolSection>

        {/* The honest-bitrate section. Every competing page in this SERP sells
            320kbps as if it recovers quality. Saying what the chain actually is
            — Opus source, MP3 target — is the same move that differentiates
            /tiktok-to-mp3, and it's the one thing on this page nobody above us
            is willing to write. */}
        <ToolSection id="bitrate" title="What 320kbps actually gets you">
          <p>
            YouTube doesn&apos;t serve lossless audio. It serves{" "}
            <strong>Opus at roughly 130–160kbps</strong>, or AAC at similar rates
            on older streams. That is the ceiling on what any converter can
            possibly hand you, including this one.
          </p>
          <p>
            So a 320kbps MP3 from YouTube is not recovering detail that was never
            sent. What it does is make the re-encode free: with roughly double the
            source&apos;s bitrate to work with, the MP3 encoder has enough headroom
            that nothing audible is lost passing through it. That is a real benefit
            and a modest one, and it is worth having because a larger file costs
            you nothing but disk space.
          </p>
          <p>
            What it isn&apos;t is magic. Any converter advertising 320kbps as
            though it improves on YouTube&apos;s stream is either mistaken or
            counting on you not checking, and checking takes about thirty seconds
            in Audacity. We offer the rate because you asked for it, not because it
            does something the source can support.
          </p>
        </ToolSection>

        <ToolSection id="file-sizes" title="MP3 file sizes, in practice" bleed>
          <Prose>
            <p>
              At 320kbps a minute of audio is about 2.4MB, which makes the maths
              easy for anything you&apos;re planning to fit onto a phone, a USB
              stick, or a car head unit:
            </p>
          </Prose>
          <div className="mt-5 overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">Length</th>
                  <th className="px-4 py-3 font-semibold">MP3 at 320kbps</th>
                  <th className="px-4 py-3 font-semibold">Same audio as WAV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                {FILE_SIZES.map(([length, mp3, wav]) => (
                  <tr key={length}>
                    <td className="px-4 py-3 text-text-primary">{length}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{mp3}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{wav}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Prose className="mt-5">
            <p>
              The right-hand column is the practical reason most people want MP3
              and not WAV: the audio is the same, the storage is four times the
              cost, and a car stereo can&apos;t tell the difference anyway.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="when-wav" title="When to pick WAV instead">
          <p>
            MP3 is the right answer for listening. It stops being the right answer
            the moment the file is going to be processed rather than played —
            dropped into a DAW, loaded onto a DJ deck, chopped in a sampler, or
            pitched and time-stretched. Every one of those works on top of
            decisions the MP3 encoder already made and can&apos;t undo, and heavy
            processing is what exposes them.
          </p>
          <p>
            If that&apos;s the plan, use the{" "}
            <Link href="/youtube-to-wav">YouTube to WAV converter</Link> instead —
            same converter, uncompressed 44.1kHz output, and one fewer lossy step
            between the source and your project.{" "}
            <Link href="/guides/wav-vs-mp3-for-sampling">
              Read WAV vs MP3 for Sampling: What Actually Changes
            </Link>{" "}
            for the detail.
          </p>
        </ToolSection>

        {/*
          "how to convert youtube to mp3 legally" — 50.8K impressions over
          three months and the steepest-rising trend in the whole cluster.
          Informational intent, far less contested than the converter terms,
          and the only honest answer to it was buried in an FAQ.

          Written as the actual answer rather than a hedge. Every competing
          page either ignores the question or implies everything is fine; the
          real answer has four clear cases and one grey one, and saying so is
          the same move the bitrate section above makes.
        */}
        <ToolSection id="legal" title="How to convert YouTube to MP3 legally">
          <p>
            The honest answer is that it depends on the video, not on the tool.
            Four cases are clearly fine:
          </p>
          <ul>
            <li>
              <strong>Your own uploads.</strong> You hold the rights; downloading
              your own audio is unambiguous.
            </li>
            <li>
              <strong>Creative Commons video.</strong> YouTube has a CC-BY filter
              in search tools. Check the licence on the video page and follow the
              attribution terms.
            </li>
            <li>
              <strong>Public domain material.</strong> Old recordings, government
              footage, anything whose copyright has expired.
            </li>
            <li>
              <strong>Anything you have permission for.</strong> A message from
              the rights holder saying yes is the whole test.
            </li>
          </ul>
          <p>
            Commercial music is the case people actually mean, and there the
            answer is no in most places: those tracks are licensed to YouTube for
            streaming, not licensed to you for download. Some countries allow a
            personal private copy and others explicitly don&apos;t, so it turns on
            where you are rather than on which converter you use. YouTube&apos;s
            own Terms of Service separately prohibit downloading without
            permission, which is a contract question rather than a copyright one.
          </p>
          <p>
            What no converter can do is change any of that. A tool advertising
            &quot;100% legal downloads&quot; is describing its own software, not
            your rights to the audio. We don&apos;t make that claim, and this
            isn&apos;t legal advice — it&apos;s the shape of the question so you
            can answer it for your own situation.
          </p>
        </ToolSection>

        <ToolSection id="downloader" title="YouTube MP3 downloader — what you get">
          <p>
            Used as a YouTube MP3 downloader, this does the job and stops there:
            one link in, one clean MP3 out, named after the video. No watermark, no
            spoken tag over the intro, no sponsor message welded onto the end, and
            no bundled installer — three of which are routine on free YouTube audio
            downloaders and all of which make the file useless for anything but a
            single listen.
          </p>
          <p>
            There&apos;s no batch mode and no playlist support. One video at a
            time, which is a deliberate limit rather than a missing feature: bulk
            downloaders are the ones YouTube blocks fastest, and a converter that
            works today is worth more than one that grabs a hundred videos until it
            stops working entirely.
          </p>
        </ToolSection>

        <ToolVideo slug="youtube-to-mp3" />

        <RelatedToolsGrid tools={relatedTools} />

        {/* h3, not h2 — a footnote under the page's content rather than a
            section sitting in the outline beside the real ones. */}
        <section className="rounded-xl border border-graphite-800 bg-graphite-900 p-5">
          <h3 className="font-semibold text-text-primary">Copyright &amp; fair use</h3>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            This tool is intended for downloading content you own the rights to,
            that is royalty-free or Creative Commons licensed, or that is in the
            public domain. You are solely responsible for ensuring you have the
            right to download and use any content. AudioForges does not host,
            store, or distribute copyrighted material.
          </p>
        </section>

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}