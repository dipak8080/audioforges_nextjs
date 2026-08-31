import type { Metadata } from "next";
import Link from "next/link";
import { TranscriptionForm } from "@/components/converter/TranscriptionForm";
import { TranscriptionModeTabs } from "@/components/converter/TranscriptionModeTabs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Prose } from "@/components/ui/Prose";
import { FAQSection } from "@/components/faq/FAQSection";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { TRANSCRIPTION_MODEL, getTranscriptionLanguages } from "@/lib/api/transcription";
import { ogForTool } from "@/lib/og";
import {
  getLimits,
  windowFor,
  rateLimitLabel,
  durationLabel,
  retentionSentences,
} from "@/lib/api/limits";

/**
 * NOTE ON THE CAP THIS PAGE USES: max_video_transcribe_mb (100), NOT
 * max_video_upload_mb (200) which /video-to-audio uses. Two video routes, two
 * caps, and showing one figure on both pages is wrong by double on one.
 */

// `: string` is load-bearing — without it TS narrows both to literal types and
// flags the LAST_VERIFIED !== PUBLISHED check below as impossible.
const PUBLISHED: string = "2026-08-20";
/**
 * Bump ONLY after actually re-checking the limits, the model name and the
 * import paths in SUBTITLE_TARGETS. The footer publishes this as a promise,
 * and a date that outruns the check is worse than no date — it was five days
 * stale when the rate limit moved beneath it.
 */
const LAST_VERIFIED: string = "2026-08-30";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/*
  TARGET TERMS — reference only, deliberately NOT emitted as a meta tag.
  Google has ignored <meta name="keywords"> since 2009 and Bing treats it as a
  spam signal. The list records what this page is written to rank for.

    transcribe video to text free · video to text · video to text converter
    mp4 to text · convert video to text free · video transcription free
    mp4 to srt · generate subtitles from video free
    free subtitle generator no watermark · video to subtitles
    transcribe video free no sign up · mov to text
    video transcription           ← from the gap run
    transcription video to text   ← from the gap run

  Gap run against youtubetotranscript.com, tactiq.io, notegpt.io, downsub.com
  and kome.ai.
*/

/**
 * THE TARGET IS "transcribe video to text free", NOT "video to text".
 *
 * Both carry >1000 volume. The bare head term is Hard and the SERP is DR 70+
 * SaaS; a page with no referring domains does not take it, and writing the
 * title for it means writing for a query we lose. The "transcribe ... free"
 * variant is the one cell in that keyword table marked Easy, and it's closer
 * to the intent this page serves — someone who wants the file, free, now.
 *
 * Caveat worth holding: Ahrefs derives KD from the backlink profiles of the
 * current top 10, and when those are subpages of large domains the individual
 * pages carry few links — so KD reads Easy while domain authority still
 * decides the result. Easy means winnable, not free.
 *
 * "video to text converter" survives as the JSON-LD name, in the opening
 * paragraph, and in an H2. Losing an exact-match H1 for a term we can't win
 * costs nothing; Google matches the entity regardless. Same story for "video
 * transcription" (bare noun phrase, KD 27) — carried in the opening paragraph
 * rather than spending title real estate.
 */
const PAGE_TITLE = "Transcribe Video to Text Free, MP4 to SRT";

/**
 * The description needs the limits, and `metadata` is evaluated at module
 * scope where getLimits() can't be awaited. It reads the same constants the
 * fallback in lib/api/limits.ts uses, so head copy and body copy can only
 * disagree if the backend moved AND the fallback wasn't updated.
 */
const DESCRIPTION_MINUTES = 20;
const DESCRIPTION_MB = 100;
const PAGE_DESCRIPTION = `Transcribe MP4, MOV, MKV or WEBM to text free — no account, no watermark. Export SRT or VTT subtitles. Videos up to ${DESCRIPTION_MINUTES} minutes and ${DESCRIPTION_MB}MB.`;

