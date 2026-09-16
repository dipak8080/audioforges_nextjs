/* eslint-disable @next/next/no-img-element */
// Directory badges. Their verifiers look for these exact links and image URLs
// in the server HTML, so keep hrefs and srcs as issued and never add nofollow.

const BADGES = [
  {
    name: "Fazier",
    href: "https://fazier.com/launches/www.audioforges.com",
    src: "https://fazier.com/api/v1//public/badges/launch_badges.svg?badge_type=featured&theme=dark",
    alt: "Fazier badge",
    width: 250,
    height: 54,
  },
  {
    name: "Startup Fame",
    href: "https://startupfa.me/s/audioforges?utm_source=audioforges.com",
    src: "https://startupfa.me/badge?t=small&theme=dark",
    alt: "AudioForges - Featured on Startup Fame",
    width: 240,
    height: 36,
  },
  {
    name: "Smol Launch",
    href: "https://smollaunch.com",
    src: "https://smollaunch.com/badges/featured-dark.svg",
    alt: "AudioForges, Featured on Smol Launch",
    width: 250,
    height: 60,
  },
  {
    name: "LaunchIgniter",
    href: "https://launchigniter.com/product/audioforges?ref=badge-audioforges",
    src: "https://launchigniter.com/api/badge/audioforges?theme=dark",
    alt: "Featured on LaunchIgniter",
    width: 212,
    height: 55,
  },
  {
    name: "OpenHunts",
    href: "https://openhunts.com",
    src: "https://cdn.openhunts.com/badges/club.webp",
    alt: "OpenHunts Club Member",
    width: 486,
    height: 105,
    title: "OpenHunts Club",
  },
];

export function FeaturedOn() {
  return (
    <section aria-labelledby="featured-on" className="border-t border-graphite-800 py-10">
      <p
        id="featured-on"
        className="text-center font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle"
      >
        Featured on
      </p>
      <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-4">
        {BADGES.map((b) => (
          <li key={b.name}>
            <a
              href={b.href}
              target="_blank"
              rel="noopener"
              title={b.title}
              className="block rounded-md opacity-80 outline-none transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <img
                src={b.src}
                alt={b.alt}
                width={b.width}
                height={b.height}
                loading="lazy"
                decoding="async"
                className="h-10 w-auto"
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}