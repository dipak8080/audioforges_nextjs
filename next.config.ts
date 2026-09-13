import type { NextConfig } from "next";

/**
 * Applied to every route. None of these depend on the page, so they live in
 * one place rather than being repeated per matcher.
 *
 * No script-src CSP here: the layout runs inline scripts (consent defaults,
 * gtag config, Organization JSON-LD), so a real policy needs per-request
 * nonces, which statically rendered pages cannot carry.
 */
const BASELINE_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Microphone stays open for the tuner and voice recorder. Everything else
  // is off, so a compromised dependency cannot quietly prompt for it.
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=(self), payment=(), usb=()",
  },
  // No `preload`: that is a one-way door enforced by the browsers themselves,
  // and it applies to every subdomain including api.audioforges.com.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  /**
   * Framing is denied everywhere except the widgets under /embed/, which exist
   * to be put in an iframe on other people's sites.
   *
   * `/embed/:path+` needs the `+` rather than `*`: with `*` the matcher also
   * catches /embed itself, so the marketing page that sells the widgets was
   * framable by anyone. The deny rule excludes "embed/" with the slash for the
   * same reason, so /embed falls under it and a future /embeddable-x cannot
   * slip through the gap a bare "embed" prefix would leave.
   */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: BASELINE_HEADERS,
      },
      {
        source: "/embed/:path+",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
      {
        source: "/((?!embed/).*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },

  /**
   * /speech-to-text was the original transcription route, replaced by
   * /audio-to-text for the keyword cluster with actual volume. Google still
   * has the old URL indexed, so the redirect keeps external links working.
   *
   * /audio-converter was never a real route, but Bing crawls it and gets a
   * 404 — something outside the site links to it. Pointing it at /convert
   * turns a dead end into the page the visitor wanted.
   */
  async redirects() {
    return [
      {
        source: "/speech-to-text",
        destination: "/audio-to-text",
        permanent: true,
      },
      {
        source: "/audio-converter",
        destination: "/convert",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;