const OG_IMAGE = ogForTool("video-to-text", "Transcribe video to text free");

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  // `keywords` intentionally absent — see the term list above.
  alternates: { canonical: `${SITE_URL}/video-to-text` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/video-to-text`,
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

// BreadcrumbList comes from <Breadcrumb />; FAQPage from <FAQSection />.

/**
 * THE LINKABLE ASSET.
 *
 * Where the SRT actually goes afterwards is the half of the job every subtitle
 * page skips, and the half people get stuck on. It's also the only thing here
 * someone would link to without being asked, so it's worth being the most
 * complete version of this table on the web rather than a five-row gesture.
 *
 * Verify these paths when you touch LAST_VERIFIED — menu labels move, and a
 * wrong path here is worse than no table.
 */
const SUBTITLE_TARGETS = [
  { app: "YouTube", how: "Studio → Subtitles → Add → Upload file → With timing", format: "SRT" },
  { app: "Premiere Pro", how: "File → Import, then drag the caption track onto the timeline", format: "SRT" },
  { app: "DaVinci Resolve", how: "Right-click the media pool → Import Subtitle", format: "SRT" },
  { app: "Final Cut Pro", how: "File → Import → Captions", format: "SRT" },
  { app: "CapCut", how: "Captions → Import captions", format: "SRT" },
  { app: "Kdenlive", how: "Project → Subtitles → Import Subtitle File", format: "SRT" },
  { app: "Vimeo", how: "Video settings → Distribution → Subtitles → Upload", format: "SRT or VTT" },
  {
    app: "Zoom recordings",
    how: "Upload alongside the cloud recording in your account's recording settings",
    format: "VTT",
  },
  { app: "VLC", how: "Keep the .srt next to the video with the same filename", format: "SRT" },
  {
    app: "Website video",
    how: '<track kind="captions" src="..."> inside your <video> element',
    format: "VTT",
  },
];

/**
 * FFMPEG, WHICH NO COMPETITOR WILL EVER PUBLISH.
 *
 * Every tool on this SERP sells the burned-in captioned video as its paid
 * feature, so none of them will tell you it's two lines of ffmpeg. That
 * asymmetry is the whole reason this section is worth having: genuinely
 * useful, the kind of thing developers cite and link, and it costs nothing
 * here because burned-in video was never the product.
 *
 * Both commands verified against ffmpeg 6.x.
 */
const FFMPEG_RECIPES = [
  {
    goal: "Burn the captions into the picture",
    when: "Instagram, TikTok, LinkedIn — anywhere captions can't be a separate file and autoplay is muted.",
    command: "ffmpeg -i video.mp4 -vf subtitles=captions.srt -c:a copy output.mp4",
    note: "Re-encodes the video, so it takes a while and costs a little quality. Unavoidable — the text becomes pixels.",
  },
  {
    goal: "Attach them as a track you can switch off",
    when: "Anywhere the player supports subtitle tracks. Better than burning whenever it's an option.",
    command: "ffmpeg -i video.mp4 -i captions.srt -c copy -c:s mov_text output.mp4",
    note: "Copies both streams untouched, so it finishes in seconds and loses nothing. Use mov_text for MP4; for MKV, use srt.",
  },
];

export default async function VideoToTextPage() {
  const relatedTools = getRelatedTools("video-to-text", 4);

  const limits = await getLimits();

  /*
    Fetched here so the ~99-language dropdown is populated on first paint.
    TranscriptionForm falls back to fetching it client-side when omitted —
    which works, but flashes a list containing only "Detect automatically".

    .catch(() => null) is load-bearing: without it a backend blip would fail
    the whole page render, when the client-side fetch already handles that.
  */
  const languages = await getTranscriptionLanguages().catch(() => null);

  /*
    THE RIGHT CAP FOR THIS ROUTE — 100, not the 200 on /video-to-audio. The
    lower figure is deliberate: a 200MB video is almost certainly past the
    duration cap, so accepting the upload only to reject it wastes the whole
    transfer.
  */
  const videoMb = limits.maxVideoTranscribeMb;
  const maxMinutesLabel = durationLabel(limits.featureDurations.transcription);

  /*
    Derived end to end, with no hand-written third number in the chain. The
    fallback used to read "2 per 5 minutes" — the figure this route carried
    before 2026-08-26 — so the branch that only fires when something is already
    wrong printed a limit twelve times too generous. A fallback is the branch
    nobody tests, which is what makes a wrong one worse than none.
  */
  const rateLimit = rateLimitLabel(
    limits.rateLimits.video_to_text ?? 2,
    windowFor(limits, "video_to_text")
  );

  const videoFormats = limits.allowedVideoFormats.map((f) => f.toUpperCase());
  const videoFormatList = videoFormats.join(", ").replace(/, ([^,]*)$/, " and $1");

  /*
    The `text` shape, which nothing else on the site uses. The result is inline
    in the job record rather than a file on disk, so the sentence is different
    in kind — not "your file is available for an hour".
  */
  const retention = retentionSentences(limits.retention.transcription);

  // No aggregateRating. Every competitor on this SERP carries one and a good
  // share are invented; the argument this page makes about export paywalls
  // doesn't survive faking a review count.
  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Video to Text Converter",
    alternateName: [
      "Transcribe Video to Text",
      "MP4 to Text",
      "Video to SRT",
      "Free Subtitle Generator",
    ],
    url: `${SITE_URL}/video-to-text`,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript.",
    dateModified: LAST_VERIFIED,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      "Transcribe MP4, MOV, MKV, AVI, WEBM and more",
      "Export SRT or VTT subtitle files with no watermark",
      `Runs ${TRANSCRIPTION_MODEL} on a GPU`,
      "Automatic language detection, or set the language yourself",
      "Translate non-English speech to English in the same pass",
      "Timestamped segments",
      "No account or email required",
      "No export paywall",
      `Videos up to ${maxMinutesLabel} and ${videoMb}MB`,
    ],
  };

  /**
   * Every answer opens with the answer — extractive summarisers take the first
   * clause, and AI panels are where a page with no backlinks gets its first
   * impressions. The first three are phrased against real question queries
   * rather than invented ones.
   */
  const faqs = [
    {
      question: "How do I transcribe a video to text for free?",
      answer: `Upload the video above, wait, and download the transcript. No account, no email, no card. It accepts MP4, MOV, MKV, AVI and WEBM up to ${videoMb}MB and ${maxMinutesLabel}, and exports plain text plus SRT and VTT subtitle files with nothing held back.`,
    },
    {
      question: "Do I get a video with subtitles burned in?",
      answer:
        "No — you get a transcript plus an SRT or VTT file, not a re-encoded video. Load that file into your editor or upload it alongside the video. Keeping subtitles as a separate file is usually better anyway: viewers can turn them off, search engines can read them, and you can fix a typo without re-exporting. If you do need them burned in, there's an ffmpeg command above that does it in one line.",
    },
    {
      question: "How long does it take to transcribe a video?",
      answer:
        "Usually under a minute once the server is warm. It spins down when idle, so the first run after a quiet period spends about a minute starting up — which means a one-minute clip and a fifteen-minute one often take roughly the same wall time. Upload time is on top of that and depends on your connection.",
    },
    {
      question: "What video formats can I upload?",
      // From allowed_video_formats rather than a typed list.
      answer: `${videoFormatList}, up to ${videoMb}MB and ${maxMinutesLabel}. The file needs an audio track — a silent screen recording has nothing to transcribe.`,
    },
    {
      question: "Is the subtitle export really free?",
      answer: `Yes. SRT and VTT both download without an account, without a watermark, and without a paid tier — export is the feature most free subtitle tools hold back. The limits are ${maxMinutesLabel} per video and ${rateLimit}.`,
    },
    {
      question: "Do I need to extract the audio first?",
      answer:
        "No — upload the video directly. If you want the audio file itself as well, the Video to Audio converter does that separately.",
    },
    {
      question: `My file is over ${videoMb}MB. What can I do?`,
      answer:
        "Extract the audio first with the Video to Audio converter and upload that instead — an audio-only file is a fraction of the size, and the audio is all that gets transcribed anyway.",
    },
    {
      question: "Can I make English subtitles for a video in another language?",
      answer:
        "Yes — choose English output and it translates as it transcribes, in one pass. English is the only translation target, so for any other language you'd translate the finished SRT separately.",
    },
    {
      /*
        The one retention shape nothing else on the site uses. The transcript
        lives in the job record as text rather than as a file on disk, so the
        usual "your file is available for an hour" sentence would describe
        something that doesn't exist.
      */
      question: "Are my uploaded videos kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: "What model does this use, and how accurate is it?",
      answer: `${TRANSCRIPTION_MODEL}, running on a GPU. Accuracy depends far more on the recording than on the tool — a lapel mic in a quiet room comes back near-perfect, a phone across a meeting room won't. We don't publish an accuracy percentage, because a single number across every language, accent and recording condition wouldn't mean anything, and nobody publishing one shows their methodology.`,
    },
    {
      question: "SRT or VTT — which one do I need?",
      answer:
        "SRT for video editors, YouTube, and almost every upload form. VTT for HTML5 video on your own site, via a track element. The only structural difference is the header line and a comma versus a period before the milliseconds.",
    },
    {
      question: "My editor accepted the file but shows no captions. Why?",
      answer:
        "Usually the wrong format for that target — VTT where SRT was expected, or the reverse. The two look nearly identical in a text editor, and most players fail silently rather than warning you. Try the other export.",
    },
    {
      question: "Can I edit the subtitles before using them?",
      answer:
        "Not here — there's no editor. SRT and VTT are plain text, though, so any text editor will do for a quick fix, and every video editor listed above lets you adjust timing and wording after importing.",
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
      />

      <main id="main" className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:pt-14">
        <Breadcrumb
          items={[{ name: "Tools", href: "/tools" }, { name: "Video to Text" }]}
          className="mb-8"
        />

        {/* The opening paragraph carries the bare entity "video transcription"
            (KD 27, DR 70+ SaaS on the SERP — not a title target for a new
            domain) so it's matched without spending title or H1 real estate. */}
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
            No account · No watermark · Free SRT
          </p>
          <h1 className="measure-wide mt-5 text-4xl font-bold leading-[1.04] tracking-[-0.025em] text-text-primary sm:text-5xl">
            Transcribe video to text free
          </h1>
          <p className="measure-wide mt-4 text-lg leading-relaxed text-text-muted sm:text-xl">
            A video to text converter that gives you the file — free video
            transcription with nothing held behind a sign-up.
          </p>
        </header>

        <div className="mt-7">
          <TranscriptionModeTabs active="/video-to-text" />
        </div>

        <div className="mt-5">
          <TranscriptionForm mode="video" languages={languages} />
        </div>

        {/* THE WEDGE ON THIS PAGE. Most traffic here wants subtitles, and
            export is precisely what the freemium incumbents hold back — you
            can generate captions on several well-known sites and then find the
            download behind a plan. */}
        <section className="mt-16 border-t border-graphite-800 py-14">
          <SectionHeading
            eyebrow="The catch elsewhere"
            title="Generating captions is free almost everywhere. Downloading them isn't."
            description="The usual pattern: you upload, you wait, you see the captions, and then the export button asks for an account or a plan."
          />

          <div className="mt-8 overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    <span className="sr-only">Comparison</span>
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">Typically</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Here</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">SRT / VTT export</td>
                  <td className="px-4 py-3">Behind a plan or an account</td>
                  <td className="px-4 py-3 text-text-primary">Free, no account</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Watermark</td>
                  <td className="px-4 py-3">On the free tier&apos;s video output</td>
                  <td className="px-4 py-3 text-text-primary">No video output at all</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Free allowance</td>
                  <td className="px-4 py-3">Minutes that run out</td>
                  <td className="px-4 py-3 text-text-primary">No total cap</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Sign-up</td>
                  <td className="px-4 py-3">Required to see the result</td>
                  <td className="px-4 py-3 text-text-primary">Never</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">The real limit</td>
                  <td className="px-4 py-3">Discovered when you hit it</td>
                  <td className="px-4 py-3 text-text-primary">
                    {maxMinutesLabel} and {videoMb}MB per video, {rateLimit}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <Prose className="mt-6">
            <p>
              The trade is honest in the other direction too: those tools give you
              an editor and a captioned video file. This gives you the transcript
              and the subtitle file, and stops there. If you want styled captions
              burned into the frame, an editor is the right tool — but you can
              still generate the SRT here and import it, which is free either way.
            </p>
            <p>
              The export paywall is one of six patterns worth recognising before
              you upload anywhere —{" "}
              <Link href="/free-transcription-no-sign-up" prefetch={false}>
                free transcription without signing up
              </Link>
              .
            </p>
          </Prose>
        </section>

        {/* Where the file actually goes. Most subtitle pages end at the
            download and leave people stuck on the half of the job that isn't
            obvious. Strongest candidate on the site for earning a link without
            asking for one. */}
        <section className="border-t border-graphite-800 py-14">
          <SectionHeading
            eyebrow="After the download"
            title="Where the subtitle file goes"
            description="An SRT on its own does nothing. Here's the import path in the places it usually ends up."
          />

          <div className="mt-8 overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Where</th>
                  <th scope="col" className="px-4 py-3 font-semibold">How</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Use</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                {SUBTITLE_TARGETS.map((target) => (
                  <tr key={target.app}>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-text-primary">
                      {target.app}
                    </td>
                    <td className="px-4 py-3">{target.how}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono">{target.format}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Prose className="mt-6">
            <p>
              Uploading captions to YouTube rather than relying on its
              auto-captions is worth the extra minute: the uploaded file is what
              gets indexed, and it doesn&apos;t inherit auto-caption mistakes on
              names, jargon or accented speech.
            </p>
          </Prose>
        </section>

        {/* The section a competitor structurally cannot write, because burning
            captions into video is what they charge for. */}
        <section className="border-t border-graphite-800 py-14">
          <SectionHeading
            eyebrow="If you do need it in the video"
            title="Two lines of ffmpeg"
            description="Burning captions into the picture is the paid feature almost everywhere. It's also one command. Install ffmpeg, put the video and the .srt in the same folder, and run whichever of these matches what you need."
          />

          <div className="mt-8 space-y-6">
            {FFMPEG_RECIPES.map((recipe) => (
              <div key={recipe.goal} className="measure border-t border-graphite-800 pt-4">
                <h3 className="font-semibold text-text-primary">{recipe.goal}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{recipe.when}</p>
                <pre className="scrollbar-thin mt-3 overflow-x-auto rounded-lg border border-graphite-700 bg-graphite-850 p-3">
                  <code className="font-mono text-[13px] text-text-primary">{recipe.command}</code>
                </pre>
                <p className="mt-2 text-sm leading-relaxed text-text-subtle">{recipe.note}</p>
              </div>
            ))}
          </div>

          <Prose className="mt-6">
            <p>
              Attach the track rather than burning it whenever the platform
              allows: it finishes in seconds instead of minutes, costs no quality,
              stays editable, and viewers can switch it off. Burn it in only where
              captions can&apos;t be a separate file — which in practice means
              social video, where autoplay is muted and the captions are the
              point.
            </p>
          </Prose>
        </section>

        <section className="border-t border-graphite-800 py-14">
          <SectionHeading eyebrow="How it works" title="Upload, wait, export" />

          <ol className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Upload the video",
                body: `MP4, MOV, MKV, AVI or WEBM, up to ${videoMb}MB and ${maxMinutesLabel}. No audio extraction first.`,
              },
              {
                step: "02",
                title: "Set the language",
                body: "Or leave it on auto-detect. Pick English output to subtitle a foreign-language video.",
              },
              {
                step: "03",
                title: "Export SRT or VTT",
                body: "Plus plain text if you want the words on their own. Nothing is held back.",
              },
            ].map((item) => (
              <li key={item.step} className="border-t border-graphite-800 pt-4">
                <p className="font-mono text-xs text-amber-500">{item.step}</p>
                <h3 className="mt-2 font-semibold text-text-primary">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{item.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-graphite-800 py-14">
          <SectionHeading
            eyebrow="Honest limits"
            title="What this won't do"
            description="Worth knowing before you upload rather than after."
          />

          {/* Was a <ul> of bold lead-ins with hand-drawn top borders —
              term/explanation pairs, so the dl renders them properly. */}
          <Prose className="mt-8">
            <dl>
              <dt>No captioned video comes back</dt>
              <dd>
                You get text and a subtitle file. Burning captions into the frame
                needs a video editor, or the ffmpeg command above.
              </dd>

              <dt>No subtitle editor</dt>
              <dd>
                No styling, no repositioning, no line-break control. SRT is plain
                text, so small fixes are easy in any text editor.
              </dd>

              <dt>No speaker labels</dt>
              <dd>A two-person interview comes back as continuous captions.</dd>

              <dt>
                {videoMb}MB and {maxMinutesLabel}
              </dt>
              <dd>
                Over either, extract the audio first with{" "}
                <Link href="/video-to-audio" prefetch={false}>
                  Video to Audio
                </Link>{" "}
                — audio-only is far smaller, and it&apos;s all that gets
                transcribed anyway.
              </dd>
            </dl>

            <p>
              For what actually degrades a transcript, and the full
              SRT-versus-VTT breakdown,{" "}
              <Link href="/guides/transcribing-audio-accurately" prefetch={false}>
                read the transcription accuracy guide
              </Link>
              .
            </p>
          </Prose>
        </section>

        <div className="border-t border-graphite-800 py-14">
          <RelatedToolsGrid tools={relatedTools} />
        </div>

        <div className="border-t border-graphite-800 py-14">
          <FAQSection eyebrow="Questions" faqs={faqs} />
        </div>

        <p className="border-t border-graphite-800 pt-6 font-mono text-xs text-text-subtle">
          Published <time dateTime={PUBLISHED}>{formatDate(PUBLISHED)}</time>
          {LAST_VERIFIED !== PUBLISHED && (
            <>
              {" · "}limits, model and import paths re-checked{" "}
              <time dateTime={LAST_VERIFIED}>{formatDate(LAST_VERIFIED)}</time>
            </>
          )}
          {". "}
          {TRANSCRIPTION_MODEL} · {maxMinutesLabel} and {videoMb}MB per video · {rateLimit}.
        </p>
      </main>
    </>
  );
}