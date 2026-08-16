import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/about", label: "About" },
  { href: "/guides", label: "Guides" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/dmca", label: "DMCA" },
];

/**
 * PREFETCH DISABLED (2026-08-16).
 *
 * Only six links, but this footer renders on EVERY page, so the cost is
 * six routes x four App Router segments (_head, _tree, route, __PAGE__)
 * = 24 edge requests on every single page view, for pages almost nobody
 * clicks. Privacy, Terms and DMCA exist because they have to exist, not
 * because they get traffic.
 *
 * Sitewide components are where prefetch is most expensive and least
 * useful: the multiplier is every visitor x every page, and the links
 * are utility navigation rather than the thing anyone came for. Guides
 * is the one plausible click here, and it is already prefetched from the
 * main nav.
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-graphite-800 bg-graphite-950">
      <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-text-subtle">
          © {year} AudioForges. All rights reserved.
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              className="text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}