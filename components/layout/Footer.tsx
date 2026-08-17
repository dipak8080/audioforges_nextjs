import Link from "next/link";
import { AudioWaveform, Coffee } from "lucide-react";
import { TOOLS } from "@/lib/data/tools";

/**
 * PREFETCH DISABLED (2026-08-16, extended 2026-08-17).
 *
 * This footer renders on EVERY page, so every link is multiplied by every
 * visitor x every page view. Each App Router route costs four edge
 * requests (_head, _tree, route, __PAGE__), so even six links is 24
 * requests per view for pages almost nobody clicks - Privacy, Terms and
 * DMCA exist because they have to exist, not because they get traffic.
 *
 * The tool column is only affordable BECAUSE prefetch is off.
 */

/**
 * Hand-picked shortlist, in display order. Sitewide footer links spread
 * internal link equity thin, so this is deliberately the handful worth
 * pointing every page at.
 *
 * Slugs that don't resolve are dropped and the list is TOPPED UP from the
 * live catalogue, so this column is always full. The first version of
 * this file guessed at slugs and three of six missed, which is why the
 * column rendered half-empty - a hardcoded list should never be able to
 * leave a hole in the layout.
 */
const FOOTER_TOOL_SLUGS = [
  "youtube-to-wav",
  "vocal-remover",
  "audio-to-midi",
  "key-finder",
  "convert",
  "speech-to-text",
];

const FOOTER_TOOL_COUNT = 6;

const SITE_LINKS = [
  { href: "/tools", label: "All tools" },
  { href: "/guides", label: "Guides" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/dmca", label: "DMCA" },
];

export function Footer() {
  const year = new Date().getFullYear();
  const live = TOOLS.filter((t) => t.status === "live");

  const picked = FOOTER_TOOL_SLUGS.map((slug) => live.find((t) => t.slug === slug)).filter(
    (t): t is (typeof TOOLS)[number] => Boolean(t)
  );
  const footerTools = [
    ...picked,
    ...live.filter((t) => !picked.some((p) => p.slug === t.slug)),
  ].slice(0, FOOTER_TOOL_COUNT);

  return (
    <footer className="border-t border-graphite-800 bg-graphite-950">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-14">
        {/* 4 + 8, with the three link columns nested inside the 8. The
            previous 5/3/2/2 split left the brand column's short text
            floating in a wide empty cell before the links started. */}
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <Link href="/" className="inline-flex items-center gap-2">
              <AudioWaveform className="h-5 w-5 text-amber-500" />
              <span className="font-mono font-semibold tracking-tight text-text-primary">
                AudioForges
              </span>
            </Link>

            <p className="mt-3 max-w-xs text-sm leading-relaxed text-text-muted">
              {live.length} free audio tools for producers, DJs and musicians. No sign-up, no
              watermark.
            </p>

            <div className="mt-5">
              <a
                href="https://ko-fi.com/audioforges"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-2.5 text-sm font-medium text-amber-400/90 transition-colors hover:border-amber-500/60 hover:bg-amber-500/10 hover:text-amber-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/60"
              >
                <Coffee className="h-4 w-4" />
                Donate
              </a>
              <p className="mt-2 max-w-xs text-xs leading-relaxed text-text-subtle">
                Servers and bandwidth come out of pocket. A one-off tip keeps the tools free.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-8">
            <FooterColumn title="Popular tools">
              {footerTools.map((tool) => (
                <FooterLink key={tool.slug} href={`/${tool.slug}`}>
                  {tool.name}
                </FooterLink>
              ))}
            </FooterColumn>

            <FooterColumn title="Site">
              {SITE_LINKS.map((link) => (
                <FooterLink key={link.href} href={link.href}>
                  {link.label}
                </FooterLink>
              ))}
            </FooterColumn>

            <FooterColumn title="Legal">
              {LEGAL_LINKS.map((link) => (
                <FooterLink key={link.href} href={link.href}>
                  {link.label}
                </FooterLink>
              ))}
            </FooterColumn>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-2 border-t border-graphite-800 pt-6 text-xs text-text-subtle sm:flex-row">
          <p>© {year} AudioForges</p>
          <p>Independent, built and maintained by one person.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3.5 flex items-center gap-2">
        {/* The amber tick used for categories in the nav panel and on
            /tools - one motif across all three surfaces. */}
        <span className="h-3 w-[2px] rounded-full bg-amber-500" />
        <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-subtle">
          {title}
        </h2>
      </div>
      <nav className="flex flex-col gap-2.5">{children}</nav>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      // See the note at the top of this file.
      prefetch={false}
      className="w-fit rounded text-sm text-text-muted transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/60"
    >
      {children}
    </Link>
  );
}