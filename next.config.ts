import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  /**
   * /speech-to-text was the original transcription route. The page was
   * replaced by /audio-to-text, which targets the keyword cluster that
   * actually has volume ("free audio to text converter") rather than the
   * head term.
   *
   * The old URL had no impressions worth preserving, so this isn't about
   * link equity — it's that Google had it indexed, so it can still be
   * served in results, and any external link to it (directory listings,
   * forum comments) would otherwise land on a 404.
   *
   * permanent: true emits a 308, which browsers and search engines cache
   * indefinitely. Correct here — this move is not coming back.
   */
  async redirects() {
    return [
      {
        source: "/speech-to-text",
        destination: "/audio-to-text",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;