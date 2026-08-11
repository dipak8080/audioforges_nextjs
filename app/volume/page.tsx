import type { Metadata } from "next";
import Link from "next/link";
import { VolumeForm } from "@/components/converter/VolumeForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Volume Booster - Increase or Reduce Audio Volume Online",
  description:
    "Increase or reduce audio volume online free — adjust gain from -30dB to +30dB on MP3, WAV, FLAC, and more. No sign-up, no watermark, fast processing.",
  keywords: [
    "volume booster",
    "audio volume booster",
    "increase audio volume",
    "increase mp3 volume",
    "boost mp3 volume",
    "reduce audio volume online",
    "audio gain adjuster",
    "make audio louder",
    "lower mp3 volume",
    "audio clipping",
    "gain vs volume",
  ],
  alternates: { canonical: `${SITE_URL}/volume` },
  openGraph: {
    title: "Volume Booster - Increase or Reduce Audio Volume Online",
    description: "Increase or reduce audio volume online, free and fast.",
    url: `${SITE_URL}/volume`,
    siteName: SITE_NAME,
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
    title: "Volume Booster - Increase or Reduce Audio Volume Online",
    description: "Increase or reduce audio volume online, free and fast.",
    images: ["/images/og-default.png"],
  },
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Audio Volume Adjuster",
  url: `${SITE_URL}/volume`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Boost audio volume up to +30dB",
    "Reduce audio volume down to -30dB",
    "No sign-up required",
    "No watermark",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Volume Adjuster", item: `${SITE_URL}/volume` },
  ],
};

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Increase or Reduce Audio Volume Online",
  step: [
    { "@type": "HowToStep", name: "Upload", text: "Upload your MP3, WAV, FLAC, or other supported audio file." },
    { "@type": "HowToStep", name: "Set gain", text: "Move the gain slider between -30dB and +30dB." },
    { "@type": "HowToStep", name: "Apply", text: "Click Adjust volume to process the file." },
    { "@type": "HowToStep", name: "Download", text: "Download the volume-adjusted file in the original format." },
  ],
};

// Same 10 questions and answers as before, word-for-word - only the
// structure changed, feeding both the schema and the accordion from one array.
const faqs = [
  {
    question: "What gain range can I use?",
    answer:
      "From -30dB to +30dB. Extreme values near either end will often sound distorted or overly quiet — that's expected behavior, not a bug.",
  },
  {
    question: "What's a safe boost amount?",
    answer:
      "+6dB to +10dB is a solid, clearly audible boost without heavy clipping risk on most source material.",
  },
  {
    question: "Is this really free?",
    answer: "Yes — completely free, no sign-up, no watermark on the output.",
  },
  {
    question: "What formats are supported?",
    answer: "MP3, WAV, FLAC, M4A, AAC, OGG, and AIFF, up to 80MB and 20 minutes long.",
  },
  {
    question: "Does boosting volume reduce quality?",
    answer:
      "The gain change itself doesn't discard any audio quality. The only quality risk is clipping if you push the boost high enough that peaks exceed the format's maximum level — moderate boosts don't carry that risk.",
  },
  {
    question: "Why is my audio still quiet after boosting?",
    answer:
      "If the source recording was very quiet to begin with, a single gain boost may not be enough to reach a comfortable listening level without introducing clipping. Try a moderate boost first and check the result before pushing higher.",
  },
  {
    question: "What is clipping?",
    answer:
      "Clipping is the harsh distortion that happens when a boosted signal tries to exceed the loudest level a format can represent, and the peaks get cut off flat instead of following the natural waveform.",
  },
  {
    question: "Is this different from normalization?",
    answer:
      "Yes. Normalization automatically raises a track to a target loudness level. This tool applies a fixed gain change you choose yourself, which gives you direct control but means you're responsible for picking a value that doesn't clip.",
  },
  {
    question: "Will boosting volume remove background noise?",
    answer:
      "No — a volume boost raises everything in the recording equally, including background noise. If the noise itself is the problem, a dedicated noise reduction tool is the better fix.",
    answerNode: (
      <>
        No — a volume boost raises everything in the recording equally,
        including background noise. If the noise itself is the problem, a{" "}
        <Link href="/noise-remove" className="text-amber-400 hover:underline">
          dedicated noise reduction tool
        </Link>{" "}
        is the better fix.
      </>
    ),
  },
  {
    question: "Does it work on mobile?",
    answer: "Yes — it works in any mobile browser on iPhone or Android, no app install required.",
  },
];

