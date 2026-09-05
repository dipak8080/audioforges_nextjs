import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { AudioToMidiForm } from "@/components/converter/AudioToMidiForm";
import { MidiCompare } from "@/components/credits/MidiCompare";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { Prose } from "@/components/ui/Prose";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { ToolVideo } from "@/components/media/ToolVideo";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getFeatureFlags } from "@/lib/api/railway";
import { ogForTool } from "@/lib/og";

const PAGE_TITLE = "Audio to MIDI Converter – MP3 & WAV to MIDI";
const PAGE_DESCRIPTION =
  "Free online audio to MIDI converter. Convert MP3, WAV, FLAC & more into editable MIDI notes — presets for vocals, piano, bass & guitar. No sign-up.";

const OG_IMAGE = ogForTool("audio-to-midi", "Audio to MIDI Converter");

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/audio-to-midi` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/audio-to-midi`,
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
  name: "Audio to MIDI Converter",
  url: `${SITE_URL}/audio-to-midi`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "Automatic note transcription from MP3, WAV, FLAC, M4A, AAC, OGG, AIFF, Opus, and WebM",
    "Transcription presets for piano, vocal, bass, guitar, and fast passages",
    "Adjustable onset, frame, note-length, and frequency-range controls",
    "No sign-up required",
    "No download or software install required",
    "Downloads as a standard .mid file for any DAW",
  ],
};

// BreadcrumbList comes from <Breadcrumb />; FAQPage from <FAQSection />.

const SUPPORTED_FORMATS = ["MP3", "WAV", "FLAC", "M4A", "AAC", "OGG", "AIFF", "OPUS", "WEBM"];

// NOTE: verify these preset blurbs against the actual copy in
// AudioToMidiForm.tsx so the page and the in-app UI don't drift apart.
const PRESETS = [
  {
    name: "Balanced",
    desc: "A general-purpose starting point that works reasonably well across most recordings before you fine-tune anything.",
  },
  {
    name: "Piano & keys",
    desc: "Uses the full keyboard range with settings suited to faster passages. Dense polyphonic chords are still the hardest case for any automatic transcription, so results improve if you isolate the part first.",
  },
  {
    name: "Vocal & lead",
    desc: "Tuned for a single vocal or lead instrument line, favoring sustained notes over rapid note changes.",
  },
  {
    name: "Bass",
    desc: "Focuses detection on the lower register to reduce interference from higher-frequency instruments in the mix.",
  },
  {
    name: "Guitar",
    desc: "A starting point for single-note guitar lines and passages across the instrument's typical range.",
  },
  {
    name: "Arps & fast runs",
    desc: "More sensitive onset detection to capture short, rapidly changing notes — at the cost of potentially picking up extra false notes from noise.",
  },
];

const DIFFICULTY_TIERS = [
  {
    title: "Usually easiest",
    items: ["Single melody", "Vocal or lead line", "Clean isolated bassline", "One instrument on its own"],
  },
  {
    title: "More difficult",
    items: ["Piano or guitar chords", "Dense arrangements", "Full songs", "Multiple instruments playing at once"],
  },
  {
    title: "Not a good fit",
    items: ["Drums", "Unpitched percussion", "Heavily distorted or noisy recordings"],
  },
];

const ADVANCED_SETTINGS = [
  {
    label: "Onset sensitivity",
    desc: "Controls how easily the converter registers a new note attack. Higher sensitivity catches more note onsets but can also pick up extra notes from noise or artifacts.",
  },
  {
    label: "Frame sensitivity",
    desc: "Controls how easily a detected note is judged to be continuing. Adjusting this can help preserve sustained notes or stop notes from ringing on longer than they should.",
  },
  {
    label: "Minimum note length",
    desc: "Filters out very short detected notes. Raising it reduces false positives and noise; lowering it preserves fast musical passages.",
  },
  {
    label: "Frequency range",
    desc: "Limits detection to a chosen pitch range — useful for cutting low-frequency rumble or high-frequency interference when you're targeting a specific instrument.",
  },
];

