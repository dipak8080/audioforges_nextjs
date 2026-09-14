import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AudioForges",
    short_name: "AudioForges",
    description:
      "Free browser audio tools for producers, DJs and musicians. Every model is named, every limit is published, and results play back before you download.",
    start_url: "/",
    display: "standalone",
    background_color: "#151515",
    theme_color: "#151515",
    categories: ["music", "productivity", "utilities"],
    icons: [
      { src: "/images/logo.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/images/logo.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}