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

const guide = getGuideBySlug("bpm-detection-tempocnn")!;

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

// Exact = within 3% of the labelled tempo (MIREX Accuracy 1). Numbers marked
// CONFIRM are filled from `python eval_keybpm.py <csv>` + `tune_bpm_policy.py`.
const RESULTS = [
  ["Single detector", "Essentia RhythmExtractor2013 (degara)", "42%"],
  ["DSP consensus + tuned window", "degara + librosa + Percival, metrical-ratio voting", "65%"],
  ["Pretrained model", "TempoCNN (deeptemp-k16-3) via essentia-tensorflow", "85%"],
];

export default function BpmDetectionTempoCnnGuidePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <Breadcrumb
          items={[{ name: "Guides", href: "/guides" }, { name: guide.title }]}
          className="mb-8"
        />

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
            The <Link href="/key-finder">key &amp; BPM finder</Link> on this site started life
            with a single tempo detector that got the exact BPM right on 42% of the GiantSteps
            tempo set. It now gets 85%. This is the write-up of how it got there — three
            distinct stages, one dead end, and the part that&apos;s still broken. Every number
            here comes from the same evaluation script, and the script is in the repo, so you
            can reproduce all of it.
          </p>

          <h2 id="metric">How &quot;accurate&quot; is measured, before any numbers</h2>
          <p>
            Tempo accuracy figures are easy to inflate, so the metric comes first. The test set
            is the GiantSteps tempo dataset — EDM tracks with human-verified BPM labels, and
            deliberately the hard case, because electronic music is where detectors fail most.
          </p>
          <p>
            A prediction counts as <strong>exact</strong> if it&apos;s within 3% of the labelled
            tempo. It counts as <strong>octave</strong> if it&apos;s within 3% of the label
            multiplied by a metrical ratio — 2, ½, 1.5, ⅔, 3, ⅓, 4⁄3, or ¾. That&apos;s the
            standard MIREX split: Accuracy 1 is exact, Accuracy 2 is exact-or-octave.
          </p>
          <p>
            Everything below reports <strong>exact</strong>. The lenient number is much higher
            and much less useful: a detector that reads 87 for a 174 BPM drum &amp; bass track is
            &quot;octave-correct&quot; and, to a DJ, simply wrong. If you only ever see a tempo
            detector quote one accuracy figure, it&apos;s worth asking which one.
          </p>

          <h2 id="stage-1">Stage 1 — one detector: 42%</h2>
          <p>
            The first version used Essentia&apos;s <code>RhythmExtractor2013</code> with the{" "}
            <code>degara</code> method. It&apos;s fast, it&apos;s the default everyone reaches
            for, and it has one property worth knowing up front: the confidence it returns is
            always zero. <code>degara</code> doesn&apos;t produce a real confidence, so anything
            built on it has to invent its own.
          </p>
          <p>
            More importantly, its errors weren&apos;t random. They were almost all the same
            error: locking onto the half-time pulse of fast genres. Drum &amp; bass at 174
            reads as roughly 87. Fast techno folds down the same way. The detector was hearing
            a real, strong periodicity — it was just the wrong metrical level. That diagnosis
            shaped everything that came next, because a systematic error is something you can
            correct for, where random error isn&apos;t.
          </p>

          <h2 id="stage-2">Stage 2 — three detectors and a tuned window: 65%</h2>
          <p>
            The next version ran three detectors and made them vote: Essentia <code>degara</code>{" "}
            (most trusted), librosa&apos;s tempo estimator on the percussive onset envelope
            after harmonic/percussive separation (second), and Essentia&apos;s Percival
            estimator (third). The reconciliation isn&apos;t a plain average — averaging 87 and
            174 gives you 130, which is worse than either. Instead:
          </p>
          <ul>
            <li>
              Anchor on the most trusted detector, then find every other reading that is
              <em> metrically linked</em> to it — within 4% of the anchor times one of the
              ratios above.
            </li>
            <li>
              If the two less-trusted detectors agree with each other and both disagree with
              the anchor, they outvote it. One confident wrong detector shouldn&apos;t win
              against two that independently agree.
            </li>
            <li>
              If the chosen tempo sits outside a preferred window, fold it by a metrical ratio
              until it lands inside — that&apos;s the half-time correction, applied explicitly.
            </li>
          </ul>
          <p>
            The window itself was not guessed. I swept the lower bound across the GiantSteps
            set and the scores held flat from about 92 BPM upward, so 95–185 was chosen as a
            bound that isn&apos;t knife-edge. It also happens to match how DJs and Beatport
            label those tracks — a 174 drum &amp; bass record is catalogued as 174, not 87.
          </p>
          <p>
            Confidence is derived from agreement rather than borrowed from any one detector:
            three in agreement scores 95, two scores 88, a folded or range-corrected answer
            scores 62. That&apos;s honest in a way <code>degara</code>&apos;s constant zero
            wasn&apos;t.
          </p>
          <p>
            This got to 65%, and then it hit a ceiling that&apos;s worth naming. A voting scheme
            can only choose among answers the detectors actually produced. Replaying the stored
            votes with an oracle that picks the best available answer per track shows the
            hard limit of this approach — and the DSP detectors simply weren&apos;t producing
            the right answer often enough for any voting rule to reach it.
          </p>

          <h2 id="dead-end">What didn&apos;t work: madmom</h2>
          <p>
            The obvious next step was madmom, whose RNN beat tracker has been the strong
            baseline in the tempo literature for years. It didn&apos;t make it in. madmom
            doesn&apos;t build against NumPy 2 or current Python, and pinning an old NumPy
            across a FastAPI service that also runs librosa, Essentia and a transcription stack
            wasn&apos;t a trade worth making for one dependency. It was ruled out on
            engineering grounds, not accuracy — if you can run it, it&apos;s good.
          </p>

          <h2 id="stage-3">Stage 3 — a pretrained model: 85%</h2>
          <p>
            What worked was Schreiber and Müller&apos;s TempoCNN, available pretrained through{" "}
            <code>essentia-tensorflow</code> as <code>deeptemp-k16-3</code>. It takes audio at
            11,025 Hz and returns a global tempo directly, no onset detection or periodicity
            search involved. Exact accuracy on the same set went from 65% to 85%.
          </p>
          <p>
            One design decision is worth stating because it&apos;s counter-intuitive: when
            TempoCNN is present, its answer is used outright. It is <em>not</em> blended into
            the vote with the DSP detectors. I tried that — replaying stored votes under every
            combination rule — and every policy that mixed it with the DSP readings scored
            lower than trusting it alone. The consensus machinery from Stage 2 is still there,
            but only as the fallback when the model isn&apos;t.
          </p>
          <p>
            The cost is real. <code>essentia-tensorflow</code> adds roughly 500 MB to the
            container image over plain <code>essentia</code>, and the model is loaded lazily
            on first use so it doesn&apos;t slow startup. And there&apos;s a trap: plain{" "}
            <code>essentia</code> silently lacks the TempoCNN algorithm. The import fails, the
            engine catches it as non-fatal and falls back to the DSP path, and nothing errors.
            You can believe you&apos;ve shipped TempoCNN and be running the 65% path. That
            fallback is deliberate — it&apos;s better than a 500 on every request — but it
            means the accuracy number has to be checked on the deployed image, not just in
            development.
          </p>

          <h2 id="results">Results</h2>
          <div className="my-6 overflow-x-auto rounded-xl border border-graphite-800 not-prose">
            <table className="w-full text-left text-sm text-text-muted">
              <caption className="sr-only">
                Exact BPM accuracy on the GiantSteps tempo set by detection stage
              </caption>
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Stage</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Method</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Exact (±3%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                {RESULTS.map(([stage, method, exact]) => (
                  <tr key={stage}>
                    <td className="px-4 py-3 text-text-primary">{stage}</td>
                    <td className="px-4 py-3">{method}</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-amber-400">{exact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Same dataset, same 3% tolerance, same script for every row. The jump from 65% to
            85% is the model; the jump from 42% to 65% is entirely the voting and the window,
            with no change in the underlying detectors.
          </p>

          <h2 id="still-broken">The part that&apos;s still broken: key detection</h2>
          <p>
            Tempo is the success story. Key is not, and it would be dishonest to bury that.
            Key detection uses Essentia&apos;s <code>KeyExtractor</code> on the harmonic
            component of the signal with the <code>bgate</code> key profile. That choice was
            measured — six profiles across three input signals on 40 GiantSteps tracks, where
            <code> bgate</code> on the harmonic component scored 20 of 40 and the more commonly
            recommended <code>edma</code> profile scored 16 of 40 on the same input. So the
            best configuration is right about half the time.
          </p>
          <p>
            The reason there&apos;s no Stage 3 for key is that there is no pretrained key model
            in Essentia to reach for the way there was for tempo. The current mitigation is a
            second opinion from a librosa profile match, with confidence penalised when the two
            disagree — which improves calibration but not the underlying accuracy.
          </p>
          <p>
            The lenient figure, where a relative major/minor is accepted as correct, is
            considerably higher. But it&apos;s the wrong figure for this use case: on the
            Camelot wheel, A minor and C major are different positions, and a DJ mixing
            harmonically will hear the difference. So the honest number is about 50%, and that
            is the open problem. If you know of a pretrained key-estimation model that runs
            without adding another gigabyte of dependencies, I would genuinely like to hear
            about it.
          </p>

          <h2 id="reproduce">Reproducing it</h2>
          <p>
            Two scripts in the backend repo do all of this. <code>eval_keybpm.py</code> runs
            the engine over a CSV of file paths and ground-truth labels and prints per-track
            hits plus the exact and exact-or-octave summaries. <code>tune_bpm_policy.py</code>{" "}
            then replays the stored per-detector votes under different selection rules — single
            detector, priority order, consensus, window folding, oracle — without touching audio
            again, so you can compare policies in seconds and pick one from data before
            changing the engine. That replay is how the &quot;don&apos;t blend TempoCNN&quot;
            decision was made.
          </p>
          <p>
            For the user-facing version of why a BPM sometimes reads as half or double, and
            why confidence varies between tracks, see{" "}
            <Link href="/guides/how-key-and-bpm-detection-works">
              how key and BPM detection works
            </Link>
            . To run the detector on your own audio, the{" "}
            <Link href="/key-finder">Key &amp; BPM Finder</Link> is free and needs no account.
          </p>
        </Prose>

        <div className="mt-10 border-t border-graphite-800 pt-8">
          <Link href="/key-finder" className={buttonStyles({ size: "lg" })}>
            Try the Key &amp; BPM Finder
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}