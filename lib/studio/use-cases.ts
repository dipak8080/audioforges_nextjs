import type { StudioPresetKey } from "./presets";

export const USE_CASES_INDEXABLE = false;

export interface UseCase {
  slug: string;
  preset: StudioPresetKey;
  title: string;
  description: string;
  h1: string;
  lede: string;
  meta: string[];
  steps: string[];
  why: { title: string; body: string }[];
  faqs: { question: string; answer: string }[];
  related: string[];
}

const RIGHTS =
  "Only if you own the song or have permission from the rights holder. AudioForges separates audio. It does not grant any rights to it.";

export const USE_CASES: Record<string, UseCase> = {
  "acapella-extractor": {
    slug: "acapella-extractor",
    preset: "acapella",
    title: "Acapella Extractor: Get Clean Vocals From Any Song",
    description:
      "Extract an acapella from any song online. Full-length isolated vocals as WAV or MP3. Free to try, studio clean from 25¢ a song, no subscription.",
    h1: "Acapella Extractor",
    lede: "Drop a song and get the vocal on its own, full length, ready for remixes, mashups and practice.",
    meta: ["Full-length WAV", "Free to try", "No subscription"],
    steps: [
      "Drop a song or a video. The waveform shows up before the upload finishes.",
      "Get the free result, then hear 30 seconds of the Studio version on your own track.",
      "Download the acapella as WAV or MP3, or open it in Forge Mixer first.",
    ],
    why: [
      { title: "Clean enough to reuse", body: "Studio takes out drum and cymbal bleed, so the vocal sits on a new beat without ghosts of the old one." },
      { title: "Dry vocals with Forge Clean", body: "Turn on Forge Clean to remove the reverb and echo baked into the original mix." },
      { title: "Key and BPM on every result", body: "Each acapella comes with its key, Camelot code and tempo, so you know where it fits." },
    ],
    faqs: [
      { question: "Is the acapella extractor free?", answer: "Yes. The free engine gives you a full-length acapella with no account. Studio quality costs one song, from 25¢, and songs you buy never expire." },
      { question: "What format do I get?", answer: "A 16-bit, 44.1 kHz WAV, or a 320 kbps MP3. The instrumental from the same run is included." },
      { question: "Can I remove the reverb from the vocal?", answer: "Yes. Turn on Forge Clean before a Studio run and you get a dry vocal as an extra stem." },
      { question: "Can I use the acapella in my own release?", answer: RIGHTS },
    ],
    related: ["instrumental-maker", "echo-reverb-remover", "lead-backing-vocal-splitter"],
  },
  "instrumental-maker": {
    slug: "instrumental-maker",
    preset: "instrumental",
    title: "Instrumental Maker: Remove Vocals, Keep the Music",
    description:
      "Make an instrumental from any song. Remove the vocals online and download a full-length backing track as WAV or MP3. Free to try, no subscription.",
    h1: "Instrumental Maker",
    lede: "Remove the singer and keep everything else. A clean backing track for karaoke, covers and practice.",
    meta: ["Full-length WAV", "Free to try", "No subscription"],
    steps: [
      "Drop a song, a video or paste a link.",
      "Get the free instrumental, then compare it with the Studio version on your own track.",
      "Download it, or use Forge Mixer to keep a little of the vocal as a guide.",
    ],
    why: [
      { title: "No vocal ghosts", body: "Studio removes the faint vocal that other tools leave behind in the chorus and on long notes." },
      { title: "Change key and tempo later", body: "Take the instrumental into Forge Mixer, balance it, and export your own mix as WAV." },
      { title: "Pay per song", body: "One song from 25¢. No monthly plan, and songs you buy never expire." },
    ],
    faqs: [
      { question: "How do I make an instrumental of a song?", answer: "Drop the song above and press Split free. You get the instrumental and the vocal as two separate full-length files." },
      { question: "Is it good enough for karaoke?", answer: "Yes. For the cleanest result, run it in Studio. It removes the vocal bleed that stands out on a karaoke speaker." },
      { question: "Can I keep the backing vocals?", answer: "Yes. Turn on Forge Split and you get the lead and the backing vocals as separate stems, so you can add the harmonies back in." },
      { question: "Can I upload the instrumental to YouTube?", answer: RIGHTS },
    ],
    related: ["acapella-extractor", "drum-remover", "bass-remover"],
  },
  "drum-remover": {
    slug: "drum-remover",
    preset: "drum-remover",
    title: "Drum Remover: Remove Drums From Any Song Online",
    description:
      "Remove drums from a song online. Split it into vocals, drums, bass and other, mute the drums and export a drumless mix as WAV. Free to try.",
    h1: "Drum Remover",
    lede: "Take the drums out of any song to play along, program your own beat, or sample what is left.",
    meta: ["Drumless WAV", "Drum stem too", "No subscription"],
    steps: [
      "Drop a song. It splits into vocals, drums, bass and other.",
      "In Forge Mixer, mute Drums and listen to the rest in sync.",
      "Export your drumless mix as WAV, or download the drum stem on its own.",
    ],
    why: [
      { title: "Made for drummers", body: "Play along to the real band without the original kit in the way, at the original tempo." },
      { title: "Both halves", body: "You get the drumless mix and the isolated drums from one run." },
      { title: "Tempo shown", body: "The BPM is detected for you, so a click track lines up straight away." },
    ],
    faqs: [
      { question: "How do I remove drums from a song?", answer: "Drop the song above, run it, then mute Drums in Forge Mixer and export your mix as WAV." },
      { question: "Can I get only the drums?", answer: "Yes. The drum stem downloads on its own from the same result." },
      { question: "Will cymbals leak into the other stems?", answer: "Much less in Studio. The free engine can leave some hi-hat in the other stem on busy mixes." },
      { question: "Can I share a drumless cover online?", answer: RIGHTS },
    ],
    related: ["bass-remover", "instrumental-maker", "acapella-extractor"],
  },
  "bass-remover": {
    slug: "bass-remover",
    preset: "bass-remover",
    title: "Bass Remover: Remove the Bass From Any Song",
    description:
      "Remove the bass from a song online. Split it into stems, mute the bass and export a bassless mix to play along with. Free to try, no subscription.",
    h1: "Bass Remover",
    lede: "Mute the bass line of any song and play it yourself, or pull the bass out to learn it note by note.",
    meta: ["Bassless WAV", "Bass stem too", "No subscription"],
    steps: [
      "Drop a song. It splits into vocals, drums, bass and other.",
      "In Forge Mixer, mute Bass and play along.",
      "Export your bassless mix, or send the bass stem to Forge Roll to see the notes.",
    ],
    why: [
      { title: "Learn the line", body: "Solo the bass stem, loop a section, and turn it into MIDI to read the notes." },
      { title: "Play along", body: "Mute the bass and take its place with the real song behind you." },
      { title: "Key shown", body: "The key and Camelot code come with every result." },
    ],
    faqs: [
      { question: "How do I remove the bass from a song?", answer: "Drop the song above, run it, then mute Bass in Forge Mixer and export your mix as WAV." },
      { question: "Can I see the bass notes?", answer: "Yes. Open the bass stem in Forge Roll from the result screen and it turns into editable MIDI." },
      { question: "Does it work on live recordings?", answer: "Yes. Studio handles live and dense mixes much better than the free engine." },
      { question: "Can I post my bass cover?", answer: RIGHTS },
    ],
    related: ["drum-remover", "instrumental-maker", "acapella-extractor"],
  },
  "echo-reverb-remover": {
    slug: "echo-reverb-remover",
    preset: "echo-reverb",
    title: "Echo and Reverb Remover for Vocals: Forge Clean",
    description:
      "Remove echo and reverb from a vocal with Forge Clean. Get a dry, upfront vocal from any song or recording. Included with the Studio Pass.",
    h1: "Echo and Reverb Remover",
    lede: "Forge Clean strips the room, the echo and the reverb tail from a vocal, so you get a dry take to mix your own way.",
    meta: ["Forge Clean", "Dry vocal stem", "No subscription"],
    steps: [
      "Drop a song or a vocal recording.",
      "Forge Clean is already on. Run it in Studio.",
      "You get the dry vocal as its own stem, next to the normal vocal and instrumental.",
    ],
    why: [
      { title: "Works on the vocal only", body: "The music stays untouched. Forge Clean runs on the separated vocal, not the whole mix." },
      { title: "Remix ready", body: "A dry vocal takes your own reverb and delay the way a studio take would." },
      { title: "Part of Studio", body: "One extra song on packs, and included with the Studio Pass." },
    ],
    faqs: [
      { question: "How do I remove reverb from a vocal?", answer: "Drop the song above and run it in Studio with Forge Clean on. The dry vocal arrives as an extra stem." },
      { question: "How is this different from the free echo remover?", answer: "The free tool at /echo-remove uses a classic filter on the whole recording. Forge Clean is an AI model that works on the isolated vocal, so the result is far cleaner." },
      { question: "What does it cost?", answer: "One extra song on top of the Studio run with a pack. It is included with the Studio Pass." },
      { question: "Can I use the dry vocal in a release?", answer: RIGHTS },
    ],
    related: ["acapella-extractor", "lead-backing-vocal-splitter", "instrumental-maker"],
  },
  "lead-backing-vocal-splitter": {
    slug: "lead-backing-vocal-splitter",
    preset: "lead-backing",
    title: "Lead and Backing Vocal Splitter: Forge Split",
    description:
      "Split the lead vocal from the backing vocals and harmonies with Forge Split. Each part as its own full-length WAV. Included with the Studio Pass.",
    h1: "Lead and Backing Vocal Splitter",
    lede: "Forge Split separates the main singer from the harmonies and backing vocals, so you can study, remix or remove each one.",
    meta: ["Forge Split", "Lead and backing stems", "No subscription"],
    steps: [
      "Drop a song.",
      "Forge Split is already on. Run it in Studio.",
      "Get the lead vocal and the backing vocals as separate stems, plus the instrumental.",
    ],
    why: [
      { title: "Learn the harmonies", body: "Solo the backing vocals to hear every part clearly, then sing along with them." },
      { title: "Better karaoke", body: "Remove only the lead singer and keep the harmonies for a fuller backing track." },
      { title: "Part of Studio", body: "One extra song on packs, and included with the Studio Pass." },
    ],
    faqs: [
      { question: "How do I separate lead and backing vocals?", answer: "Drop the song above and run it in Studio with Forge Split on. Lead and backing vocals arrive as separate stems." },
      { question: "Can I keep the harmonies in a karaoke track?", answer: "Yes. Mute the lead vocal in Forge Mixer and export the rest as WAV." },
      { question: "What does it cost?", answer: "One extra song on top of the Studio run with a pack. It is included with the Studio Pass." },
      { question: "Can I publish a remix of the vocals?", answer: RIGHTS },
    ],
    related: ["acapella-extractor", "echo-reverb-remover", "instrumental-maker"],
  },
};