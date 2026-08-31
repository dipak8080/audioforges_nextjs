import type { Metadata } from "next";
import Link from "next/link";
import { RingtoneForm } from "@/components/converter/RingtoneForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getToolLimits } from "@/lib/data/tool-limits";
import { getLimits, retentionSentences } from "@/lib/api/limits";
import { ogForTool } from "@/lib/og";

/**
 * THE LENGTH IS APPLE'S, AND IT'S LOAD-BEARING.
 *
 * Verified against support.apple.com/en-us/120692 ("Create a custom ringtone
 * on your iPhone", 22 May 2025): ringtones can be up to 30 seconds, and at the
 * export step anything longer prompts GarageBand to shorten it AUTOMATICALLY.
 *
 * That silent truncation is why the figure matters more than a cosmetic cap.
 * An over-length clip doesn't fail loudly — the section someone carefully
 * chose simply isn't the section they end up with, and nothing tells them.
 *
 * The fallback below is 30 for the same reason. It used to be 40, which meant
 * a missing entry would silently restore the exact wrong value this was
 * corrected from. Everything on this page — the strip, the how-to step, three
 * FAQ answers, the schema — renders from this one constant, and RingtoneForm
 * reads the same source, so the control and the copy can't disagree.
 */
const MAX_RINGTONE_SECONDS = getToolLimits("ringtone-maker")?.maxTotalDurationSeconds ?? 30;

/**
 * TITLE PHRASING IS DELIBERATE. The keyword cluster here is four phrases:
 * "ringtone maker", "free ringtone maker", "iphone ringtone maker",
 * "ringtone maker for iphone". The old "Free iPhone Ringtone Maker" contained
 * the first and third but broke the word order on the other two. "Free
 * Ringtone Maker for iPhone" contains all four as contiguous substrings while
 * still reading as a phrase. Don't reorder it.
 *
 * "mp3 ringtone maker" is covered in body copy rather than the title —
 * forcing it in would break the phrasing that wins the other four.
 */
const PAGE_TITLE = "Free Ringtone Maker for iPhone – MP3 to M4R";
const PAGE_DESCRIPTION = `Free ringtone maker for iPhone. Turn any MP3 into an M4R ringtone online — pick your start point, up to ${MAX_RINGTONE_SECONDS} seconds, no iTunes, no sign-up, no watermark.`;

const OG_IMAGE = ogForTool("ringtone-maker", "Free Ringtone Maker for iPhone");

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/ringtone-maker` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/ringtone-maker`,
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

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.

export default async function RingtoneMakerPage() {
  const relatedTools = getRelatedTools("ringtone-maker", 5);

  const limits = await getLimits();
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  // Every claim below is checked against actual RingtoneForm/backend
  // behaviour. The length comes from the same constant the form enforces
  // rather than being typed — which is what let the two disagree before.
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
        States Apple's figure directly because it's verified, not assumed. The
        automatic-shortening detail is the part worth including: an over-length
        ringtone isn't rejected, it's silently truncated at export, so someone
        who picked their seconds carefully would never learn why the clip
        changed.
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

      <ToolPageShell
        breadcrumb={
          <Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Ringtone Maker" }]} />
        }
        title="Free Ringtone Maker for iPhone"
        lede="Turn any song into an iPhone-ready ringtone (M4R), free, no iTunes, no sign-up, no watermark."
        tool={<RingtoneForm />}
      >
        <FeatureStrip
          features={[
            {
              title: "iPhone-ready",
              desc: "Outputs .m4r, the extension iOS associates with ringtones.",
            },
            {
              title: `Up to ${MAX_RINGTONE_SECONDS}s`,
              desc: "Choose exactly where the ringtone starts and how long it runs.",
            },
            {
              title: "No iTunes",
              desc: `Create your ringtone online. Up to ${limits.maxUploadMb}MB per upload.`,
            },
          ]}
        />

        <ToolSection id="how-to" title="How to make an iPhone ringtone">
          <ol>
            <li>Upload an {formatList} file.</li>
            <li>
              Set the start point and length (up to {MAX_RINGTONE_SECONDS} seconds)
              of the clip you want.
            </li>
            <li>Download the .m4r file and add it to your iPhone.</li>
          </ol>
        </ToolSection>

        {/* Covers the "mp3 ringtone maker" phrase in body copy where it's
            honest, and gives the two downloader tools an inbound link from a
            page that already ranks. */}
        <ToolSection id="get-the-audio" title="Where to get the audio">
          <p>
            MP3 is the most common starting point, and it works here directly —
            there&apos;s no need to convert it first. The other supported formats
            are accepted the same way, so whatever the file already is, upload it
            as-is.
          </p>
          <p>
            If the sound you want isn&apos;t a file yet, get it first:{" "}
            <Link href="/tiktok-to-mp3">TikTok to MP3</Link> pulls audio from a
            TikTok link, and <Link href="/youtube-to-wav">YouTube to WAV</Link>{" "}
            does the same from a YouTube video or Short. Either output uploads
            straight into the ringtone maker above.{" "}
            <Link href="/guides/tiktok-sound-to-ringtone">
              Read How to Make a Ringtone from a TikTok Sound
            </Link>{" "}
            for where to cut the hook, how long to make it, and the part iOS
            makes harder than it should be.
          </p>
        </ToolSection>

        <ToolSection id="add-to-iphone" title="Adding your ringtone to an iPhone">
          <p>
            Once you have the .m4r file, you can use it with an iPhone ringtone
            workflow such as GarageBand. Apple&apos;s current instructions cover
            importing an audio file into GarageBand, trimming it to a ringtone,
            and exporting it as one. The exact steps — and the exact length iOS
            will accept — can vary by version, so it&apos;s worth checking
            Apple&apos;s current instructions for your specific device.
          </p>
        </ToolSection>

        <ToolSection id="what-is-m4r" title="What .m4r actually is">
          <p>
            An M4R file uses the .m4r extension associated with iPhone ringtones.
            It commonly contains AAC audio, similar to the audio found in an M4A
            file. The important part is that the file is prepared in a format and
            length that the iPhone ringtone workflow can use.
          </p>
          <p>
            Want the fuller breakdown of what makes a good ringtone clip, and how
            to smooth a cut point with a fade?{" "}
            <Link href="/guides/what-is-an-m4r-file-explained">
              Read What Is an M4R File? The iPhone Ringtone Format Explained
            </Link>
            .
          </p>
        </ToolSection>

        <ToolSection id="common-uses" title="Common uses">
          <p>
            Turning a favorite song&apos;s chorus or hook into a custom ringtone,
            making a distinct alert tone from a short sound clip, and creating
            personalized ringtones for specific contacts without needing iTunes.
          </p>
        </ToolSection>

        <RelatedToolsGrid tools={relatedTools} />

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}