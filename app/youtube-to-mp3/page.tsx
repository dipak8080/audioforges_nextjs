import type { Metadata } from "next";
import Link from "next/link";
import { YouTubeConverterForm } from "@/components/converter/YouTubeConverterForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { Prose } from "@/components/ui/Prose";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { ProofStrip } from "@/components/tools/ProofStrip";
import { CompareTable } from "@/components/tools/CompareTable";
import { PageByline } from "@/components/tools/PageByline";
import { BitrateChainDiagram } from "@/components/tools/BitrateChainDiagram";
import { ToolVideo } from "@/components/media/ToolVideo";
import { SITE_URL } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
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
  "Free YouTube to MP3 converter and downloader. Paste a link, get 320kbps audio in seconds, no signup, no watermark, no app, on phone or desktop.";

const UPDATED = "2026-09-10";

const DOWNLOAD_LIMIT = getRateLimitLabel("download") ?? "30 per hour";

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
  dateModified: UPDATED,
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
      "Copy the video URL from YouTube, paste it into the converter above, and click Convert to MP3. The file is ready in roughly 8 to 20 seconds and downloads when you click Download, nothing saves to your device before that.",
  },
  {
    question: "Is this YouTube to MP3 converter free?",
    answer:
      `Yes. No account, no email, no payment, and no watermark or spoken tag on the file. The fair-use limit is ${DOWNLOAD_LIMIT} per IP address, which exists to keep the queue moving rather than to sell you an upgrade; there isn't one.`,
  },
  {
    question: "What bitrate is the MP3?",
    answer:
      "320kbps CBR at 44.1kHz. Worth knowing what that actually means: YouTube serves audio as Opus at roughly 130-160kbps, so a 320kbps MP3 is not adding detail that was never in the source. What it does is guarantee the re-encode itself costs you nothing audible, because the encoder has far more headroom than the source needs.",
  },
  {
    question: "Is 320kbps really better than 128kbps here?",
    answer:
      "For a YouTube source, marginally, and only because the encoder has more room to work with. Anyone advertising 320kbps as if it recovers quality YouTube never sent is either mistaken or counting on you not checking. We offer it because a bigger file costs you nothing but disk space, not because it performs magic on the source.",
  },
  {
    question: "How big is the MP3 file?",
    answer:
      "At 320kbps, roughly 2.4MB per minute, so a four-minute song is about 9-10MB, and an hour-long podcast is about 140MB. If storage matters more than headroom, converting to WAV and re-encoding smaller elsewhere is the wrong route; just accept the 320kbps file, since it's already an order of magnitude smaller than the WAV equivalent.",
  },
  {
    question: "Will the MP3 play in my car stereo or on a USB stick?",
    answer:
      "Almost certainly. MP3 is the most widely supported audio format there is, car head units, USB players, older phones and cheap MP3 players read it when they reject almost everything else. That compatibility, not audio quality, is the actual reason to pick MP3 over WAV or FLAC.",
  },
  {
    question: "Does this work on iPhone and Android?",
    answer:
      "Yes, in any mobile browser, with nothing to install. On iPhone the MP3 saves into the Files app under Downloads. On Android it lands in your Downloads folder and is picked up automatically by any music player that scans local storage.",
  },
  {
    question: "Does it support YouTube Shorts?",
    answer:
      "Yes. Standard youtube.com/watch links, short youtu.be links and /shorts URLs all work. Playlists don't, the converter handles one video URL at a time.",
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
        file works on top of decisions the encoder already made for you, use the{" "}
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
        meta={["No account", "No watermark", "320kbps CBR"]}
        title="YouTube to MP3 Converter"
        lede="Convert YouTube to MP3 free at 320kbps. Paste a link, download in seconds, no signup, no watermark, no app."
        /* defaultFormat="mp3" — without it the form loads with WAV preselected
           and the page promises something the tool doesn't offer on arrival.
           See YouTubeConverterForm's prop. */
        tool={<YouTubeConverterForm defaultFormat="mp3" />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Output",
              value: "320kbps CBR at 44.1kHz",
              note: "The highest MP3 rate, with headroom over what YouTube actually sends. See below for what that does and does not buy.",
            },
            {
              label: "Size",
              value: "About 2.4MB a minute",
              note: "A four-minute track lands under 10MB. Fits a phone, a USB stick or a car head unit without thinking about it.",
            },
            {
              label: "The file itself",
              value: "One clean MP3, named after the video",
              note: "No spoken tag over the intro, no sponsor message on the end, no bundled installer.",
            },
          ]}
        />

        <ToolSection id="how-to" title="Three steps, nothing to install" bleed>
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              ["Copy the link", "Any YouTube, Shorts or youtu.be URL, from the address bar or the share sheet."],
              ["Paste it above", "MP3 is already selected on this page. Nothing else to set."],
              ["Download", "The audio is pulled straight from the URL. Nothing reaches your device until you press Download."],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5">
                <p className="font-mono text-[11px] text-amber-400">Step {i + 1}</p>
                <p className="mt-1.5 font-medium text-text-primary">{t}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{d}</p>
              </li>
            ))}
          </ol>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-graphite-800 bg-graphite-900 p-4">
              <p className="font-medium text-text-primary">On iPhone</p>
              <p className="mt-1 text-sm leading-relaxed text-text-muted">
                Copy the link in the YouTube app, open this page in Safari and paste. The MP3 saves into Files under
                Downloads, where the Music app, VLC and most other players can reach it.
              </p>
            </div>
            <div className="rounded-xl border border-graphite-800 bg-graphite-900 p-4">
              <p className="font-medium text-text-primary">On Android</p>
              <p className="mt-1 text-sm leading-relaxed text-text-muted">
                Same steps in Chrome or any browser. The file lands in Downloads and appears in any music player
                that scans local storage.
              </p>
            </div>
          </div>
          <Prose className="mt-5">
            <p>
              One video at a time. There is no batch mode or playlist support, and that is deliberate: bulk
              downloaders are the ones YouTube blocks fastest, and a converter that works today is worth more than
              one that grabs a hundred videos and then stops working entirely.
            </p>
          </Prose>
        </ToolSection>

        {/* The honest-bitrate section. Every competing page in this SERP sells
            320kbps as if it recovers quality. Saying what the chain actually is
            — Opus source, MP3 target — is the same move that differentiates
            /tiktok-to-mp3, and it's the one thing on this page nobody above us
            is willing to write. */}
        <ToolSection id="bitrate" title="What 320kbps actually gets you" bleed>
          <BitrateChainDiagram
            outputLabel="320 kbps MP3"
            outputWidth={310}
            caption="The bottom bar is longer than the middle one, but it cannot contain more. 320 kbps gives the MP3 encoder roughly twice the headroom it needs, so nothing audible is lost passing through it. That is the whole benefit, and it is a real one. It is not more detail than YouTube sent."
          />
          <Prose className="mt-5">
            <p>
              YouTube does not serve lossless audio. It serves Opus at roughly 130 to 160 kbps, or AAC at similar
              rates on older streams. That is the ceiling on what any converter can hand you, including this one.
              We offer 320 because you asked for it and because a larger file costs you nothing but disk space,
              not because it does something the source can support.
            </p>
            <p>
              Any converter advertising 320kbps as though it improves on the stream is either mistaken or counting
              on you not checking. Checking takes about thirty seconds in Audacity.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="file-sizes" title="MP3 file sizes, in practice" bleed>
          <Prose>
            <p>
              At 320kbps a minute of audio is about 2.4MB, which makes the maths
              easy for anything you&apos;re planning to fit onto a phone, a USB
              stick, or a car head unit:
            </p>
          </Prose>
          <CompareTable
            columns={["MP3 at 320kbps", "The same audio as WAV"]}
            highlight={0}
            rows={FILE_SIZES.map(([length, mp3, wav]) => ({
              label: length,
              cells: [
                { text: mp3, mono: true },
                { text: wav, mono: true },
              ],
            }))}
            footnote="The audio is the same. WAV costs about four times the storage, and a car stereo cannot tell the difference."
          />
          <Prose className="mt-5">
            <p>
              The right-hand column is the practical reason most people want MP3
              and not WAV: the audio is the same, the storage is four times the
              cost, and a car stereo can&apos;t tell the difference anyway.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="next" title="When MP3 is the wrong choice" bleed>
          <Prose className="mb-5">
            <p>
              MP3 is right for listening. It stops being right the moment the file gets processed rather than
              played, because every edit works on top of decisions the encoder already made and cannot undo. If any
              of these is the plan, start somewhere else.
            </p>
          </Prose>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Sampling or DJing", "Uncompressed 44.1kHz, one fewer lossy step before your project.", "/youtube-to-wav", "Same converter, WAV"],
              ["Remove the vocals", "An instrumental for karaoke, or the acapella on its own.", "/youtube-vocal-remover", "Paste the same link"],
              ["Split into stems", "Vocals, drums, bass and other as four separate files.", "/youtube-stem-splitter", "Paste the same link"],
              ["Find key and BPM", "Camelot code included, ready for your DJ library.", "/key-finder", "Upload the file"],
            ].map(([title, desc, href, how]) => (
              <Link
                key={href}
                href={href}
                prefetch={false}
                className="group rounded-xl border border-graphite-800 bg-graphite-900 p-4 transition-colors hover:border-amber-500/40"
              >
                <p className="font-medium text-text-primary group-hover:text-amber-400">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">{desc}</p>
                <p className="mt-2 font-mono text-[11px] text-text-subtle">{how}</p>
              </Link>
            ))}
          </div>
          <Prose className="mt-5">
            <p>
              <Link href="/guides/wav-vs-mp3-for-sampling">WAV vs MP3 for Sampling</Link> covers what actually
              changes, with the detail this summary skips.
            </p>
          </Prose>
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
          <div className="my-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Your own uploads", "You hold the rights. Downloading your own audio is unambiguous."],
              ["Creative Commons", "Check the licence on the video page and follow the attribution terms."],
              ["Public domain", "Old recordings, government footage, anything whose copyright has expired."],
              ["Explicit permission", "A message from the rights holder saying yes is the whole test."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-4">
                <p className="font-medium text-text-primary">{t}</p>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">{d}</p>
              </div>
            ))}
          </div>
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
            isn&apos;t legal advice, it&apos;s the shape of the question so you
            can answer it for your own situation.
          </p>
        </ToolSection>

        <ToolVideo slug="youtube-to-mp3" />

        <FAQSection faqs={faqs} />

        <RelatedToolsGrid tools={relatedTools} />

        <PageByline
          updated={UPDATED}
          legal="This tool is for content you own, that is royalty-free or Creative Commons licensed, or that is in the public domain. You are responsible for having the right to download and use anything you convert. AudioForges does not host, store or distribute copyrighted material."
        />
      </ToolPageShell>
    </>
  );
}