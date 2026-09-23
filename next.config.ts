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
  // Framing is denied site-wide now that the /embed widgets are gone. There is
  // no longer any route meant to be iframed by a third party.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
];

const nextConfig: NextConfig = {
  // Route groups give each locale its own root layout, so the 404 page needs
  // its own document to render inside the site chrome.
  experimental: { globalNotFound: true },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: BASELINE_HEADERS,
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
   *
   * /embed and its two widgets were removed. The landing page was indexed, so
   * it redirects rather than 404s; the widget routes point at the full tool.
   */
  async redirects() {
    return [
      {
        source: "/speech-to-text",
        destination: "/tools",
        permanent: true,
      },
      {
        source: "/audio-to-text",
        destination: "/tools",
        permanent: true,
      },
      {
        source: "/youtube-to-text",
        destination: "/tools",
        permanent: true,
      },
      {
        source: "/video-to-text",
        destination: "/tools",
        permanent: true,
      },
      {
        source: "/free-transcription-no-sign-up",
        destination: "/tools",
        permanent: true,
      },
      {
        source: "/guides/transcribing-audio-accurately",
        destination: "/guides",
        permanent: true,
      },
      {
        source: "/audio-converter",
        destination: "/convert",
        permanent: true,
      },
      {
        source: "/embed",
        destination: "/tools",
        permanent: true,
      },
      {
        source: "/embed/key-finder",
        destination: "/key-finder",
        permanent: true,
      },
      {
        source: "/embed/audio-to-midi",
        destination: "/audio-to-midi",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;