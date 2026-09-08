# AudioForges

Free browser-based audio tools for producers, DJs and musicians — no sign-up, no watermarks, no daily limits.

**Live site: [audioforges.com](https://www.audioforges.com)**

Built and run by one person. The frontend is Next.js; the analysis and conversion backend is FastAPI + ffmpeg with a few ML models behind it.

## Tools

**Analysis**
- [Key & BPM finder](https://www.audioforges.com/key-finder) — Essentia key/tempo detection cross-checked with librosa, with a confidence score. Reads the audio itself rather than looking a track up in a database, so it works on unreleased music and demos.
- [Audio to MIDI](https://www.audioforges.com/audio-to-midi) — note detection with a piano-roll preview before you download.
- [Audio to sheet music](https://www.audioforges.com/audio-to-sheet-music) — engraved score you can play back in the browser, exported as PDF, MusicXML and MIDI.
- [Instrument tuner](https://www.audioforges.com/tuner), [metronome](https://www.audioforges.com/metronome)

**Separation and cleanup**
- [Stem splitter](https://www.audioforges.com/stems) — vocals, drums, bass, other
- [Vocal remover](https://www.audioforges.com/vocal-remover)
- [Voice cleanup](https://www.audioforges.com/voice-clean)

**Conversion**
- [Format converter](https://www.audioforges.com/convert), [sample rate converter](https://www.audioforges.com/sample-rate-converter), [mono/stereo converter](https://www.audioforges.com/mono-stereo-converter)
- [YouTube to WAV](https://www.audioforges.com/youtube-to-wav), [YouTube to MP3](https://www.audioforges.com/youtube-to-mp3), [video to audio](https://www.audioforges.com/video-to-audio)
- [Trim](https://www.audioforges.com/trim), [pitch shift](https://www.audioforges.com/pitch), [loudness normalizer](https://www.audioforges.com/loudness-normalizer), [ringtone maker](https://www.audioforges.com/ringtone-maker)

**Transcription**
- [Audio to text](https://www.audioforges.com/audio-to-text), [video to text](https://www.audioforges.com/video-to-text), [YouTube to text](https://www.audioforges.com/youtube-to-text)

## Embeddable widgets

Two tools can be embedded on any site with one line of HTML — free, no account, no API key. The only condition is keeping the attribution link visible.

```html
<iframe src="https://www.audioforges.com/embed/key-finder"
  width="100%" height="330" style="border:none;max-width:520px"
  title="Free key and BPM finder by AudioForges"
  loading="lazy"></iframe>
```

Audio-to-MIDI is available at `/embed/audio-to-midi`. Live previews and the copy-paste snippets: **[audioforges.com/embed](https://www.audioforges.com/embed)**

## Stack

- Next.js (App Router), TypeScript, Tailwind
- FastAPI backend, ffmpeg, Essentia, librosa, basic-pitch, Demucs
- Deployed on Vercel; analysis workers on a VPS

## Guides

Long-form documentation on the audio problems behind the tools — [sample rate and bit depth](https://www.audioforges.com/guides/sample-rate-and-bit-depth-explained), [audio formats for game engines](https://www.audioforges.com/guides/audio-format-for-game-engines-unity-unreal-godot), [preparing samples for hardware samplers](https://www.audioforges.com/guides/prepare-samples-for-sp404-digitakt-mpc), [converting audio for phone systems](https://www.audioforges.com/guides/convert-audio-for-phone-systems-3cx-asterisk-ivr) and more at [audioforges.com/guides](https://www.audioforges.com/guides).

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Contact

Bug reports and feature requests: open an issue, or contact@audioforges.com
