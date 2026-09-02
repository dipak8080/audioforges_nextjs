import type { Metadata } from "next";
import Link from "next/link";
import { FadeForm } from "@/components/converter/FadeForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { Prose } from "@/components/ui/Prose";
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

/*
  TITLE. Volumes NOT pulled from Bing Keyword Research yet — verify and record
  them here: audio fade · fade in audio · fade out audio · fade mp3 ·
  add fade to audio · audio fade in out.

  What IS measured: a crawl of the live SERP (Sep 2026) — notevibes.com,
  audioeditor.org, premierely.io, wutools.com, aijinglemaker.com,
  products.aspose.app. Two findings.

  1. MP3 is named explicitly by almost every competitor, and Aspose runs a
     dedicated /mp3 subpage for it. This title said "Audio" only.

  2. THE ONE THAT MATTERS, AND IT IS NOT A COPY PROBLEM. Nearly every result
     processes in-browser and leads with it: "your file is never uploaded",
     "all processing happens on your device". That is the axis this SERP
     competes on, and we upload to a server, so we lose it outright.

     A fade is a gain ramp — Web Audio API handles it client-side, and
     components/browser/ already exists for exactly this kind of tool (BPM
     tapper, metronome). Moving fade there would make it instant, free to
     run, and let the page make the same privacy claim honestly. That is the
     change worth making here; the title below is the small half.
*/
const PAGE_TITLE = "Audio Fade In & Fade Out – Fade MP3 or WAV, Free";
const PAGE_DESCRIPTION =
  "Add a fade in and fade out to MP3, WAV, FLAC and more, online and free. Smooth an abrupt start or a hard cut at the end. No sign-up, no watermark.";

/**
 * The per-fade ceiling, from the same constant FadeForm enforces
 * (FADE_MAX_SECONDS). NOT a backend limit — it's a client-side control range,
 * so there's nothing in /limits to read it from. If it changes, change it
 * there and here together.
 */
const MAX_FADE_SECONDS = 30;

const OG_IMAGE = ogForTool("fade", "Free audio fade in & out");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/fade` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/fade`,
    siteName: SITE_NAME,
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

// Every claim below is checked against actual FadeForm/backend behaviour. No
// performance, accuracy or ranking claims.
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Audio Fade In/Out Tool",
  alternateName: [
    "Audio Fade In Out",
    "Fade In Audio",
    "Fade Out Audio",
    "MP3 Fade Tool",
    "Add Fade to Audio",
  ],
  url: `${SITE_URL}/fade`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Independent fade in and fade out durations",
    `Up to ${MAX_FADE_SECONDS} seconds per fade`,
    "Output keeps the original file format",
    "No sign-up required",
    "No watermark",
  ],
};

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.

