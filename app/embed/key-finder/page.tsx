import type { Metadata } from "next";
import { EmbedKeyFinder } from "@/components/embed/EmbedKeyFinder";

export const metadata: Metadata = {
  title: "Key & BPM Finder",
  description: "Free key and BPM detection, embeddable on any site.",
  robots: { index: false, follow: true },
};

export default function EmbedKeyFinderPage() {
  return (
    <main className="min-h-screen bg-graphite-950">
      <EmbedKeyFinder />
    </main>
  );
}