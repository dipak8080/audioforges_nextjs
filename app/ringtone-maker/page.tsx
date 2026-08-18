import type { Metadata } from "next";
import Link from "next/link";
import { RingtoneForm } from "@/components/converter/RingtoneForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

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

const PAGE_TITLE = "Free Ringtone Maker for iPhone – MP3 to M4R";
const PAGE_DESCRIPTION =
  "Free ringtone maker for iPhone. Turn any MP3 into a 30-second M4R ringtone online — pick your start point, no iTunes, no sign-up, no watermark.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  keywords: [
    "ringtone maker",
    "free ringtone maker",
    "iphone ringtone maker",
    "ringtone maker for iphone",
    "mp3 ringtone maker",
    "online ringtone maker",
    "make a ringtone from a song",
    "m4r converter",
    "mp3 to m4r",
    "custom ringtone iphone",
    "ringtone cutter",
    "song to ringtone",
  ],
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

// WebApplication schema — every claim below is checked against the actual
// RingtoneForm/backend behavior and against Apple's current documented
// 30-second ringtone limit (support.apple.com/en-us/120692).
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Ringtone Maker",
  url: `${SITE_URL}/ringtone-maker`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Trims to an iPhone-compatible length (up to 30 seconds)",
    "Outputs M4R, recognized directly by iOS",
    "Accepts MP3, WAV, FLAC, M4A, AAC, OGG and AIFF sources",
    "No sign-up required",
    "No watermark",
  ],
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
    question: "Why is there a 30-second limit?",
    answer:
      "Apple's current iPhone ringtone workflow supports ringtones up to 30 seconds. Keeping the clip within that limit helps ensure it can actually be used as an iPhone ringtone.",
  },
  {
    question: "Can I make a ringtone from an MP3?",
    answer:
      "Yes — MP3 is the most common source here. Upload the MP3, choose the section you want, and the tool hands back an M4R. WAV, FLAC, M4A, AAC, OGG and AIFF work the same way, so you don't need to convert to MP3 first.",
  },
  {
    question: "Can I make a ringtone from a TikTok or YouTube sound?",
    answer:
      "Yes, in two steps: pull the audio out first with the TikTok to MP3 converter or the YouTube to WAV converter, then upload that file here and pick your 30 seconds.",
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
        , then upload that file here and pick your 30 seconds.{" "}
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
    answer: "Yes, 80MB for the file you upload — the output ringtone itself will be much smaller.",
  },
  {
    question: "Is this really free?",
    answer: "Yes — completely free, no sign-up, no watermark.",
  },
];

export default function RingtoneMakerPage() {
  const relatedTools = getRelatedTools("ringtone-maker", 5);

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

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "iPhone-ready", desc: "Outputs .m4r, recognized directly by iOS." },
            { title: "Pick your section", desc: "Choose exactly where the ringtone starts." },
            { title: "No iTunes", desc: "Create your ringtone online without iTunes." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <p className="font-semibold text-text-primary">{f.title}</p>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to make an iPhone ringtone</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an MP3, WAV, FLAC, M4A, AAC, OGG, or AIFF file.</li>
            <li>Set the start point and length (up to 30 seconds) of the clip you want.</li>
            <li>Download the .m4r file and add it to your iPhone.</li>
          </ol>
        </section>

        {/* New section: covers the "mp3 ringtone maker" phrase in body
            copy where it's honest, and gives the two downloader tools an
            inbound link from a page that already ranks. */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Where to get the audio</h2>
          <p className="text-text-muted leading-relaxed">
            MP3 is the most common starting point, and it works here directly —
            there&apos;s no need to convert it first. WAV, FLAC, M4A, AAC, OGG
            and AIFF are accepted the same way, so whatever the file already is,
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
            steps can vary by iOS version, so it&apos;s worth checking
            Apple&apos;s current instructions for your specific device.
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