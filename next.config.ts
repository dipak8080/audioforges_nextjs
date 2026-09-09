import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Framing is denied everywhere except /embed/*, which exists to be put in
   * an iframe on other people's sites. Without the sitewide default the tool
   * pages could be framed by anyone; without the /embed exception the widget
   * could not be embedded at all.
   */
  async headers() {
    return [
      {
        source: "/embed/:path*",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
      {
        source: "/((?!embed).*)",
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