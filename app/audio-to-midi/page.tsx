import type { Metadata } from "next";
import Link from "next/link";
import { AudioToMidiForm } from "@/components/converter/AudioToMidiForm";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

const PAGE_TITLE = "Audio to MIDI Converter – MP3 & WAV to MIDI | AudioForges";
const PAGE_DESCRIPTION =
  "Convert MP3, WAV, FLAC, M4A and more to MIDI online for free. Transcribe melodies, vocals, bass, piano, and guitar into editable MIDI notes. No sign-up or software install.";

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
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/images/og-default.png"],
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

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Audio to MIDI Converter", item: `${SITE_URL}/audio-to-midi` },
  ],
};

const SUPPORTED_FORMATS = ["MP3", "WAV", "FLAC", "M4A", "AAC", "OGG", "AIFF", "OPUS", "WEBM"];

function FormatBadges() {
  return (
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
  );
}

// NOTE: verify these preset blurbs against the actual copy in AudioToMidiForm.tsx
// so the marketing page and the in-app UI don't drift apart over time.
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

const DAWS = ["Ableton Live", "FL Studio", "Logic Pro", "GarageBand", "Cubase", "Studio One", "Reaper"];

export default function AudioToMidiPage() {
  const relatedTools = getRelatedTools("audio-to-midi", 5);

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
      question: "What's the maximum audio length and file size?",
      answer: "Uploads can run from 1 second up to 10 minutes long.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Audio to MIDI Converter
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Upload an MP3, WAV, FLAC, M4A, AAC, OGG, AIFF, Opus, or WebM file
            and automatically transcribe its notes, pitch, and timing into a
            standard MIDI file. Choose a preset for vocals, piano, bass, or
            guitar, or fine-tune the detection yourself. No sign-up or
            software install required.
          </p>
        </header>

        <AudioToMidiForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "MP3 & WAV support", desc: "Plus FLAC, M4A, AAC, OGG, AIFF, Opus, and WebM." },
            { title: "No install", desc: "Process audio online — upload, transcribe, download. Nothing to install." },
            { title: "Free", desc: "No sign-up, no watermark, free for everyone." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <p className="font-semibold text-text-primary">{f.title}</p>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Choose a transcription preset</h2>
          <p className="text-text-muted leading-relaxed">
            Different instruments and sources behave differently, so the
            converter includes presets tuned for common cases. Pick the
            closest match to your source, or switch to Custom and adjust the
            detection yourself.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {PRESETS.map((p) => (
              <div key={p.name} className="rounded-xl border border-graphite-800 bg-graphite-900 p-4 space-y-1">
                <p className="font-semibold text-text-primary">{p.name}</p>
                <p className="text-sm text-text-muted leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to convert audio to MIDI</h2>
          <ol className="space-y-3 text-text-muted leading-relaxed list-decimal list-inside">
            <li>
              <span className="text-text-primary font-medium">Upload an audio file.</span> MP3, WAV, FLAC, M4A,
              AAC, OGG, AIFF, Opus, or WebM, from 1 second up to 10 minutes.
            </li>
            <li>
              <span className="text-text-primary font-medium">Choose a preset.</span> Match it to your source, or
              adjust the detection manually.
            </li>
            <li>
              <span className="text-text-primary font-medium">Generate the MIDI.</span> The converter analyzes the
              recording for note onsets and pitch and builds MIDI note data
              from it.
            </li>
            <li>
              <span className="text-text-primary font-medium">Download and edit.</span> Open the .mid file in your
              DAW to edit, reassign, or quantize the transcribed notes.
            </li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What is an audio to MIDI converter?</h2>
          <p className="text-text-muted leading-relaxed">
            An audio to MIDI converter analyzes a finished recording and
            reconstructs the note-and-timing information behind it — which
            pitches were played, when they started, and how long they lasted
            — as a standard MIDI file. Unlike converting between two audio
            formats, this isn&apos;t a straightforward re-encode: it has to
            detect musical notes from a waveform that never had that
            information attached to begin with.
          </p>
          <p className="text-text-muted leading-relaxed">
            AudioForges analyzes the uploaded recording for note onsets and
            pitch and builds a standard .mid file you can edit, rearrange, or
            reassign to a different instrument in a DAW. If you want to
            understand exactly how note detection, onset detection, and
            frequency filtering work, see our guide to{" "}
            <Link href="/guides/how-audio-to-midi-transcription-works" className="text-amber-400 hover:underline">
              How Audio to MIDI Transcription Works
            </Link>
            .
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Convert MP3 to MIDI</h2>
          <p className="text-text-muted leading-relaxed">
            Upload an MP3 directly — there&apos;s no need to convert it to
            another format first. Because MP3 is a lossy format, very
            heavily compressed files can lose some of the detail the
            detector relies on for accurate pitch detection, so a
            cleaner-source MP3 will generally transcribe more reliably than a
            heavily compressed one.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Convert WAV to MIDI</h2>
          <p className="text-text-muted leading-relaxed">
            WAV files upload the same way, with no extra step. Since WAV is
            uncompressed, a WAV export straight from a DAW or a sample
            library generally gives the detector the cleanest possible
            signal to work from — useful if you&apos;re transcribing your own
            recordings rather than a finished, already-compressed track.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What can you convert to MIDI?</h2>
          <p className="text-text-muted leading-relaxed">
            Producers use this to pull a melody or bassline from a reference
            track and rebuild it with a different instrument; songwriters
            turn a hummed or sung idea into editable note data; students use
            a rough transcription as a head start on sheet music. A few
            common cases:
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-graphite-800 bg-graphite-900 p-4 space-y-1">
              <p className="font-semibold text-text-primary">Vocal to MIDI</p>
              <p className="text-sm text-text-muted">
                A sung or hummed melody, using the Vocal &amp; lead preset.
              </p>
            </div>
            <div className="rounded-xl border border-graphite-800 bg-graphite-900 p-4 space-y-1">
              <p className="font-semibold text-text-primary">Piano to MIDI</p>
              <p className="text-sm text-text-muted">
                Keyboard recordings — single lines transcribe more reliably
                than dense chords.
              </p>
            </div>
            <div className="rounded-xl border border-graphite-800 bg-graphite-900 p-4 space-y-1">
              <p className="font-semibold text-text-primary">Guitar to MIDI</p>
              <p className="text-sm text-text-muted">
                Clean single-note lines are a simpler target than heavily
                processed or chord-heavy parts.
              </p>
            </div>
            <div className="rounded-xl border border-graphite-800 bg-graphite-900 p-4 space-y-1">
              <p className="font-semibold text-text-primary">Bass to MIDI</p>
              <p className="text-sm text-text-muted">
                The Bass preset focuses detection on the lower register.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How accurate is audio to MIDI conversion?</h2>
          <p className="text-text-muted leading-relaxed">
            Audio-to-MIDI conversion is an estimation process, not a direct
            extraction of MIDI data, and the quality of the result depends
            heavily on the recording. A clean, isolated melody or vocal line
            is generally easier to transcribe than a dense full-band
            recording with several overlapping instruments. Background
            noise, reverb, distortion, and other instruments sharing the
            same frequency range can all cause missing or extra notes. For a
            deeper look at why isolated melodies transcribe more reliably
            than dense mixes, see{" "}
            <Link href="/guides/how-audio-to-midi-transcription-works" className="text-amber-400 hover:underline">
              How Audio to MIDI Transcription Works
            </Link>
            .
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {DIFFICULTY_TIERS.map((tier) => (
              <div key={tier.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-4">
                <p className="font-semibold text-text-primary mb-2">{tier.title}</p>
                <ul className="text-sm text-text-muted space-y-1 list-disc list-inside">
                  {tier.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Tips for better results</h2>
          <ul className="text-text-muted leading-relaxed space-y-2 list-disc list-inside">
            <li>Use a clean, isolated recording where possible.</li>
            <li>Prefer WAV over MP3 if you have the original file.</li>
            <li>For a full song, isolate the part you want first.</li>
            <li>Try the matching preset before adjusting settings manually.</li>
            <li>Narrow the frequency range to cut out unrelated instruments.</li>
            <li>Raise minimum note length if you're getting lots of tiny false notes.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Advanced transcription settings</h2>
          <p className="text-text-muted leading-relaxed">
            Presets are a starting point — the underlying controls are
            available directly if you want to fine-tune the transcription
            yourself.
          </p>
          <div className="space-y-3">
            {ADVANCED_SETTINGS.map((s) => (
              <div key={s.label} className="rounded-xl border border-graphite-800 bg-graphite-900 p-4">
                <p className="font-semibold text-text-primary">{s.label}</p>
                <p className="text-sm text-text-muted mt-1 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Use your MIDI in any DAW</h2>
          <p className="text-text-muted leading-relaxed">
            The downloaded .mid file imports into any MIDI-compatible music
            software. Open it to edit the notes, change the instrument,
            adjust timing, quantize the performance, or use the transcription
            as a starting point for a new arrangement — including{" "}
            {DAWS.join(", ")}.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Supported audio formats</h2>
          <FormatBadges />
          <p className="text-text-muted leading-relaxed">
            Upload any of the formats above, from 1 second up to 10 minutes
            long. The output is a standard .mid file, downloaded with the
            same filename as your original upload.
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

        <section className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
          <h2 className="font-semibold text-text-primary">Copyright &amp; fair use</h2>
          <p className="text-sm text-text-muted leading-relaxed">
            You are responsible for ensuring you have the right to process any track
            you upload — for personal practice, content you own, or material you have
            permission to use. AudioForges does not host or distribute the tracks
            processed through this tool.
          </p>
          <p className="text-sm text-text-muted leading-relaxed">
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
      </main>
    </>
  );
}