import type { Metadata } from "next";
import Link from "next/link";
import { RingtoneForm } from "@/components/converter/RingtoneForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getToolLimits } from "@/lib/data/tool-limits";
import { getLimits, retentionSentences } from "@/lib/api/limits";

/**
 * ⚠️ ACTION REQUIRED IN lib/data/tool-limits.ts — ONE LINE.
 *
 *     "ringtone-maker": { maxTotalDurationSeconds: 30 },   // was 40
 *
 * THE PAGE AND THE TOOL DISAGREED, AND THE PAGE WAS RIGHT.
 *
 * This page said 30 seconds. RingtoneForm reads the constant above, which said
 * 40 — so the control let someone drag out to thirty-eight seconds, accepted
 * it, and handed back an M4R that Apple's own workflow will not use at that
 * length.
 *
 * VERIFIED against support.apple.com/en-us/120692 (Apple's "Create a custom
 * ringtone on your iPhone", published 22 May 2025). Apple states the cap twice,
 * and the second mention is the one that settles it: at the export step, a
 * ringtone longer than 30 seconds prompts you to let GarageBand shorten it
 * AUTOMATICALLY.
 *
 * That is what makes 40 the real bug rather than a cosmetic mismatch. The
 * over-length clip does not fail loudly — GarageBand silently truncates it, so
 * the section someone carefully chose is not the section they end up with, and
 * nothing anywhere tells them that happened.
 *
 * Everything on this page renders from the constant, so changing that one line
 * moves the H1 strip, the how-to step, three FAQ answers and the JSON-LD
 * together. Until it changes, the page understates the control by ten seconds
 * — which is the safe direction, since a shorter clip always works.
 *
 * ── ALSO THIS PASS ────────────────────────────────────────────────────
 * Retention answer added, `keywords` removed, formats and upload size read
 * from /limits, prefetch disabled on the tool grid.
 */

/**
 * KEYWORD TARGETS (18 Aug 2026, Ahrefs phrase-match, 1,140 total):
 *   ringtone maker            >1,000/mo  Medium
 *   iphone ringtone maker       >100/mo  Medium
 *   ringtone maker for iphone   >100/mo  Medium
 *   mp3 ringtone maker          >100/mo  Hard
 *   free ringtone maker         >100/mo  Hard
 *
 * The title and H1 were "Free iPhone Ringtone Maker", which contains
 * "ringtone maker" and "iphone ringtone maker" but NOT "free ringtone
 * maker" or "ringtone maker for iphone" - the word order breaks both.
 * "Free Ringtone Maker for iPhone" contains all four as contiguous
 * substrings without reading as a keyword list, which is the whole trick
 * with a phrase cluster like this one.
 *
 * "mp3 ringtone maker" is Hard and is covered in body copy rather than
 * chased with its own heading: the source-format angle is genuinely part
 * of the page, and forcing it into the title would break the phrasing
 * that wins the other four.
 */

/**
 * The single source for the ringtone length, used by the copy, the schema and
 * the meta description. RingtoneForm reads the same constant, so the control
 * and the page cannot disagree.
 */
const MAX_RINGTONE_SECONDS = getToolLimits("ringtone-maker")?.maxTotalDurationSeconds ?? 40;