const SOURCE_TYPES = [
  { name: "Vocal to MIDI", desc: "A sung or hummed melody, using the Vocal & lead preset." },
  {
    name: "Piano to MIDI",
    desc: "Keyboard recordings — single lines transcribe more reliably than dense chords.",
  },
  {
    name: "Guitar to MIDI",
    desc: "Clean single-note lines are a simpler target than heavily processed or chord-heavy parts.",
  },
  { name: "Bass to MIDI", desc: "The Bass preset focuses detection on the lower register." },
];

const DAWS = ["Ableton Live", "FL Studio", "Logic Pro", "GarageBand", "Cubase", "Studio One", "Reaper"];

const DAW_IMPORTS = [
  {
    name: "FL Studio",
    desc: "Drag the .mid straight onto the playlist, or use File \u2192 Import \u2192 MIDI file. Each track lands on its own pattern, ready to point at a channel.",
  },
  {
    name: "Ableton Live",
    desc: "Drag the .mid into a MIDI track in Session or Arrangement view. Live creates one clip per track and keeps the original tempo mapping.",
  },
  {
    name: "Logic Pro",
    desc: "File \u2192 Import \u2192 MIDI File, or drag it into the tracks area. Logic offers to create a software instrument track per MIDI track.",
  },
  {
    name: "GarageBand, Cubase, Studio One and Reaper",
    desc: "All accept a standard .mid by drag and drop. The file carries note, timing and program data, so nothing needs converting first.",
  },
];

