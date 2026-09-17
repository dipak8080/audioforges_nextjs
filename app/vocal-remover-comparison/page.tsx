import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { ToolSection } from "@/components/ui/ToolSection";
import { Prose } from "@/components/ui/Prose";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";
import { PageByline } from "@/components/tools/PageByline";
import { ComparisonPlayers } from "@/components/tools/ComparisonPlayers";
import { SITE_URL } from "@/lib/constants";
import { ogImage } from "@/lib/og";

const PATH = "/vocal-remover-comparison";
const PAGE_TITLE = "Best Free Vocal Remover 2026: One Clip Through Every Tool";
const PAGE_DESCRIPTION =
  "The same 50-second clip through AudioForges, UVR, VocalRemover.org and LALAL.AI. Every output playable, every model named, times and limits measured.";

const OG_IMAGE = ogImage(
  "Vocal Remover Comparison",
  "The same 50-second clip through every tool, every output playable",
  "Measured"
);

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}${PATH}` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}${PATH}`,
    siteName: "AudioForges",
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

const RESULTS = [
  {
    tool: "AudioForges Standard",
    model: "htdemucs",
    time: "25 sec",
    machine: "GPU (RTX A5000)",
    free: "Free runs, no sign-up",
  },
  {
    tool: "AudioForges Studio Quality",
    model: "MelBand RoFormer",
    time: "1 min 2 sec",
    machine: "GPU (RTX A5000)",
    free: "Free runs, then 1 credit",
  },
  {
    tool: "Ultimate Vocal Remover 5.6",
    model: "MDX23C-InstVoc HQ",
    time: "19 min 9 sec",
    machine: "i7-8750H laptop, CPU only",
    free: "Free, desktop install",
  },
  {
    tool: "VocalRemover.org",
    model: "Not disclosed",
    time: "~15 sec observed",
    machine: "Their servers",
    free: "1 free run per day",
  },
  {
    tool: "LALAL.AI",
    model: "Not verifiable without download",
    time: "No download on the free plan",
    machine: "Their servers",
    free: "Preview only",
  },
];

const FAQ_ITEMS: FAQItem[] = [
  {
    question: "Which vocal remover sounds best?",
    answer:
      "Judge with your own ears: every player on this page is the tool's unedited output from the same 50-second clip. The facts we can measure are printed in the table: which model each tool runs, how long the clip took, and what the free plan allows.",
  },
  {
    question: "Why did Ultimate Vocal Remover take 19 minutes?",
    answer:
      "UVR runs on your own machine. On a laptop without a usable NVIDIA GPU it falls back to CPU, and MDX23C took 19 minutes 9 seconds on our i7-8750H for the 50-second clip. On a desktop with a good NVIDIA GPU, UVR is many times faster than that. The trade is the same either way: excellent free quality in exchange for the install, the model downloads and your own hardware.",
  },
  {
    question: "What clip was used, and is it licensed?",
    answer:
      "A 50-second section of What Would It Mean by H4RRIS feat. Nicole Apollonio, used with the artist's permission and credited below. The exact same MP3 was uploaded to every tool on 17 September 2026.",
  },
];

export default function VocalRemoverComparisonPage() {
  return (
    <ToolPageShell
      breadcrumb={<Breadcrumb items={[{ name: "Vocal remover comparison", href: PATH }]} />}
      title="Every vocal remover, same clip, side by side"
      lede="One 50-second clip through AudioForges, Ultimate Vocal Remover, VocalRemover.org and LALAL.AI. Every output is playable below, unedited. Every model is named, every time and limit was measured on 17 September 2026."
      meta={["Same input for every tool", "Unedited outputs", "Measured and dated"]}
      tool={<ComparisonPlayers />}
    >
      <ToolSection eyebrow="Method" title="How this comparison was run">
        <Prose>
          <p>
            The clip is a 50-second section of a real release with a lead vocal over a full
            arrangement. The exact same MP3 was uploaded to each tool, nothing was re-recorded or
            trimmed differently per tool, and each output above is exactly what the tool returned,
            re-encoded to 192 kbps MP3 for the page. Where a tool names its model, the model is
            printed. Where it does not, that is printed too.
          </p>
          <p>
            LALAL.AI is listed without audio because its free plan plays a preview but does not
            let you download the result, so there is no file to publish. That was checked on the
            same day as everything else.
          </p>
        </Prose>
      </ToolSection>

      <ToolSection eyebrow="Measured" title="Models, times and limits" bleed>
        <div className="overflow-x-auto rounded-xl border border-graphite-800">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-graphite-800 bg-graphite-900">
                <th className="px-4 py-3 font-semibold text-text-primary">Tool</th>
                <th className="px-4 py-3 font-semibold text-text-primary">Model</th>
                <th className="px-4 py-3 font-semibold text-text-primary">Time for this clip</th>
                <th className="px-4 py-3 font-semibold text-text-primary">Ran on</th>
                <th className="px-4 py-3 font-semibold text-text-primary">Free plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-800">
              {RESULTS.map((row) => (
                <tr key={row.tool} className="bg-graphite-950/40">
                  <td className="px-4 py-3 font-medium text-text-primary">{row.tool}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">{row.model}</td>
                  <td className="px-4 py-3 text-text-muted">{row.time}</td>
                  <td className="px-4 py-3 text-text-muted">{row.machine}</td>
                  <td className="px-4 py-3 text-text-muted">{row.free}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm leading-relaxed text-text-muted">
          Times are end to end as a user experiences them, from submitting the clip to the result
          being playable, measured once each on 17 September 2026. UVR on a capable NVIDIA GPU is
          many times faster than the CPU figure shown; the laptop case is listed because that is
          the machine most people have. Try the same clip yourself on the{" "}
          <Link
            href="/vocal-remover"
            prefetch={false}
            className="text-amber-400 underline underline-offset-2 transition-colors hover:text-amber-300"
          >
            AudioForges vocal remover
          </Link>
          .
        </p>
      </ToolSection>

      <ToolSection eyebrow="Credit" title="The track">
        <Prose>
          <p>
            The clip is from What Would It Mean by H4RRIS feat. Nicole Apollonio, used with
            permission and gladly credited. Listen to the full track on{" "}
            <a
              href="https://open.spotify.com/track/0TKFFLWB4y0VPn5sxjKcAl"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 underline underline-offset-2 transition-colors hover:text-amber-300"
            >
              Spotify
            </a>{" "}
            or{" "}
            <a
              href="https://www.youtube.com/watch?v=Fpq0niYmC8I"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 underline underline-offset-2 transition-colors hover:text-amber-300"
            >
              YouTube
            </a>
            . Separating a song you did not make is fine for practice, sampling references and
            study; releasing the result needs the rights holder&apos;s permission, which is exactly
            what this page has.
          </p>
        </Prose>
      </ToolSection>

      <FAQSection faqs={FAQ_ITEMS} />

      <PageByline
        updated="2026-09-17"
        note="Every clip on this page is the tool's unedited output; times and limits measured the same day"
      />
    </ToolPageShell>
  );
}