import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Prose } from "@/components/ui/Prose";
import { ogForGuide } from "@/lib/og";

const guide = getGuideBySlug("audio-format-for-game-engines-unity-unreal-godot")!;

const OG_IMAGE = ogForGuide(guide);

export const metadata: Metadata = {
  title: guide.title,
  description: guide.description,
  alternates: { canonical: `${SITE_URL}/guides/${guide.slug}` },
  openGraph: {
    title: guide.title,
    description: guide.description,
    url: `${SITE_URL}/guides/${guide.slug}`,
    siteName: "AudioForges",
    type: "article",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: guide.title,
    description: guide.description,
    images: [OG_IMAGE.url],
  },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: guide.title,
  description: guide.description,
  datePublished: guide.publishedDate,
  dateModified: guide.updatedDate,
  author: { "@type": "Organization", name: "AudioForges" },
  url: `${SITE_URL}/guides/${guide.slug}`,
  mainEntityOfPage: `${SITE_URL}/guides/${guide.slug}`,
  image: `${SITE_URL}${OG_IMAGE.url}`,
  publisher: { "@type": "Organization", name: "AudioForges" },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Should game audio be 44.1 kHz or 48 kHz?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Either works in every major engine. 48 kHz is the safer default because it matches the output rate most PCs, consoles and phones run at, so the engine doesn't resample at runtime. Whichever you pick, use it for every file in the project.",
      },
    },
    {
      "@type": "Question",
      name: "WAV or OGG for game sound effects?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "WAV for short sound effects that play often (footsteps, UI clicks, gunshots) because they decode instantly. OGG Vorbis for music and long ambience because the file is 5-10x smaller and the decode cost is spread across a long clip.",
      },
    },
    {
      "@type": "Question",
      name: "Why does my sound effect have a delay in Unity?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Usually because the clip is compressed and set to stream or decompress on load. Set short SFX to Decompress On Load with PCM or ADPCM compression, and make sure the clip has no silence at the start.",
      },
    },
  ],
};

const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary";
const td = "px-3 py-2 align-top";