export default function VolumePage() {
  const relatedTools = getRelatedTools("volume", 5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Audio Volume Booster
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Increase or reduce audio volume online, free — no sign-up, no
            watermark. Adjust gain and download in seconds.
          </p>
        </header>

        <VolumeForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "-30 to +30dB", desc: "Full range gain control, either direction." },
            { title: "Fast", desc: "Most adjustments finish in a few seconds." },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <p className="font-semibold text-text-primary">{f.title}</p>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What is an audio volume booster?</h2>
          <p className="text-text-muted leading-relaxed">
            A volume booster increases or decreases the loudness of an audio
            file without touching its speed, pitch, or format. It&apos;s the
            right fix when a recording came out too quiet, a podcast has
            uneven levels between takes, or a track needs a small loudness
            adjustment before sharing — a straightforward gain change, nothing
            more.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Why increase audio volume?</h2>
          <p className="text-text-muted leading-relaxed">
            Recordings end up too quiet for all kinds of ordinary reasons: a
            voice memo captured at arm&apos;s length, a lecture or interview
            recorded on whatever device was on hand, a podcast segment that
            came in at a different level than the rest of the episode, or a
            music track exported at a conservative level to leave headroom.
            In every one of those cases the audio itself is fine — it just
            needs to be louder, which is exactly what a gain boost does
            without re-processing anything else about the file.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">When should you reduce volume instead?</h2>
          <p className="text-text-muted leading-relaxed">
            Reducing gain matters just as often as boosting it. A recording
            that&apos;s already clipping or distorted from being captured too
            hot can sometimes be brought back to a listenable level by
            pulling the gain down, though it won&apos;t undo distortion that
            already happened at the moment of recording. More commonly,
            reducing volume is about consistency — matching one clip&apos;s
            level to the rest of a project, or turning a track down before
            handing it off somewhere with its own loudness expectations, like
            a podcast platform or a shared mix.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to increase or reduce audio volume</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload your MP3, WAV, FLAC, M4A, AAC, OGG, or AIFF file.</li>
            <li>Move the gain slider to your target dB value, positive to boost or negative to reduce.</li>
            <li>Click Adjust volume to process the file.</li>
            <li>Download the result — same format as your upload, just at the new level.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Choosing a gain amount</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              <strong className="text-text-primary">+6dB to +10dB</strong> is a
              solid, clearly audible boost without heavy clipping risk on most
              recordings. Going much higher toward +30dB will often introduce
              distortion — that&apos;s the tradeoff of pushing gain that far, not a
              flaw in the tool.
            </p>
            <p>
              On the reduction side, <strong className="text-text-primary">-6dB to
              -10dB</strong> is enough to noticeably quiet a recording that&apos;s too
              loud, while still keeping it clearly audible.
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-sm text-left text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">Gain</th>
                  <th className="px-4 py-3 font-semibold">Typical result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3">+3dB</td>
                  <td className="px-4 py-3">A subtle, barely-there increase</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">+6dB</td>
                  <td className="px-4 py-3">Clearly louder, low clipping risk on most material</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">+10dB</td>
                  <td className="px-4 py-3">Much louder; check for clipping on already-loud recordings</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">+20dB</td>
                  <td className="px-4 py-3">More likely to clip unless the source had a lot of headroom to begin with</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">+30dB</td>
                  <td className="px-4 py-3">Only for very quiet source material — high clipping risk otherwise</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-text-muted leading-relaxed">
            Where clipping actually sets in depends on how much headroom the
            original recording already had — a very quiet source can often
            take a bigger boost before clipping than a recording that was
            already close to its loudest point.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Understanding clipping</h2>
          <p className="text-text-muted leading-relaxed">
            Clipping happens when a boosted signal tries to go louder than
            the format&apos;s maximum representable level, so instead of the
            waveform&apos;s peaks following their natural shape, they get cut
            off flat. That flattening is what produces the harsh, crackling
            distortion associated with an over-boosted recording. It&apos;s
            not something a volume tool can fix after the fact by adjusting
            gain back down — once a peak has been clipped, the detail that
            got cut off is gone, not just quieter. The only real prevention
            is boosting conservatively enough that peaks stay under the
            format&apos;s ceiling in the first place, which is exactly why
            the guidance above stays in a moderate range for most material.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Gain vs volume: what&apos;s the difference?</h2>
          <p className="text-text-muted leading-relaxed">
            The two terms get used interchangeably, but they describe
            different things. <strong className="text-text-primary">Gain</strong>{" "}
            is a change applied to the actual audio data itself — it&apos;s
            baked into the file you download, and it&apos;s what this tool
            adjusts. <strong className="text-text-primary">Volume</strong>{" "}
            usually refers to playback loudness on whatever device or app is
            playing the file back — your phone&apos;s volume buttons, for
            instance, change nothing about the file itself. If a file sounds
            too quiet even at full playback volume, that&apos;s a sign the
            file needs a gain boost, not just a louder playback setting.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Related tools</h2>
          <p className="text-text-muted leading-relaxed">
            If background noise, not just loudness, is the issue, our{" "}
            <Link href="/noise-remove" className="text-amber-400 hover:underline">
              Noise Remover
            </Link>{" "}
            is the better fit — a volume boost raises noise right along with
            everything else. Need to cut a clip down before adjusting its
            level? Try{" "}
            <Link href="/trim" className="text-amber-400 hover:underline">
              Trim Audio
            </Link>{" "}
            first, or head to the{" "}
            <Link href="/convert" className="text-amber-400 hover:underline">
              Audio Converter
            </Link>{" "}
            if you need a different file format afterward.
          </p>
          <p className="text-text-muted leading-relaxed">
            Want the full explanation of why clipping happens and where gain
            adjustments fit in a mixing workflow? Read{" "}
            <Link href="/guides/gain-staging-for-home-studios" className="text-amber-400 hover:underline">
              Gain Staging Explained for Home Studios
            </Link>.
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