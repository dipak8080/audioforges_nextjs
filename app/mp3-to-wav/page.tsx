import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { ConvertForm } from "@/components/converter/ConvertForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getLimits, retentionSentences } from "@/lib/api/limits";
import { ogForTool } from "@/lib/og";

/*
  DEDICATED PAGE for the "mp3 to wav" cluster. Ahrefs, Aug 2026:

    mp3 to wav            >10,000   Easy KD
    mp3 to wav converter  >1,000    Medium KD
    convert mp3 to wav    >1,000    Medium KD

  Easy head term, weak SERP — the same profile as /wav-to-mp3. Split from
  /convert; /convert is the general "audio converter" hub and no longer leads
  with "mp3 to wav", so the two don't compete.

  DIFFERENTIATION: MP3->WAV is the direction people get WRONG, and every
  competing page either stays silent or actively implies the WAV comes out
  higher quality. It doesn't — the MP3's discarded data is gone for good, and
  the WAV is just bigger. This page leads with that honesty and then gives the
  real reasons to convert anyway (software that needs WAV, editing without
  stacking compression). That honest framing is what an answer engine cites.

  M4A->MP3 NOTE (2026-09-04): no dedicated /m4a-to-mp3 page exists — that
  intent lives on /convert. The "other formats" section links M4A there. Do
  not add a /m4a-to-mp3 link; the route does not exist.

  `absolute` title, so " | AudioForges" isn't appended.
*/
const PAGE_TITLE = "MP3 to WAV Converter — Uncompressed Audio, Online";
const PAGE_DESCRIPTION =
  "Convert MP3 to WAV free online — get an uncompressed WAV for editing, DAWs, or software that needs it. Honest note: it won't add quality back. No sign-up, no app.";

const OG_IMAGE = ogForTool("mp3-to-wav", "Free MP3 to WAV converter");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/mp3-to-wav` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/mp3-to-wav`,
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

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "MP3 to WAV Converter",
  alternateName: ["Convert MP3 to WAV", "MP3 to WAV Converter Free", "MP3 to WAV Online"],
  url: `${SITE_URL}/mp3-to-wav`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Convert MP3 to WAV in the browser",
    "Uncompressed 16-bit PCM output",
    "Sample rate preserved from the source MP3",
    "No sign-up, no watermark",
    "Runs on Windows, Mac, iPhone and Android",
  ],
};

// MP3 (~2.4 MB/min at 320) -> WAV (~10 MB/min). The point: WAV is BIGGER, not
// better, coming from an MP3 source.
const SIZE_ROWS = [
  ["3-minute song", "~7 MB", "~30 MB"],
  ["10-minute recording", "~24 MB", "~100 MB"],
  ["1-hour podcast", "~140 MB", "~600 MB"],
];

// Concrete "what actually needs WAV" — the specifics that turn the vague
// "some software wants uncompressed" claim into something citable.
const NEEDS_WAV = [
  [
    "CD burning & disc authoring",
    "Red Book audio CDs are 16-bit / 44.1 kHz PCM. Burning software wants WAV or AIFF, not MP3, so the disc plays in standalone players.",
  ],
  [
    "Broadcast & radio automation",
    "Playout systems and station libraries standardise on uncompressed audio to avoid a second lossy pass over already-compressed source.",
  ],
  [
    "Older samplers & hardware",
    "Many hardware samplers and legacy editors read WAV natively and either can't open MP3 or decode it unreliably.",
  ],
  [
    "DAWs that re-encode on import",
    "Some DAWs transcode MP3 on import; feeding them a WAV means you control the decode once, up front, instead of at every save.",
  ],
  [
    "DJ software & CDJs",
    "Some DJ setups and older CDJ firmware prefer WAV for gapless, glitch-free playback of key tracks.",
  ],
];