export default async function FadePage() {
  const relatedTools = getRelatedTools("fade", 5);

  const limits = await getLimits();
  const durationCap = durationCapFor(limits, "fade");
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const faqs = [
    {
      question: "What is an audio fade?",
      answer:
        "A fade is a gradual change in volume over a short span, rather than an instant jump. A fade in ramps up from silence; a fade out ramps down to silence. Both smooth out what would otherwise be an abrupt start or stop.",
    },
    {
      question: "Do I need both a fade in and a fade out?",
      answer:
        "No — turn on just one if that's all you need. At least one of the two has to be enabled to submit, but they're otherwise independent.",
    },
    {
      question: "Can a fade prevent clicks and pops?",
      answer:
        "It addresses the most common cause: a hard cut at a point where the waveform isn't at zero, which produces a sudden jump in amplitude your speakers reproduce as a click. A fade ramps the volume down to (or up from) zero instead, removing that jump. It won't fix clicks caused by something else, like a corrupted file or a bad recording.",
    },
    {
      question: "How long should a fade be?",
      answer: `It depends on the use. A loop point usually wants a very short fade, since anything long enough to be noticeable also changes how the loop sounds on repeat. A podcast outro or the end of a voice recording can take a longer, more deliberate fade without feeling abrupt. Up to ${MAX_FADE_SECONDS} seconds is available for either fade.`,
    },
    {
      /*
        FadeForm clamps each fade against the track's own length — two fades
        can never overlap past the end of the file — so the ceiling on a short
        clip is the clip, not the 30 seconds the page advertises. Someone with
        a 20-second sample otherwise reads "up to 30 seconds" and finds the
        handle refuses to go there.
      */
      question: `Why won't my fade go to ${MAX_FADE_SECONDS} seconds?`,
      answer: `Because the clip is shorter than that, or the other fade is using the room. Each fade is capped at ${MAX_FADE_SECONDS} seconds OR whatever the track's length leaves after the other one — a 20-second clip can't hold two 15-second fades, so the handles stop where they'd collide. The limit you hit on a short file is the file, not the tool.`,
    },
    {
      question: "What's the difference between a fade and a volume adjustment?",
      answer:
        "A volume adjustment changes the loudness of the whole file by a fixed amount. A fade changes loudness progressively, over a duration you set, specifically at the start and/or end — the rest of the file is untouched either way.",
    },
    {
      question: "What's the difference between a fade and trimming?",
      answer:
        "Trimming cuts a file down to a specific start and end point, removing everything outside that range. A fade doesn't remove any audio — it smooths the volume at whatever start and end points you already have.",
    },
    {
      question: "Does fading reduce audio quality?",
      answer:
        "No — a fade only adjusts the volume envelope at the start and/or end of the file. The output keeps the same format as the file you uploaded.",
    },
    {
      question: "Will this change my file format?",
      answer: "No — the output keeps the same format as the file you uploaded.",
    },
    {
      question: "What audio formats are supported?",
      answer: `${formatList}.`,
    },
    {
      question: "Is there a file size or length limit?",
      answer:
        durationCap === null
          ? `Yes, ${limits.maxUploadMb}MB per upload, with no length limit.`
          : `Yes — ${limits.maxUploadMb}MB per upload, and up to ${durationLabel(durationCap)} of audio.`,
    },
    {
      question: "Can I trim my file first and then add a fade?",
      answer:
        "Yes — trim it down with the Audio Trimmer first, then run the result through this tool to add a fade to the trimmed clip.",
      answerNode: (
        <>
          Yes — trim it down with the{" "}
          <Link href="/trim" className="text-amber-400 hover:underline">
            Audio Trimmer
          </Link>{" "}
          first, then run the result through this tool to add a fade to the
          trimmed clip.
        </>
      ),
    },
    {
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: "Is this really free?",
      answer: "Yes — completely free, no sign-up, no watermark on the output.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Fade In/Out" }]} />
        }
        title="Free Audio Fade In &amp; Fade Out"
        lede="Add a smooth fade in and/or fade out to any audio file, free, no sign-up, no watermark."
        tool={<FadeForm />}
      >
        <FeatureStrip
          features={[
            { title: "Independent fades", desc: "Fade in and fade out lengths set separately." },
            {
              title: `Up to ${MAX_FADE_SECONDS}s each`,
              desc: "Plenty of range for a gentle or dramatic fade.",
            },
            {
              title: "No sign-up",
              desc:
                durationCap === null
                  ? `No account, no email, no watermark. Up to ${limits.maxUploadMb}MB per file.`
                  : `No account, no email, no watermark. Up to ${limits.maxUploadMb}MB and ${durationLabel(durationCap)}.`,
            },
          ]}
        />

        <ToolSection id="what-is-a-fade" title="What is an audio fade?">
          <p>
            An audio fade is a gradual change in volume over a short span,
            rather than an instant jump from silence to full level or back.
            Instead of a track starting or stopping abruptly, the volume ramps
            up or down over a duration you choose. It&apos;s a small edit, but it
            shows up constantly across music, podcasts, voice recordings, and
            samples — anywhere a clip starts or ends somewhere other than a
            natural pause.
          </p>
        </ToolSection>

        <ToolSection id="in-vs-out" title="Fade in vs. fade out" bleed>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">
                    <span className="sr-only">Comparison</span>
                  </th>
                  <th className="px-4 py-3 font-semibold">Fade In</th>
                  <th className="px-4 py-3 font-semibold">Fade Out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Direction</td>
                  <td className="px-4 py-3">Silence → full volume</td>
                  <td className="px-4 py-3">Full volume → silence</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Applied at</td>
                  <td className="px-4 py-3">Start of the file</td>
                  <td className="px-4 py-3">End of the file</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Typical use</td>
                  <td className="px-4 py-3">Easing into a track that begins mid-waveform</td>
                  <td className="px-4 py-3">Smoothing a cut point at the end of a clip</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Prose className="mt-5">
            <p>
              They&apos;re independent settings — plenty of clips only need one.
              A recording that already starts cleanly from silence might only
              need a fade out where it was trimmed; a clip pulled from the middle
              of a longer file might want both. The one place they interact is
              length: the two together can&apos;t exceed the track, so on a short
              clip each handle stops before it would collide with the other.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="how-to" title="How to fade audio online">
          <ol>
            <li>Upload an {formatList} file.</li>
            <li>Turn on fade in and/or fade out and set how many seconds each should last.</li>
            <li>Download the result.</li>
          </ol>
        </ToolSection>

        <ToolSection id="how-long" title="How long should an audio fade be?">
          <p>
            It depends on what the fade is covering for. A loop point generally
            wants a very short fade — anything long enough to be noticeable also
            changes how the loop sounds each time it repeats. A podcast outro or
            the end of a voice recording can usually take a longer, more
            deliberate fade without feeling abrupt. The general trade-off: too
            short and a loud, sudden waveform might still produce an audible
            click; too long and the fade itself becomes an obvious part of the
            audio rather than an invisible fix. Either fade can run up to{" "}
            {MAX_FADE_SECONDS} seconds here, or as long as the track leaves once
            the other fade has its share.
          </p>
        </ToolSection>

        <ToolSection id="clicks" title="Why audio clicks at hard cuts">
          <p>
            When a clip is cut at a point where the waveform isn&apos;t sitting
            at zero, the sudden jump in amplitude produces an audible click or
            pop right at the cut. A fade ramps the volume to (or from) zero over
            a short span instead of jumping instantly, which removes that
            discontinuity. This is why trimmed clips, exported loops, and podcast
            intros/outros almost always use one at the edges.
          </p>
          <p>
            Want the fuller explanation of why this happens and how to judge fade
            length for different situations?{" "}
            <Link href="/guides/why-audio-needs-a-fade-in-out">
              Read Why Trimmed Audio Clips Need a Fade In and Out
            </Link>
            .
          </p>
        </ToolSection>

        <ToolSection id="common-uses" title="Common uses">
          <p>
            Smoothing the start and end of a trimmed clip, giving a podcast intro
            or outro a professional finish, avoiding a click at a loop point in a
            sample, softening the end of a ringtone or notification sound, easing
            into or out of a voice-over recording, and cleaning up the audio track
            under a video transition.
          </p>
          <p>
            Making a ringtone specifically? The{" "}
            <Link href="/ringtone-maker">Ringtone Maker</Link> trims a clip to
            length in one step — fade it afterward here if you want a softer start
            or end.
          </p>
        </ToolSection>

        <ToolSection id="fade-vs-volume" title="Fade vs. volume adjustment">
          <p>
            A volume adjustment changes the loudness of the entire file by a fixed
            amount — the whole track gets louder or quieter, uniformly. A fade
            changes loudness progressively, over a duration you choose,
            specifically at the start and/or end of the file. If what you actually
            need is the whole track louder or quieter throughout, the{" "}
            <Link href="/volume">Volume Booster</Link> is the right tool instead.
          </p>
        </ToolSection>

        <ToolSection id="fade-vs-trim" title="Fade vs. trim">
          <p>
            Trimming cuts a file down to a specific start and end point, removing
            everything outside that range. Fading doesn&apos;t remove any audio —
            it smooths the volume at whatever start and end points already exist.
            The two pair naturally: trim a clip out of a longer recording with the{" "}
            <Link href="/trim">Audio Trimmer</Link> first, then run the trimmed
            result through this tool if the new cut points need a fade to sound
            clean.
          </p>
        </ToolSection>

        <ToolSection id="formats" title="Supported formats" bleed>
          {/* Rendered from the backend's allowed_audio_formats rather than a
              hand-written array — the mechanism that left AIFF off /stems. */}
          <div className="flex flex-wrap gap-2">
            {formats.map((format) => (
              <span
                key={format}
                className="rounded-lg border border-graphite-700 bg-graphite-850 px-3 py-1.5 font-mono text-sm font-semibold text-amber-400"
              >
                {format}
              </span>
            ))}
          </div>
          <Prose className="mt-5">
            <p>
              Upload any of the formats above, up to {limits.maxUploadMb}MB per
              file
              {durationCap !== null ? ` and ${durationLabel(durationCap)} long` : ""}.
              The output keeps the same format you uploaded.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="quality" title="Does fading affect audio quality?">
          <p>
            No — a fade only adjusts the volume envelope at the start and/or end
            of the file; it doesn&apos;t alter the rest of the content, and the
            output keeps the same format as what you uploaded rather than
            converting to something else.
          </p>
        </ToolSection>

        <RelatedToolsGrid tools={relatedTools} />

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}