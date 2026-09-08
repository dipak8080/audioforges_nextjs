import type { Metadata } from "next";
import { EmbedAudioToMidi } from "@/components/embed/EmbedAudioToMidi";

export const metadata: Metadata = {
  title: "Audio to MIDI",
  description: "Free audio-to-MIDI conversion, embeddable on any site.",
  robots: { index: false, follow: true },
};

export default function EmbedAudioToMidiPage() {
  return (
    <main className="min-h-screen bg-graphite-950">
      <EmbedAudioToMidi />
    </main>
  );
}