const AFTER_CONVERSION = [
  { href: "/trim", label: "Trim the WAV", body: "Cut a clean section — lossless edits, no re-compression." },
  { href: "/pitch", label: "Pitch shift", body: "Change key without an extra lossy generation." },
  { href: "/tempo", label: "Change tempo", body: "Speed up or slow down the uncompressed file." },
  { href: "/convert", label: "Other formats", body: "Send it on to FLAC, AIFF, M4A and more." },
];

export default async function Mp3ToWavPage() {
  const relatedTools = getRelatedTools("convert", 5);
  const limits = await getLimits();
  const retention = retentionSentences(limits.retention.audio_tools);

  const faqs = [
    {
      question: "How do I convert MP3 to WAV?",
      answer:
        "Upload the .mp3 file above — WAV is the output — then click Convert and Download. Nothing to install, no account to create; it runs entirely in your browser.",
    },
    {
      question: "Does converting MP3 to WAV improve the quality?",
      answer:
        "No — and this is the most important thing to know. MP3 is lossy: when the file was first encoded, audio data was permanently discarded. Converting to WAV writes what's left out in an uncompressed container, but it can't recover anything that was thrown away. The WAV will be several times larger and sound exactly the same as the MP3. Anyone claiming MP3-to-WAV boosts quality is mistaken.",
    },
    {
      question: "Then why convert MP3 to WAV at all?",
      answer:
        "Because some software and hardware want uncompressed audio: DAWs, samplers, DJ decks, CD-burning and broadcast tools, and older editors that don't read MP3 cleanly. Converting to WAV also means that if you're going to edit the file, your edits don't stack a second round of lossy compression on top of the first. It's about compatibility and clean editing, not quality.",
    },
    {
      question: "How much bigger is the WAV?",
      answer:
        "Roughly four times larger than a 320 kbps MP3, and more against lower-bitrate MP3s. A 7 MB MP3 song becomes about a 30 MB WAV. Uncompressed audio runs about 10 MB per minute regardless of the source.",
    },
    {
      question: "What sample rate and bit depth is the WAV?",
      answer:
        "16-bit PCM. The sample rate follows the MP3 source (usually 44.1 kHz), so nothing is resampled — the WAV is a faithful uncompressed copy of the decoded MP3.",
    },
    {
      question: "Is the WAV 44.1 kHz or 48 kHz?",
      answer:
        "Whatever the source MP3 is — the converter doesn't resample. Most MP3s are 44.1 kHz, so you'll usually get a 44.1 kHz WAV. If your project needs a specific rate (48 kHz for video, say), set that in your DAW after importing, or use the sample rate converter; converting MP3 to WAV alone won't change it.",
    },
    {
      question: "How do I convert MP3 to WAV on Windows or Mac?",
      answer:
        "You don't need any software — open this page in any browser on either, drag the .mp3 in, and download the WAV. It's quicker than installing a converter or exporting through a media player's settings.",
    },
    {
      question: "My DAW won't import MP3 — will a WAV fix that?",
      answer:
        "Yes. If your editor refuses MP3 or decodes it unreliably, converting to WAV first gives it the uncompressed file it expects. You're not gaining quality — the audio is whatever the MP3 already was — but you get a file the software will open cleanly and edit without transcoding it again.",
    },
    {
      question: "Is this MP3 to WAV converter free?",
      answer:
        "Yes — completely free, with no account, no email, no trial cap, and no watermark. A light fair-use limit keeps the queue moving; that's the only limit.",
    },
    {
      question: "Can I convert several MP3 files at once?",
      answer: "Not yet — files convert one at a time. For a batch, run them through one after another.",
    },
    {
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
      />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "MP3 to WAV" }]} />
        }
        title="MP3 to WAV Converter"
        lede="Convert MP3 to WAV free — get an uncompressed file for editing or software that needs it. No sign-up, no app to install."
        tool={<ConvertForm defaultTarget="wav" />}
      >
        <FeatureStrip
          features={[
            { title: "Uncompressed", desc: "16-bit PCM WAV — the format DAWs and samplers want." },
            { title: "Clean edits", desc: "Edit without stacking a second round of MP3 compression." },
            { title: "No sign-up", desc: "No account, no email, no watermark on the file." },
          ]}
        />

        <ToolSection id="how-to" title="How to convert MP3 to WAV">
          <ol>
            <li>Upload your .mp3 file above — WAV is set as the output.</li>
            <li>Click Convert and wait a few seconds.</li>
            <li>Download the WAV.</li>
          </ol>
          <p>
            It works the same in any browser on Windows, Mac, iPhone or Android — no app to
            install and no account to make.
          </p>
        </ToolSection>

        {/* The honest lead. This is the section an answer engine quotes, and
            the reason to trust this page over the ones that imply otherwise. */}
        <ToolSection id="quality" title="Does converting MP3 to WAV improve quality?">
          <p>
            No — and it&apos;s worth being clear about, because plenty of pages imply otherwise. MP3
            is a <strong>lossy</strong> format: when your file was first made, audio data was
            permanently thrown away to shrink it. Converting to WAV writes whatever is left into an
            uncompressed container, but it cannot bring back anything that was discarded.
          </p>
          <p>
            So the WAV will be several times larger and sound <em>exactly</em> the same as the MP3 —
            not better. If you need genuinely high-quality audio, it has to come from a lossless
            source in the first place; no conversion adds detail back.{" "}
            <Link href="/guides/lossless-vs-lossy-audio-formats">
              Read Lossless vs Lossy Audio: Which Format to Use
            </Link>{" "}
            for the full explanation.
          </p>
        </ToolSection>

        <ToolSection id="why" title="Then why convert MP3 to WAV?">
          <p>
            There are real reasons — they&apos;re just about compatibility and editing, not quality:
          </p>
          <ul>
            <li>
              <strong>Software that wants uncompressed audio.</strong> Many DAWs, samplers, and DJ
              decks prefer or require WAV, and some older editors and CD/broadcast tools don&apos;t
              read MP3 cleanly.
            </li>
            <li>
              <strong>Editing without stacking compression.</strong> If you&apos;re going to cut,
              pitch, or process the file, converting to WAV first means your edits don&apos;t add a
              second lossy generation on top of the MP3&apos;s.
            </li>
            <li>
              <strong>A predictable, universal working file.</strong> WAV behaves the same
              everywhere, with no codec surprises mid-project.
            </li>
          </ul>
        </ToolSection>

        {/* Depth: the concrete "what actually needs WAV" list. Turns the vague
            claim above into specifics an answer engine can lift verbatim. */}
        <ToolSection id="needs-wav" title="What actually needs a WAV instead of an MP3">
          <p>
            &quot;Some software wants uncompressed audio&quot; is true but vague. Here&apos;s where
            it bites in practice — the cases where an MP3 genuinely won&apos;t do and a WAV is the
            fix:
          </p>
          <dl className="codes">
            {NEEDS_WAV.map(([label, use]) => (
              <Fragment key={label}>
                <dt>{label}</dt>
                <dd>{use}</dd>
              </Fragment>
            ))}
          </dl>
          <p>
            In every one of these the WAV isn&apos;t higher quality than the MP3 — it&apos;s just
            the container the tool insists on. If none of these is your situation, keeping the MP3
            is usually the right call.
          </p>
        </ToolSection>

        {/* Concrete size math — the reverse of the wav-to-mp3 table, and the
            number people are surprised by. */}
        <ToolSection id="size" title="How much bigger will the WAV be?" bleed>
          <div className="mt-2 overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <caption className="sr-only">MP3 versus WAV file size by length</caption>
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Length</th>
                  <th scope="col" className="px-4 py-3 font-semibold">MP3 (320 kbps)</th>
                  <th scope="col" className="px-4 py-3 font-semibold">WAV (uncompressed)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                {SIZE_ROWS.map(([len, mp3, wav]) => (
                  <tr key={len}>
                    <td className="px-4 py-3 text-text-primary">{len}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{mp3}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{wav}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-text-muted">
            About four times larger — the cost of storing audio uncompressed. If you don&apos;t need
            a WAV specifically, keeping the MP3 saves a lot of space.
          </p>
        </ToolSection>

        {/* Depth: what the WAV actually is, technically. The honest counterpart
            to the size table — a faithful decoded copy, not an upsample. */}
        <ToolSection id="spec" title="What the WAV actually contains">
          <p>
            The output is <strong>16-bit PCM</strong> at the source MP3&apos;s own sample rate —
            almost always 44.1 kHz, since that&apos;s what most MP3s are. There&apos;s no
            resampling and no upsampling: the converter decodes the MP3 to raw samples and writes
            those out uncompressed. That makes the WAV a faithful copy of the decoded MP3, bit-for-
            bit the same audio in a lossless container.
          </p>
          <p>
            This is worth stating because &quot;bigger file&quot; makes people assume &quot;higher
            resolution.&quot; It isn&apos;t. A 44.1 kHz / 16-bit WAV made from a 128 kbps MP3
            carries exactly the fidelity of that 128 kbps MP3 — the extra bytes are the cost of
            storing it uncompressed, not new detail. If you need a different rate or bit depth for
            a project, set it in your DAW after importing, or use the{" "}
            <Link href="/sample-rate-converter">sample rate converter</Link> — but know that
            neither adds quality the MP3 never had.
          </p>
        </ToolSection>

        {/* Depth: the real nuance behind the honest lead. The WAV doesn't
            recover quality, but it DOES stop you compounding loss across edits.
            Competitors flatten this into "WAV is better for editing" with no
            explanation of why. */}
        <ToolSection id="editing" title="Does converting to WAV before editing actually help?">
          <p>
            Yes — but not the way people expect. Converting to WAV doesn&apos;t make the audio
            better. What it does is stop it getting <em>worse</em> as you work.
          </p>
          <p>
            Every time you export back to MP3, the encoder throws away data again — a second, third,
            fourth lossy generation stacked on the first. Edit an MP3 in place, re-save as MP3, and
            you&apos;ve compounded the loss. Convert to WAV first, do all your cutting, pitching,
            and processing on the uncompressed file, and each edit works on the full decoded audio
            with nothing further discarded. You only re-compress once, at the very end, if you
            export back to MP3 at all.
          </p>
          <p>
            So the rule is simple: the WAV is your working file, not your archive. It won&apos;t
            recover what the MP3 lost, but it keeps every edit from adding more loss on top.
          </p>
        </ToolSection>

        <ToolSection id="after" title="After the WAV: the rest on this site">
          <p>
            Converting to WAV is usually the first step in an edit. Once you have it, the next thing
            runs here too, with no re-upload:
          </p>
          <dl>
            {AFTER_CONVERSION.map((item) => (
              <Fragment key={item.href}>
                <dt>
                  <Link href={item.href} prefetch={false}>
                    {item.label}
                  </Link>
                </dt>
                <dd>{item.body}</dd>
              </Fragment>
            ))}
          </dl>
        </ToolSection>

        <ToolSection id="other" title="Need the other direction, or a different format?">
          <p>
            Going the other way to shrink a file? The{" "}
            <Link href="/wav-to-mp3">WAV to MP3 converter</Link> does that. For any other pair —
            M4A, FLAC, AAC, OGG, AIFF, including M4A to MP3 — use the{" "}
            <Link href="/convert">audio converter</Link>. Pulling audio out of a video first? The{" "}
            <Link href="/video-to-audio">video to audio converter</Link> handles that.
          </p>
        </ToolSection>

        <RelatedToolsGrid tools={relatedTools} />

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}