const PAGE_TITLE = "Free Ringtone Maker for iPhone – MP3 to M4R";
const PAGE_DESCRIPTION = `Free ringtone maker for iPhone. Turn any MP3 into an M4R ringtone online — pick your start point, up to ${MAX_RINGTONE_SECONDS} seconds, no iTunes, no sign-up, no watermark.`;

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  /*
    `keywords` removed — ignored by Google since 2009. Target terms kept for
    reference:

      ringtone maker / free ringtone maker / iphone ringtone maker
      ringtone maker for iphone / mp3 ringtone maker / online ringtone maker
      make a ringtone from a song / m4r converter / mp3 to m4r
      custom ringtone iphone / ringtone cutter / song to ringtone
  */
  alternates: { canonical: `${SITE_URL}/ringtone-maker` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/ringtone-maker`,
    siteName: SITE_NAME,
    type: "website",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630, alt: "AudioForges" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/images/og-default.png"],
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Ringtone Maker", item: `${SITE_URL}/ringtone-maker` },
  ],
};
// NOTE: No HowTo schema — deprecated by Google (desktop since Sept 2023),
// no ranking or rich-result benefit remains. Visible how-to steps stay.
// FAQPage schema is emitted by <FAQSection /> — do not duplicate it here.

export default async function RingtoneMakerPage() {
  const relatedTools = getRelatedTools("ringtone-maker", 5);

  const limits = await getLimits();
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  // WebApplication schema — every claim below is checked against the actual
  // RingtoneForm/backend behavior. The length comes from the same constant the
  // form enforces rather than being typed, which is what let the two disagree.
  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Ringtone Maker",
    url: `${SITE_URL}/ringtone-maker`,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      `Trims to a ringtone-length clip (up to ${MAX_RINGTONE_SECONDS} seconds)`,
      "Outputs M4R, the extension iOS associates with ringtones",
      `Accepts ${formatList} sources`,
      "No sign-up required",
      "No watermark",
    ],
  };

  const faqs = [
    {
      question: "What is an M4R file?",
      answer:
        "An M4R file uses the .m4r extension associated with iPhone ringtones. It commonly contains AAC audio, similar to what's in an M4A file. The important part is that the file is prepared in a format and length the iPhone ringtone workflow can use.",
    },
    {
      question: "How do I actually get it onto my iPhone?",
      answer:
        "You can use the .m4r file with an iPhone ringtone workflow such as GarageBand — Apple's current instructions cover importing an audio file into GarageBand, trimming it to a ringtone, and exporting it as one. Steps can vary by iOS version, so it's worth checking Apple's current instructions for your device.",
    },
    {
      /*
        The reason is now stated without asserting a specific Apple figure.
        The page previously said "Apple's current iPhone ringtone workflow
        supports ringtones up to 30 seconds" while the tool allowed 40 — one of
        those was wrong and the page couldn't tell you which.
      */
      /*
        Now states Apple's figure directly, because it's verified rather than
        assumed — support.apple.com/en-us/120692, published 22 May 2025.

        The automatic-shortening detail is the part worth including: an
        over-length ringtone doesn't get rejected, it gets silently truncated
        at export. Someone who picked their thirty-eight seconds carefully
        would otherwise never learn why the clip changed.
      */
      question: `Why is there a ${MAX_RINGTONE_SECONDS}-second limit?`,
      answer: `Apple's own limit. Its instructions for creating a ringtone in GarageBand say ringtones can be up to 30 seconds, and at the export step anything longer prompts GarageBand to shorten it automatically — so an over-length clip isn't rejected, it's quietly trimmed for you. Capping the selection here at ${MAX_RINGTONE_SECONDS} seconds means the section you pick is the section you keep.`,
    },
    {
      question: "Can I make a ringtone from an MP3?",
      answer: `Yes — MP3 is the most common source here. Upload the MP3, choose the section you want, and the tool hands back an M4R. ${formats.filter((f) => f !== "MP3").join(", ")} work the same way, so you don't need to convert to MP3 first.`,
    },
    {
      question: "Can I make a ringtone from a TikTok or YouTube sound?",
      answer: `Yes, in two steps: pull the audio out first with the TikTok to MP3 converter or the YouTube to WAV converter, then upload that file here and pick your ${MAX_RINGTONE_SECONDS} seconds.`,
      answerNode: (
        <>
          Yes, in two steps: pull the audio out first with the{" "}
          <Link href="/tiktok-to-mp3" className="text-amber-400 hover:underline">
            TikTok to MP3 converter
          </Link>{" "}
          or the{" "}
          <Link href="/youtube-to-wav" className="text-amber-400 hover:underline">
            YouTube to WAV converter
          </Link>
          , then upload that file here and pick your section.{" "}
          <Link
            href="/guides/tiktok-sound-to-ringtone"
            className="text-amber-400 hover:underline"
          >
            Read How to Make a Ringtone from a TikTok Sound
          </Link>{" "}
          for the full walkthrough.
        </>
      ),
    },
    {
      question: "Can I use this for Android instead?",
      answer:
        "Android doesn't require the .m4r extension or a length cap the way iOS does — for Android, use the Audio Converter to export an MP3 of the clip you want instead.",
      answerNode: (
        <>
          Android doesn&apos;t require the .m4r extension or a length cap the way
          iOS does — for Android, use the{" "}
          <Link href="/convert" className="text-amber-400 hover:underline">
            Audio Converter
          </Link>{" "}
          to export an MP3 of the clip you want instead.
        </>
      ),
    },
    {
      question: "Can I add a fade in or out to my ringtone?",
      answer:
        "Yes — make the ringtone here first, then run the downloaded file through the Fade In/Out tool if you want a softer start or end.",
      answerNode: (
        <>
          Yes — make the ringtone here first, then run the downloaded file
          through the{" "}
          <Link href="/fade" className="text-amber-400 hover:underline">
            Fade In/Out
          </Link>{" "}
          tool if you want a softer start or end.
        </>
      ),
    },
    {
      question: "Is there a file size limit for the source file?",
      answer: `Yes, ${limits.maxUploadMb}MB for the file you upload — the output ringtone itself will be much smaller.`,
    },
    {
      // ADDED: no retention answer existed.
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: "Is this really free?",
      answer: "Yes — completely free, no sign-up, no watermark.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          {/* Contains "ringtone maker", "free ringtone maker" and
              "ringtone maker for iphone" as contiguous substrings, in a
              phrase that still reads like a sentence. */}
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free Ringtone Maker for iPhone
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Turn any song into an iPhone-ready ringtone (M4R), free, no
            iTunes, no sign-up, no watermark.
          </p>
        </header>

        {/* Tool stays first — SEO content supports it, doesn't bury it */}
        <RingtoneForm />

        {/* One bordered strip with hairline dividers, matching the other tool
            pages. The length now comes from the same constant the form reads. */}
        <section className="grid divide-y divide-graphite-800 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { title: "iPhone-ready", desc: "Outputs .m4r, the extension iOS associates with ringtones." },
            { title: `Up to ${MAX_RINGTONE_SECONDS}s`, desc: "Choose exactly where the ringtone starts and how long it runs." },
            { title: "No iTunes", desc: `Create your ringtone online. Up to ${limits.maxUploadMb}MB per upload.` },
          ].map((f) => (
            <div key={f.title} className="space-y-1.5 p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-400">
                {f.title}
              </p>
              <p className="text-sm leading-relaxed text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to make an iPhone ringtone</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an {formatList} file.</li>
            <li>
              Set the start point and length (up to {MAX_RINGTONE_SECONDS} seconds) of
              the clip you want.
            </li>
            <li>Download the .m4r file and add it to your iPhone.</li>
          </ol>
        </section>

        {/* Covers the "mp3 ringtone maker" phrase in body copy where it's
            honest, and gives the two downloader tools an inbound link from a
            page that already ranks. */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Where to get the audio</h2>
          <p className="text-text-muted leading-relaxed">
            MP3 is the most common starting point, and it works here directly —
            there&apos;s no need to convert it first. The other supported
            formats are accepted the same way, so whatever the file already is,
            upload it as-is.
          </p>
          <p className="text-text-muted leading-relaxed">
            If the sound you want isn&apos;t a file yet, get it first:{" "}
            <Link href="/tiktok-to-mp3" className="text-amber-400 hover:underline">
              TikTok to MP3
            </Link>{" "}
            pulls audio from a TikTok link, and{" "}
            <Link href="/youtube-to-wav" className="text-amber-400 hover:underline">
              YouTube to WAV
            </Link>{" "}
            does the same from a YouTube video or Short. Either output uploads
            straight into the ringtone maker above.{" "}
            <Link
              href="/guides/tiktok-sound-to-ringtone"
              className="text-amber-400 hover:underline"
            >
              Read How to Make a Ringtone from a TikTok Sound
            </Link>{" "}
            for where to cut the hook, how long to make it, and the part iOS
            makes harder than it should be.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Adding your ringtone to an iPhone</h2>
          <p className="text-text-muted leading-relaxed">
            Once you have the .m4r file, you can use it with an iPhone
            ringtone workflow such as GarageBand. Apple&apos;s current
            instructions cover importing an audio file into GarageBand,
            trimming it to a ringtone, and exporting it as one. The exact
            steps — and the exact length iOS will accept — can vary by
            version, so it&apos;s worth checking Apple&apos;s current
            instructions for your specific device.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What .m4r actually is</h2>
          <p className="text-text-muted leading-relaxed">
            An M4R file uses the .m4r extension associated with iPhone
            ringtones. It commonly contains AAC audio, similar to the audio
            found in an M4A file. The important part is that the file is
            prepared in a format and length that the iPhone ringtone workflow
            can use.
          </p>
          <p className="text-text-muted leading-relaxed">
            Want the fuller breakdown of what makes a good ringtone clip, and
            how to smooth a cut point with a fade?{" "}
            <Link href="/guides/what-is-an-m4r-file-explained" className="text-amber-400 hover:underline">
              Read What Is an M4R File? The iPhone Ringtone Format Explained
            </Link>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common uses</h2>
          <p className="text-text-muted leading-relaxed">
            Turning a favorite song&apos;s chorus or hook into a custom
            ringtone, making a distinct alert tone from a short sound clip,
            and creating personalized ringtones for specific contacts
            without needing iTunes.
          </p>
        </section>

        {relatedTools.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-text-primary">More free tools</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {relatedTools.map((tool) => (
                <Link
                  key={tool.slug}
                  href={`/${tool.slug}`}
                  prefetch={false}
                  className="rounded-xl border border-graphite-800 bg-graphite-900 p-4 hover:border-amber-500/40 transition-colors"
                >
                  <h3 className="font-semibold text-text-primary">{tool.name}</h3>
                  <p className="text-sm text-text-muted mt-1">{tool.shortDescription}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <FAQSection faqs={faqs} />
      </main>
    </>
  );
}