export default function GameAudioFormatGuidePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <Breadcrumb items={[{ name: "Guides", href: "/guides" }, { name: guide.title }]} className="mb-8" />

        <header>
          <h1 className="measure-wide text-4xl font-bold leading-[1.06] tracking-[-0.02em] text-text-primary sm:text-5xl">
            {guide.title}
          </h1>
          <div className="mt-5">
            <GuideByline publishedDate={guide.publishedDate} updatedDate={guide.updatedDate} />
          </div>
        </header>

        <Prose className="mt-10">
          <p>
            Game engines are forgiving about what you import and unforgiving
            about what it costs at runtime. A 96 kHz stereo WAV footstep will
            play fine in Unity, Unreal or Godot — it will also be resampled on
            every trigger, take ten times the memory it needs, and bloat the
            build. Getting the format right before import is a two-minute job
            that saves you from chasing audio pops and load stutter later.
          </p>

          <h2 id="the-short-answer">The short answer</h2>
          <ul>
            <li><strong>Sample rate:</strong> 48 kHz for everything. 44.1 kHz is fine too — just pick one and never mix them.</li>
            <li><strong>Bit depth:</strong> 16-bit. 24-bit buys nothing once the engine mixes to its output.</li>
            <li><strong>Short SFX</strong> (footsteps, UI, impacts, weapons): WAV, mono.</li>
            <li><strong>Music and long ambience:</strong> OGG Vorbis, stereo, quality 5–7 (roughly 160–224 kbps).</li>
            <li><strong>Voice / dialogue:</strong> OGG or engine-compressed, mono.</li>
            <li><strong>Trim silence</strong> from the start of every SFX. Leading silence is the number-one cause of &ldquo;laggy&rdquo; sounds.</li>
          </ul>

          <h2 id="why-48">Why 48 kHz, and why consistency matters more than the number</h2>
          <p>
            Almost every playback device — Windows, macOS, Android, iOS, consoles,
            HDMI — runs its audio output at 48 kHz. If your clips are 44.1 kHz
            the engine resamples every one of them at runtime. It&apos;s cheap,
            but it isn&apos;t free, and on a mobile target with dozens of
            simultaneous voices it adds up. 48 kHz sidesteps it entirely.
          </p>
          <p>
            What actually causes trouble is <em>mixing</em> rates: a 44.1 kHz
            music track under 48 kHz effects, or one 22.05 kHz legacy clip in a
            48 kHz project. Pick a project rate, put it in your import checklist,
            and convert anything that doesn&apos;t match before it goes into the
            assets folder.
          </p>

          <h2 id="wav-vs-ogg">WAV vs OGG: it&apos;s about decode cost, not quality</h2>
          <p>
            WAV is uncompressed, so the engine can play it the instant it&apos;s
            triggered. OGG has to be decoded, which costs a little CPU each time
            the clip starts. For a footstep that fires twenty times a second in
            a crowd scene, that matters. For a three-minute music loop that
            starts once, it doesn&apos;t — and the OGG is a tenth of the size.
          </p>
          <p>
            Rule of thumb: under about ten seconds and played often → WAV. Over
            that, or played rarely → OGG. Engines add their own compression on
            top of this (see the table), so &ldquo;WAV in the project&rdquo;
            doesn&apos;t always mean &ldquo;WAV in the build&rdquo;.
          </p>

          <h2 id="mono-vs-stereo">Mono for anything positioned in 3D</h2>
          <p>
            A sound placed in the world — a gunshot, a door, an NPC line — should
            be mono. The engine spatialises it by panning and attenuating a
            single channel; a stereo source gets collapsed or, worse, plays wide
            no matter where it is. Keep stereo for music, UI stingers and
            non-diegetic ambience beds. Converting SFX to mono also halves their
            memory footprint. The{" "}
            <Link href="/mono-stereo-converter">Mono/Stereo Converter</Link>{" "}
            does this in one step.
          </p>

          <h2 id="by-engine">Engine specifics</h2>
          <div className="not-prose my-6 overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-graphite-900">
                <tr>
                  <th className={th}>Engine</th>
                  <th className={th}>Import formats</th>
                  <th className={th}>Recommended source</th>
                  <th className={th}>Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-graphite-800">
                  <td className={td}><strong>Unity</strong></td>
                  <td className={td}>WAV, AIFF, OGG, MP3, FLAC</td>
                  <td className={td}>48 kHz 16-bit WAV (SFX), OGG (music)</td>
                  <td className={td}>Set short SFX to <em>Decompress On Load</em> + PCM/ADPCM; music to <em>Streaming</em> + Vorbis. Import settings override the source format.</td>
                </tr>
                <tr className="border-t border-graphite-800">
                  <td className={td}><strong>Unreal Engine</strong></td>
                  <td className={td}>WAV (16-bit PCM), OGG, FLAC, AIFF</td>
                  <td className={td}>48 kHz 16-bit WAV for everything</td>
                  <td className={td}>Unreal compresses on cook (Bink/ADPCM/Vorbis per platform). Importing 24-bit or 32-bit float WAV can fail on older versions — export 16-bit.</td>
                </tr>
                <tr className="border-t border-graphite-800">
                  <td className={td}><strong>Godot</strong></td>
                  <td className={td}>WAV, OGG Vorbis, MP3</td>
                  <td className={td}>WAV (SFX), OGG (music)</td>
                  <td className={td}>WAV imports with optional IMA-ADPCM compression and a &ldquo;Force mono&rdquo; toggle. OGG supports loop points natively.</td>
                </tr>
                <tr className="border-t border-graphite-800">
                  <td className={td}><strong>GameMaker</strong></td>
                  <td className={td}>WAV, OGG, MP3</td>
                  <td className={td}>WAV (SFX), OGG (music)</td>
                  <td className={td}>&ldquo;Uncompressed&rdquo; = WAV in memory; &ldquo;Compressed – Streamed&rdquo; for music.</td>
                </tr>
                <tr className="border-t border-graphite-800">
                  <td className={td}><strong>Web (HTML5 / Phaser / Three.js)</strong></td>
                  <td className={td}>OGG, MP3, WAV, AAC</td>
                  <td className={td}>OGG + MP3 fallback</td>
                  <td className={td}>Safari historically lacked OGG; ship both and let the browser pick.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 id="workflow">Batch-prepping a folder of sounds</h2>
          <ol>
            <li>
              <strong>Trim leading silence</strong> on each SFX with the{" "}
              <Link href="/trim">Audio Trimmer</Link>. Even 20 ms of silence reads
              as input lag.
            </li>
            <li>
              <strong>Mono for positional SFX</strong> via the{" "}
              <Link href="/mono-stereo-converter">Mono/Stereo Converter</Link>.
            </li>
            <li>
              <strong>Resample to 48 kHz, 16-bit</strong> with the{" "}
              <Link href="/sample-rate-converter">Sample Rate Converter</Link>.
              Do this last so the earlier steps run on the original.
            </li>
            <li>
              <strong>Music and ambience to OGG</strong> with the{" "}
              <Link href="/convert">Audio Converter</Link>. Keep a WAV master
              outside the project.
            </li>
            <li>
              <strong>Level-match</strong> with the{" "}
              <Link href="/loudness-normalizer">Loudness Normalizer</Link> so
              you&apos;re not fighting volume sliders in the mixer — around −16
              LUFS for music beds, −12 to −10 for SFX, peaks at −1 dBTP.
            </li>
          </ol>

          <h2 id="common-problems">Common problems and the format fix</h2>
          <ul>
            <li><strong>Clicks or pops at the start</strong> — the file doesn&apos;t start at a zero crossing, or the engine is resampling. Trim to a zero crossing and match the project rate.</li>
            <li><strong>Sound plays late</strong> — leading silence, or a compressed clip set to stream. Trim, and set short SFX to decompress on load.</li>
            <li><strong>Positional sound isn&apos;t panning</strong> — the source is stereo. Convert to mono.</li>
            <li><strong>Import fails in Unreal</strong> — 24/32-bit or float WAV. Export 16-bit PCM.</li>
            <li><strong>Build size exploded</strong> — music stored as WAV. Convert to OGG and set to streaming.</li>
            <li><strong>Loop has a gap</strong> — MP3 adds encoder padding; use OGG or WAV for loops.</li>
          </ul>
        </Prose>

        <div className="mt-10 border-t border-graphite-800 pt-8">
          <Link href="/sample-rate-converter" className={buttonStyles({ size: "lg" })}>
            Open the Sample Rate Converter
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}