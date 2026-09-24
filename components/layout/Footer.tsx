import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { getLiveTools, type Tool } from "@/lib/data/tools";
import { openConsentSettings } from "@/lib/consent";

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
  "vocal-remover",
  "stems",
  "audio-to-midi",
  "audio-to-sheet-music",
  "key-finder",
  "convert",
];

const FOOTER_TOOL_COUNT = 6;

const SITE_LINKS = [
  { href: "/tools", label: "All tools" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

const RESOURCE_LINKS = [
  { href: "/guides", label: "Guides" },
  { href: "/forge", label: "The Forge players" },
  { href: "/camelot-wheel", label: "Camelot Wheel" },
  { href: "/vocal-remover-comparison", label: "Vocal remover comparison" },
];

/**
 * Pricing is footer-only, deliberately.
 *
 * The tool pages rank on "free vocal remover" and "free stem splitter".
 * A price link in the main nav sits beside that H1 and undercuts the
 * exact positioning that earns the traffic. The footer is where someone
 * who is already looking for a price goes to find one.
 *
 * Appended only when the paywall is live — while it's off, /pricing
 * calls notFound(), and a footer link to a 404 on every page of the site
 * is a real SEO problem, not a cosmetic one.
 */
const PRICING_LINK = { href: "/pricing", label: "Pricing" };

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </svg>
  );
}


const SOCIAL_LINKS = [
  {
    href: "https://www.instagram.com/audioforges/",
    label: "AudioForges on Instagram",
    Icon: InstagramIcon,
  },
  {
    href: "https://www.youtube.com/@audioforges",
    label: "AudioForges on YouTube",
    Icon: YoutubeIcon,
  },
];

// Only pages that exist. Add a row when a new localized page ships.
const LANGUAGE_LINKS = [
  { href: "/vocal-remover", lang: "en", label: "English" },
  { href: "/es/quitar-voz-de-una-cancion", lang: "es", label: "Español" },
  { href: "/pt/remover-vocal", lang: "pt", label: "Português" },
  { href: "/id/penghilang-vokal", lang: "id", label: "Bahasa Indonesia" },
];

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/refunds", label: "Refund Policy" },
  { href: "/dmca", label: "DMCA" },
];

/**
 * `paywallEnabled` arrives as a PROP, not a fetch.
 *
 * This component is rendered by SiteChrome, which is "use client" — so
 * Footer is a client component by inheritance even though it has no
 * "use client" of its own. Calling getFeatureFlags() here therefore ran
 * in the BROWSER, on every render, against api.audioforges.com. Combined
 * with the "async Client Component" error it produced a render loop that
 * fired ~125 requests and exhausted the connection pool.
 *
 * The flag is already resolved once, server-side and cached, in the root
 * layout. Threading it down costs nothing and cannot loop.
 */
export function Footer({ paywallEnabled = false }: { paywallEnabled?: boolean }) {
  // Server component in the layout, so on a statically rendered page this
  // is the BUILD year rather than the current one. Fine at this deploy
  // cadence; if the site ever goes long stretches without a build, this is
  // the line that quietly goes stale every January.
  const year = new Date().getFullYear();

  const live = getLiveTools();

  const siteLinks = paywallEnabled ? [...SITE_LINKS, PRICING_LINK] : SITE_LINKS;

  const picked = FOOTER_TOOL_SLUGS.map((slug) => live.find((t) => t.slug === slug)).filter(
    (t): t is Tool => Boolean(t)
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
              <BrandMark className="h-5 w-5 text-amber-500" />
              <span className="font-mono tracking-tight">
                <span className="font-normal text-text-secondary">Audio</span>
                <span className="font-semibold text-text-primary">Forges</span>
              </span>
            </Link>

            <p className="mt-3 max-w-xs text-sm leading-relaxed text-text-muted">
              AI stem separation and {live.length} studio tools for producers, DJs and musicians.
            </p>

            <div className="mt-5">
              <div className="flex items-center gap-2">
                {SOCIAL_LINKS.map(({ href, label, Icon }) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer me"
                    aria-label={label}
                    title={label}
                    className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-lg border border-graphite-800 text-text-muted transition-colors hover:border-amber-500/60 hover:text-amber-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/60"
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </a>
                ))}
              </div>

            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-8">
            <FooterColumn title="Popular tools">
              {footerTools.map((tool) => (
                <FooterLink key={tool.slug} href={`/${tool.slug}`}>
                  {tool.name}
                </FooterLink>
              ))}
            </FooterColumn>

            <FooterColumn title="Resources">
              {RESOURCE_LINKS.map((link) => (
                <FooterLink key={link.href} href={link.href}>
                  {link.label}
                </FooterLink>
              ))}
            </FooterColumn>

            <FooterColumn title="Site">
              {siteLinks.map((link) => (
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
              {/* Withdrawing consent has to be as easy as giving it, so this
                  sits with the legal links on every page. */}
              <FooterButton onClick={openConsentSettings}>Cookie settings</FooterButton>
            </FooterColumn>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-2 border-t border-graphite-800 pt-6 text-xs text-text-subtle sm:flex-row">
          <p>© {year} AudioForges</p>
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span>Vocal remover in</span>
            {LANGUAGE_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                hrefLang={l.lang}
                prefetch={false}
                className="rounded text-text-muted underline-offset-4 outline-none transition-colors hover:text-text-primary hover:underline focus-visible:ring-2 focus-visible:ring-amber-400/70"
              >
                {l.label}
              </Link>
            ))}
          </p>
          <p>Independent. Built in Kathmandu by one person.</p>
        </div>
      </div>
    </footer>
  );
}

/**
 * The column title is a <p>, not an <h2>.
 *
 * As headings, these three appended "Popular tools / Site / Legal" to the
 * outline of every page on the site, sitting at the same level as the
 * page's own content sections. On a tool page that means the last three
 * h2s a crawler reads are boilerplate.
 *
 * The label moves onto the <nav> instead, where it does more good than it
 * did as a heading: three unlabelled navs announce as "navigation" three
 * times with nothing to tell them apart, which is what a screen-reader
 * user got before.
 */
function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3.5 flex items-center gap-2">
        {/* The amber tick used for categories in the nav panel and on
            /tools - one motif across all three surfaces. */}
        <span className="h-3 w-[2px] rounded-full bg-amber-500" aria-hidden />
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-subtle">
          {title}
        </p>
      </div>
      <nav aria-label={title} className="flex flex-col gap-2.5">
        {children}
      </nav>
    </div>
  );
}

function FooterButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-fit rounded text-left text-sm text-text-muted transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/60"
    >
      {children}
    </button>
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