export default async function AudioToMidiPage() {
  const relatedTools = getRelatedTools("audio-to-midi", 5);
  /**
   * Read server-side and cached, never from the browser — one client request
   * across ~90 static pages is the shape of problem that already caused a
   * Vercel Edge Request incident here.
   */
  const { midiHqEnabled } = await getFeatureFlags();
  /**
   * TWO SEPARATE QUESTIONS, and this used to conflate them.
   *
   * `midiHqEnabled` answers CAN this tool run — the kill switch; false means
   * a 503. `paywall_tools["audio-to-midi-hq"]` answers DOES IT COST a credit.
   * Gating visibility on the paywall flag meant turning off charging hid the
   * tool rather than making it free, so the free-flow test couldn't be run.
   *
   * Visibility comes from here. The "1 credit" badge and the 402 gate come
   * from the paywall flag, resolved per visitor inside the form.
   */
  const midiHqAvailable = midiHqEnabled;

  const faqs: FAQItem[] = [
    {
      question: "How do I convert an MP3 to MIDI?",
      answer:
        "Upload the MP3 above and it's analyzed for note onsets and pitch, then a downloadable MIDI file is generated — no conversion software or plugin needed.",
    },
    {
      question: "Can I convert a WAV file to MIDI?",
      answer:
        "Yes — WAV, along with FLAC, M4A, AAC, OGG, AIFF, Opus, and WebM, are all accepted directly. There's no need to convert to a different format first.",
    },
    {
      question: "Is this audio to MIDI converter really free?",
      answer:
        "Yes, completely free, with no sign-up. Because transcription is processing-intensive, it's rate-limited per person to keep it available for everyone.",
    },
    {
      question: "What audio formats are supported?",
      answer:
        "MP3, WAV, FLAC, M4A, AAC, OGG, AIFF, Opus, and WebM. Uploads can run from 1 second up to 10 minutes long.",
    },
    {
      question: "Which preset should I use?",
      answer:
        "Match the preset to your source: Vocal & lead for a sung or hummed melody, Piano & keys for keyboard recordings, Bass for basslines, Guitar for single-note guitar lines, and Arps & fast runs for quick, rapidly changing notes. Balanced is a reasonable default if you're not sure.",
    },
    {
      question: "Can I convert vocals to MIDI?",
      answer:
        "Yes — a single sung or hummed line is one of the easier cases for automatic transcription. Use the Vocal & lead preset for the most reliable results.",
    },
    {
      question: "Can I convert piano, guitar, or bass to MIDI?",
      answer:
        "Yes, each has a dedicated preset. Single-note lines and basslines transcribe most reliably; dense chords on piano or guitar are a genuinely harder detection problem and may need manual cleanup afterward.",
    },
    {
      question: "Can I convert a full song to MIDI?",
      answer:
        "You can upload one, but results will be far less clean than a single isolated instrument or vocal, since multiple overlapping pitches have to be separated at once. Isolating the part you care about first — with a stem separator, for example — will give a much more usable result.",
    },
    {
      question: "Why does my MIDI file have missing or extra notes?",
      answer:
        "Automatic transcription detects notes from audio rather than reading them directly, so it can miss quiet or overlapping notes, or pick up short false positives from noise. The Advanced settings let you raise or lower onset and frame sensitivity, set a minimum note length to filter spurious blips, and narrow the frequency range to the part you're transcribing.",
    },
    {
      question: "What do the Advanced settings actually control?",
      answer:
        "Onset and frame sensitivity control how easily a note is registered as starting or continuing. Minimum note length filters out short spurious blips. Frequency range ignores pitches outside a range you set.",
      answerNode: (
        <>
          Onset and frame sensitivity control how easily a note is registered
          as starting or continuing. Minimum note length filters out short
          spurious blips. Frequency range ignores pitches outside a range you
          set, useful for cutting rumble or hiss from a part you&apos;re not
          trying to capture. For the fuller breakdown, see{" "}
          <Link href="/guides/how-audio-to-midi-transcription-works" className="text-amber-400 hover:underline">
            How Audio to MIDI Transcription Actually Works
          </Link>
          .
        </>
      ),
    },
    {
      question: "Can I use the MIDI file in Ableton, FL Studio, or Logic?",
      answer:
        "Yes. The download is a standard .mid file that opens in any MIDI-compatible DAW, where you can reassign it to a different instrument, quantize it, or use it as a starting point for a new arrangement.",
    },
    {
      question: "Do I need to sign up or install anything?",
      answer:
        "No. Upload a track in your browser, wait for processing, and download the MIDI file directly. No app, plugin, or account required.",
    },
    {
      question: "How do I convert a melody or vocal to MIDI accurately?",
      answer:
        "Upload the clip and choose High accuracy. It follows a sung or played melody line far more closely than the standard detector, holding pitch through sustained notes and picking up quieter ones. An isolated melody transcribes better than the same line inside a full mix, so separate it first if you can.",
    },
    {
      question: "Which audio to MIDI converter is most accurate?",
      answer:
        "Accuracy depends far more on the source than the converter: one clean instrument or voice transcribes well, a dense mix does not. AudioForges runs two engines — a standard detector that is free and unlimited, and a high-accuracy mode for melodies, vocals, guitar and multi-instrument material. The comparison at the top of this page plays the same clip through both so you can judge before uploading anything.",
    },
    {
      question: "Can I convert a guitar riff to MIDI?",
      answer:
        "Yes. Guitar is the hardest common case, because strings ring into each other and every note carries harmonics a detector can mistake for extra notes. High accuracy routes guitar to an engine tuned for it, which removes those ghost notes automatically, and can isolate the guitar from a full mix first if the riff isn't already on its own.",
    },
    {
      question: "What's the maximum audio length and file size?",
      answer: "Uploads can run from 1 second up to 10 minutes long.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb
            items={[{ name: "Tools", href: "/tools" }, { name: "Audio to MIDI Converter" }]}
          />
        }
        title="Audio to MIDI Converter"
        lede="Convert MP3, WAV, FLAC, M4A and more to MIDI, free. Automatic note, pitch, and timing detection — with presets for vocals, piano, bass, and guitar."
        tool={<AudioToMidiForm hqAvailable={midiHqAvailable} />}
      >
        {/*
          THE PROOF, AND IT SITS FIRST ON PURPOSE.

          "High accuracy" is an adjective until someone hears it. Three static
          clips — source, standard render, high-accuracy render — cost nothing
          per view and answer the one question a visitor cannot answer from
          copy. It also serves the queries this page already half-ranks for
          ("accurate mp3 to midi", "best audio to midi converter"), which are
          comparison queries a comparison answers better than prose.

          MidiCompare returns null until all three files exist, so this is safe
          to ship ahead of the clips.
        */}
        <MidiCompare
          originalSrc="/demo/midi/melody-original.mp3"
          standardSrc="/demo/midi/melody-standard.mp3"
          hqSrc="/demo/midi/melody-hq.mp3"
          sourceLabel="Sung melody"
          trackLabel="One vocal line, transcribed both ways"
        />

        {/* Was three separate bordered cards; every other tool page uses the
            one-strip treatment. */}
        <FeatureStrip
          features={[
            { title: "MP3 & WAV support", desc: "Plus FLAC, M4A, AAC, OGG, AIFF, Opus, and WebM." },
            { title: "No install", desc: "Upload, transcribe, download. Nothing to install." },
            { title: "Free", desc: "No sign-up, no watermark, free for everyone." },
          ]}
        />

        {/* The six presets were six bordered cards. They're name/description
            pairs — the dl renders them as a spec table with no boxes. */}
        <ToolSection id="presets" title="Choose a transcription preset">
          <p>
            Different instruments and sources behave differently, so the
            converter includes presets tuned for common cases. Pick the closest
            match to your source, or switch to Custom and adjust the detection
            yourself.
          </p>
          <dl>
            {PRESETS.map((p) => (
              <Fragment key={p.name}>
                <dt>{p.name}</dt>
                <dd>{p.desc}</dd>
              </Fragment>
            ))}
          </dl>
        </ToolSection>

        <ToolSection id="how-to" title="How to convert audio to MIDI">
          <ol>
            <li>
              <strong>Upload an audio file.</strong> MP3, WAV, FLAC, M4A, AAC,
              OGG, AIFF, Opus, or WebM, from 1 second up to 10 minutes.
            </li>
            <li>
              <strong>Choose a preset.</strong> Match it to your source, or
              adjust the detection manually.
            </li>
            <li>
              <strong>Generate the MIDI.</strong> The converter analyzes the
              recording for note onsets and pitch and builds MIDI note data from
              it.
            </li>
            <li>
              <strong>Download and edit.</strong> Open the .mid file in your DAW
              to edit, reassign, or quantize the transcribed notes.
            </li>
          </ol>
        </ToolSection>

        <ToolSection id="what-is-it" title="What is an audio to MIDI converter?">
          <p>
            An audio to MIDI converter analyzes a finished recording and
            reconstructs the note-and-timing information behind it — which
            pitches were played, when they started, and how long they lasted —
            as a standard MIDI file. Unlike converting between two audio
            formats, this isn&apos;t a straightforward re-encode: it has to
            detect musical notes from a waveform that never had that
            information attached to begin with.
          </p>
          <p>
            AudioForges analyzes the uploaded recording for note onsets and
            pitch and builds a standard .mid file you can edit, rearrange, or
            reassign to a different instrument in a DAW. If you want to
            understand exactly how note detection, onset detection, and
            frequency filtering work, see our guide to{" "}
            <Link href="/guides/how-audio-to-midi-transcription-works">
              How Audio to MIDI Transcription Works
            </Link>
            .
          </p>
        </ToolSection>

        <ToolSection id="mp3" title="Convert MP3 to MIDI">
          <p>
            Upload an MP3 directly — there&apos;s no need to convert it to
            another format first. Because MP3 is a lossy format, very heavily
            compressed files can lose some of the detail the detector relies on
            for accurate pitch detection, so a cleaner-source MP3 will generally
            transcribe more reliably than a heavily compressed one.
          </p>
        </ToolSection>

        <ToolSection id="wav" title="Convert WAV to MIDI">
          <p>
            WAV files upload the same way, with no extra step. Since WAV is
            uncompressed, a WAV export straight from a DAW or a sample library
            generally gives the detector the cleanest possible signal to work
            from — useful if you&apos;re transcribing your own recordings rather
            than a finished, already-compressed track.
          </p>
        </ToolSection>

        <ToolSection id="sources" title="What can you convert to MIDI?">
          <p>
            Producers use this to pull a melody or bassline from a reference
            track and rebuild it with a different instrument; songwriters turn a
            hummed or sung idea into editable note data; students use a rough
            transcription as a head start on sheet music. A few common cases:
          </p>
          <dl>
            {SOURCE_TYPES.map((s) => (
              <Fragment key={s.name}>
                <dt>{s.name}</dt>
                <dd>{s.desc}</dd>
              </Fragment>
            ))}
          </dl>
        </ToolSection>

        <ToolSection id="accuracy" title="How accurate is audio to MIDI conversion?" bleed>
          <Prose>
            <p>
              Audio-to-MIDI conversion is an estimation process, not a direct
              extraction of MIDI data, and the quality of the result depends
              heavily on the recording. A clean, isolated melody or vocal line is
              generally easier to transcribe than a dense full-band recording
              with several overlapping instruments. Background noise, reverb,
              distortion, and other instruments sharing the same frequency range
              can all cause missing or extra notes. For a deeper look at why
              isolated melodies transcribe more reliably than dense mixes, see{" "}
              <Link href="/guides/how-audio-to-midi-transcription-works">
                How Audio to MIDI Transcription Works
              </Link>
              .
            </p>
          </Prose>

          {/* Genuinely three parallel columns rather than term/description
              pairs, so this keeps a grid — but as one bordered strip with
              hairline dividers, matching the feature strip above. */}
          <div className="mt-6 grid divide-y divide-graphite-800 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {DIFFICULTY_TIERS.map((tier) => (
              <div key={tier.title} className="p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-400">
                  {tier.title}
                </p>
                <ul className="mt-2.5 space-y-1.5 text-sm leading-relaxed text-text-muted">
                  {tier.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </ToolSection>

        {midiHqAvailable && (
          /*
            RETARGETED 2026-09-01. Was "Multi-track MIDI", written for
            "multitrack midi" / "separate instruments to midi" — neither search
            console has ever recorded a single impression for those. What the
            data does show is melody, vocal and accuracy language, so the
            section leads with that and keeps the split as a second benefit.

            Still additive and still below the ranking content: nothing above
            this point moves while the page holds its Bing positions.

            Renders nothing while the tool is off, so the page can't advertise
            something a visitor cannot buy.
          */
          <ToolSection id="high-accuracy" title="High-accuracy transcription: one model per instrument">
            <p>
              The standard converter runs one general-purpose detector and returns
              every note it finds in a single track. High accuracy uses a
              dedicated model for each kind of part instead. Piano goes to a
              model trained only on piano. Guitar goes to an engine tuned for
              riffs, chords and arpeggios that strips the string harmonics and
              doubled attacks that usually turn a clean riff into a cloud of
              stray notes. Both can pull their instrument out of a mix first if
              the recording is not a solo.
            </p>
            <p>
              Full mix does the whole arrangement. The track is split into stems
              first — bass, piano, guitar, vocals and everything else — and each
              stem is transcribed by the model best at it. You get one MIDI
              track per instrument, named and with a General MIDI program
              assigned, and the detected BPM written in as the tempo so the notes
              sit on the grid when you drop the file into a DAW.
            </p>
            <p>
              It is worth being straight about what comes back well and what
              does not. Bass lines, piano parts and sung melodies come out
              cleanest. Guitar is good on clear riffs and rougher on heavily
              distorted or layered parts. Synth leads, pads and everything that
              ends up in the &ldquo;other&rdquo; stem are the hardest for any
              transcription model, ours included — expect that track to need
              the most editing. If your source is a single instrument, pick that
              instrument rather than full mix; if it is a simple melody, the free
              converter is probably enough and costs nothing.
            </p>
            <p>
              High accuracy runs on GPU time that costs real money per job. Piano
              and guitar use one credit; a full mix — one separation plus up to
              four transcriptions — uses three. Everyone gets free runs each
              month, nothing recurs, and standard transcription stays free and
              unlimited.{" "}
              <Link href="/pricing">See what credits cost</Link>.
            </p>
          </ToolSection>
        )}

        <ToolSection id="tips" title="Tips for better results">
          <ul>
            <li>Use a clean, isolated recording where possible.</li>
            <li>Prefer WAV over MP3 if you have the original file.</li>
            <li>For a full song, isolate the part you want first.</li>
            <li>Try the matching preset before adjusting settings manually.</li>
            <li>Narrow the frequency range to cut out unrelated instruments.</li>
            <li>Raise minimum note length if you&apos;re getting lots of tiny false notes.</li>
          </ul>
        </ToolSection>

        <ToolSection id="advanced" title="Advanced transcription settings">
          <p>
            Presets are a starting point — the underlying controls are available
            directly if you want to fine-tune the transcription yourself.
          </p>
          <dl>
            {ADVANCED_SETTINGS.map((s) => (
              <Fragment key={s.label}>
                <dt>{s.label}</dt>
                <dd>{s.desc}</dd>
              </Fragment>
            ))}
          </dl>
        </ToolSection>

        {/*
          The bare DAW list was already this page's best-ranking content on
          Google without a word written for it — "fl studio mp3 to midi",
          "convert mp3 to midi fl studio" and "live audio to midi" all sit
          20-40 positions ahead of the head terms. Someone searching those
          wants to know how the file lands in their DAW, which the list never
          told them.
        */}
        <ToolSection id="daws" title="Use your MIDI in any DAW">
          <p>
            The downloaded .mid file imports into any MIDI-compatible music
            software. Open it to edit the notes, change the instrument, adjust
            timing, quantize the performance, or use the transcription as a
            starting point for a new arrangement — including {DAWS.join(", ")}.
          </p>
          <dl>
            {DAW_IMPORTS.map((d) => (
              <Fragment key={d.name}>
                <dt>{d.name}</dt>
                <dd>{d.desc}</dd>
              </Fragment>
            ))}
          </dl>
        </ToolSection>

        <ToolSection id="formats" title="Supported audio formats" bleed>
          <div className="flex flex-wrap gap-2">
            {SUPPORTED_FORMATS.map((format) => (
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
              Upload any of the formats above, from 1 second up to 10 minutes
              long. The output is a standard .mid file, downloaded with the same
              filename as your original upload.
            </p>
          </Prose>
        </ToolSection>

        <ToolVideo slug="audio-to-midi" />

        <RelatedToolsGrid tools={relatedTools} />

        {/* h3, not h2: this is a footnote under the page's content, and as an
            h2 it sat in the outline alongside the real sections. */}
        <section className="rounded-xl border border-graphite-800 bg-graphite-900 p-5">
          <h3 className="font-semibold text-text-primary">Copyright &amp; fair use</h3>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            You are responsible for ensuring you have the right to process any track
            you upload — for personal practice, content you own, or material you have
            permission to use. AudioForges does not host or distribute the tracks
            processed through this tool.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            See our{" "}
            <Link href="/about" className="text-amber-400 hover:underline">
              About
            </Link>
            ,{" "}
            <Link href="/privacy" className="text-amber-400 hover:underline">
              Privacy
            </Link>
            , and{" "}
            <Link href="/terms" className="text-amber-400 hover:underline">
              Terms
            </Link>{" "}
            pages for more on how AudioForges handles uploaded files.
          </p>
        </section>

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}