import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Prose } from "@/components/ui/Prose";
import { CompareTable } from "@/components/tools/CompareTable";
import { MAX_BATCH_FILES } from "@/lib/data/key-finder";
import { ogForGuide } from "@/lib/og";

const guide = getGuideBySlug("organise-a-dj-library-by-key-and-bpm")!;

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

export default function OrganiseDjLibraryGuidePage() {
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
            A library is organised when you can find a track that fits, in the dark, in ten seconds.
            Key and BPM on every file is what makes that possible. The work is mostly one afternoon,
            and most of the pain comes from doing it in the wrong order or doing it twice.
          </p>

          <h2 id="tags-or-filenames">Tags or filenames: decide this first</h2>
          <p>
            There are two places the data can live, and they behave differently. Getting this wrong
            is the main reason people redo the whole job.
          </p>
        </Prose>

        <div className="mt-6">
          <CompareTable
            columns={["In the tags", "In the filename"]}
            highlight={-1}
            rows={[
              {
                label: "What reads it",
                cells: [
                  { text: "Rekordbox, Serato, Traktor, engine software. They index tags on import and sort by them." },
                  { text: "Your file browser, USB sticks, anything that lists files. Every DJ program shows it too, because it is the name." },
                ],
              },
              {
                label: "Survives a copy",
                cells: [
                  { state: "yes", text: "Yes. Tags travel inside the file." },
                  { state: "yes", text: "Yes, unless something renames it." },
                ],
              },
              {
                label: "Visible before import",
                cells: [
                  { state: "no", text: "No. You have to open it in the software first." },
                  { state: "yes", text: "Yes. You see it in the folder." },
                ],
              },
              {
                label: "Format support",
                cells: [
                  { state: "partial", text: "MP3 and AIFF are reliable. WAV tagging is inconsistent between programs." },
                  { state: "yes", text: "Works on every format, because it is not in the file at all." },
                ],
              },
              {
                label: "Undo",
                cells: [
                  { state: "partial", text: "Rewrite the tag." },
                  { state: "yes", text: "Rename back. The audio was never touched." },
                ],
              },
            ]}
            footnote="Most people end up doing both: filenames so a folder is readable anywhere, tags so the DJ software sorts properly. If you only do one, do the one your software actually reads."
          />
        </div>

        <Prose className="mt-10">
          <h2 id="naming">A naming pattern that sorts correctly</h2>
          <p>
            If you go the filename route, put the data at the front, because file browsers sort from
            the left. The pattern worth using is key, then BPM, then the original name:
          </p>
          <p>
            <code>A minor - 128 - Artist - Track.wav</code>
          </p>
          <p>
            Key first groups compatible tracks together in the listing, which is the thing you are
            looking for mid-set. BPM second gives you the tempo without opening anything. Use the key
            name if you think in keys, or the Camelot code if you think in numbers, but pick one and
            keep it, because a folder with both is sorted by neither.
          </p>
          <p>
            One catch worth knowing: Camelot codes sort as text, so 10A lands between 1A and 2A in
            most file browsers. If that bothers you, pad to two digits, 01A, 02A, or use key names
            instead.
          </p>

          <h2 id="tag-the-crate">Tag the crate in one pass</h2>
          <p>
            Doing this track by track is why most people abandon it. Analyse the whole folder at once
            instead. The{" "}
            <Link href="/key-finder">Key &amp; BPM Finder</Link> takes up to {MAX_BATCH_FILES} files
            in a batch, runs them one after another, and gives you two exports when it finishes: a
            CSV of every result, and a ZIP of your original files renamed with their key and BPM in
            front. The ZIP is a copy operation, not a re-encode, so the audio is identical to what
            you put in.
          </p>
          <p>
            The CSV is the one to keep if your software reads tags. It has the filename, key, Camelot
            code, BPM and the confidence for each reading, so you can paste it into a spreadsheet, or
            work down it filling in the key and BPM fields in Rekordbox without re-analysing anything.
          </p>

          <h2 id="import">Getting it into your DJ software</h2>
          <p>
            Rekordbox, Serato and Traktor all analyse tracks themselves on import, and all three will
            write their own key and BPM. That is fine, and it is also why you should import once and
            then stop: analysing the same crate in two programs gives you two answers and no way to
            tell which one is in the file. Pick the program that plays the gig, let it own the tags,
            and use the filenames as the version you can read anywhere else.
          </p>
          <p>
            Where an automatic reading disagrees with your ears, trust your ears and correct it by
            hand. Every detector, including this one, gets some tracks wrong. Ours publishes how
            often: about 85% exact on BPM and around 50% on key, measured on a public test set. The
            usual failures are half or double the real tempo, and the relative major or minor instead
            of the key you expected, which are both quick to spot and quick to fix.
          </p>

          <h2 id="order">Use the tags, do not just collect them</h2>
          <p>
            Tagged data is only worth the afternoon if it changes how you build a set. Two habits make
            it pay:
          </p>
          <ul>
            <li>
              Sort by key, not by BPM, when you are looking for the next track. Tempo you can nudge;
              a key clash you cannot.
            </li>
            <li>
              Learn the three safe moves from wherever you are on the{" "}
              <Link href="/guides/camelot-wheel-harmonic-mixing">Camelot wheel</Link>: same number,
              other letter, one up, one down. That is most of harmonic mixing.
            </li>
          </ul>
          <p>
            Once the crate is tagged, the{" "}
            <Link href="/guides/dj-set-prep-checklist">set prep checklist</Link> covers the ordering
            work: grouping by key family, planning the deliberate jumps, and cutting to length.
          </p>

          <h2 id="maintain">Keep it from rotting</h2>
          <p>
            The library falls apart at the edges, not in the middle. New tracks arrive untagged and
            sit in a downloads folder for a month. Two rules keep that from happening: nothing enters
            the library untagged, and new tracks get batched once a week rather than one at a time.
            A weekly batch of ten files takes a couple of minutes and is the difference between a
            library you trust and one you have to re-do next year.
          </p>
        </Prose>

        <div className="mt-10 border-t border-graphite-800 pt-8">
          <Link href="/key-finder" className={buttonStyles({ size: "lg" })}>
            Tag a crate with the Key &amp; BPM Finder
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}