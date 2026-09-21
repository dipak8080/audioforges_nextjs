import { SITE_URL } from "@/lib/constants";

export const vocalRemoverLocales: Record<string, string> = {
  en: "/vocal-remover",
  id: "/id/penghilang-vokal",
};

export const vocalRemoverLanguageAlternates: Record<string, string> = Object.fromEntries([
  ...Object.entries(vocalRemoverLocales).map(([lang, path]) => [lang, `${SITE_URL}${path}`]),
  ["x-default", `${SITE_URL}${vocalRemoverLocales.en}`],
]);

export interface VocalRemoverDict {
  locale: string;
  path: string;
  updated: string;
  pageTitle: string;
  pageDescription: string;
  ogTitle: string;
  appName: string;
  appAlternateNames: string[];
  breadcrumbTools: string;
  breadcrumbSelf: string;
  heroTitle: string;
  heroLede: string;
  heroMeta: [string, string, string];
  proofs: { label: string; value: string; note: string }[];
  hear: {
    title: string;
    intro: string;
    stemLabel: string;
    trackLabel: string;
    cues: { at: number; label: string }[];
    credit: string;
  };
  mixer: { title: string; intro: string; points: string[] };
  stems: {
    title: string;
    outputs: { name: string; desc: string }[];
    jobs: { name: string; uses: "instrumental" | "vocals" | "either"; desc: string }[];
  };
  tiers: {
    title: string;
    labels: {
      model: string;
      bleed: string;
      artifacts: string;
      time: string;
      limit: string;
      cost: string;
    };
    columns: [string, string];
    bleedCells: [string, string];
    artifactCells: [string, string];
    timeCells: [string, string];
    limitSubStandard: string;
    limitSubHq: string;
    costCells: [string, string];
    costSubHq: string;
  };
  compare: {
    title: string;
    intro: string;
    columns: [string, string, string];
    rows: {
      label: string;
      cells: { state?: "yes" | "no" | "partial" | "unknown"; text: string; sub?: string }[];
    }[];
    footnote: string;
    ctaTitle: string;
    ctaBody: string;
  };
  faqs: { question: string; answer: string }[];
  formatsFaq: { question: string; answer: string };
  byline: { note: string; legal: string };
}

export const idDict: VocalRemoverDict = {
  locale: "id",
  path: vocalRemoverLocales.id,
  updated: "2026-09-21",
  pageTitle: "Penghilang Vokal AI Gratis: Hapus Vokal dari Lagu Online",
  pageDescription:
    "Hapus vokal dari lagu secara gratis dengan AI. Dapatkan instrumental dan akapela sebagai file WAV utuh. Tanpa daftar akun, tanpa watermark, langsung di browser.",
  ogTitle: "Penghilang Vokal AI Gratis",
  appName: "Penghilang Vokal AI",
  appAlternateNames: [
    "Penghilang Vokal",
    "Penghilang Vokal Online",
    "Pemisah Vokal",
    "Pembuat Karaoke",
    "Pengambil Akapela",
    "Pembuat Instrumental",
  ],
  breadcrumbTools: "Alat",
  breadcrumbSelf: "Penghilang Vokal",
  heroTitle: "Penghilang Vokal AI Gratis",
  heroLede:
    "Unggah lagu, dapatkan vokal dan instrumentalnya sebagai dua file WAV terpisah. Tanpa daftar akun, tanpa instal apa pun.",
  heroMeta: ["Tanpa akun", "Tanpa watermark", "WAV utuh"],
  proofs: [
    {
      label: "Model",
      value: "htdemucs dan MelBand RoFormer",
      note: "Nama modelnya kami tulis supaya bisa Anda cek sendiri. Pemisahan sumber sungguhan, bukan trik center-channel.",
    },
    {
      label: "Output",
      value: "WAV stereo 16-bit 44.1 kHz",
      note: "Lossless, spesifikasinya kami tulis jelas. Kebanyakan tool sejenis tidak pernah menyebutnya.",
    },
    {
      label: "Harga",
      value: "Lagu utuh gratis, tanpa watermark",
      note: "Tanpa akun, tanpa tier yang cuma preview. Dibatasi per alamat IP supaya tetap gratis untuk semua.",
    },
  ],
  hear: {
    title: "Dengarkan bedanya",
    intro:
      "Stem vokal dari kedua tier, pada lagu yang sama. Klik salah satu jalur untuk berpindah saat lagu berjalan; posisi putar tidak berubah, jadi Anda mendengar bagian yang sama dua kali. Seret pada jalur untuk mengulang bagian yang mau dibandingkan.",
    stemLabel: "Vokal",
    trackLabel: "Mix penuh dengan vokal utama",
    cues: [
      { at: 2, label: "vokal masuk" },
      { at: 21, label: "reff" },
      { at: 37, label: "puncak vokal" },
    ],
    credit: "Musik: What Would It Mean oleh H4RRIS feat. Nicole Apollonio, digunakan dengan izin",
  },
  mixer: {
    title: "Atur mix-nya sebelum diunduh",
    intro:
      "Hasilnya terbuka di Forge Mixer, pemutar dua jalur yang ada langsung di halaman ini. Kedua stem berjalan dari satu clock yang sama, jadi tidak pernah geser. Atur keseimbangan yang Anda suka lalu ekspor sebagai WAV tanpa keluar dari browser.",
    points: [
      "Mute, solo, volume sampai 150% dan pan penuh di tiap stem.",
      "Preset Karaoke dan Akapela, sekali tekan.",
      "Seret pada timeline untuk mengulang satu bagian, akurat sampai sampel.",
      "Ekspor mix yang Anda atur sebagai WAV. Diproses lokal, tanpa memakai kredit.",
    ],
  },
  stems: {
    title: "Dua stem, empat kegunaan",
    outputs: [
      {
        name: "Instrumental",
        desc: "Mix penuh dengan suara penyanyi dihilangkan. Drum, bass dan lainnya tetap utuh.",
      },
      {
        name: "Vokal",
        desc: "Vokal utama dan latar berdiri sendiri. Langsung bisa dipakai sebagai akapela.",
      },
    ],
    jobs: [
      { name: "Karaoke", uses: "instrumental", desc: "Nyanyi di atas aransemen aslinya, bukan versi MIDI." },
      { name: "Remix", uses: "either", desc: "Bangun dari musik yang bersih atau hook yang bersih." },
      { name: "Mashup DJ", uses: "vocals", desc: "Taruh akapela satu lagu di atas instrumental lagu lain." },
      { name: "Referensi cover", uses: "instrumental", desc: "Dengar tiap bagian dengan jelas tanpa terganggu vokal utama." },
    ],
  },
  tiers: {
    title: "Standard vs. Studio Quality",
    labels: {
      model: "Model",
      bleed: "Sisa vokal di instrumental",
      artifacts: "Artefak berair",
      time: "Waktu",
      limit: "Batas",
      cost: "Biaya",
    },
    columns: ["Standard", "Studio Quality"],
    bleedCells: ["Terdengar pada mix padat dan ekor reverb panjang", "Hilang pada hampir semua materi"],
    artifactCells: ["Pada cymbal, napas dan sibilan", "Cymbal dan konsonan tetap utuh"],
    timeCells: ["20 detik sampai 1 menit", "1 sampai 2 menit"],
    limitSubStandard: "dibagi bersama semua alat pemisahan",
    limitSubHq: "pada tier gratis",
    costCells: ["Gratis, selamanya", "Jatah gratis bulanan, lalu 1 kredit per proses"],
    costSubHq: "jatah dibagi bersama alat Studio Quality lain",
  },
  compare: {
    title: "Dibandingkan dengan tool berbayar",
    intro:
      "Setiap sel di bawah bisa Anda cek sendiri di situs mereka. Tidak ada klaim yang tidak bisa diverifikasi; demo di atas dan telinga Anda yang menilai sisanya.",
    columns: ["AudioForges", "LALAL.AI", "Vocalremover.org"],
    rows: [
      {
        label: "Hasil utuh tanpa bayar",
        cells: [
          { state: "yes", text: "Ya" },
          { state: "no", text: "Hanya preview, unduhan penuh berbayar" },
          { state: "yes", text: "Ya" },
        ],
      },
      {
        label: "Tanpa perlu akun",
        cells: [
          { state: "yes", text: "Ya" },
          { state: "no", text: "Wajib akun untuk melihat hasil" },
          { state: "yes", text: "Ya" },
        ],
      },
      {
        label: "Nama model disebutkan",
        cells: [
          { state: "yes", text: "htdemucs, MelBand RoFormer", sub: "open source, bisa diverifikasi" },
          { state: "partial", text: "Mesin Andromeda, tertutup" },
          { state: "unknown", text: "Tidak disebutkan" },
        ],
      },
      {
        label: "Spesifikasi output ditulis",
        cells: [
          { state: "yes", text: "WAV 16-bit 44.1 kHz" },
          { state: "unknown", text: "Tidak disebutkan" },
          { state: "unknown", text: "Tidak disebutkan" },
        ],
      },
      {
        label: "Mix stem di browser",
        cells: [
          { state: "yes", text: "Forge Mixer", sub: "mute, solo, pan, loop, ekspor" },
          { state: "no", text: "Hanya cuplikan preview" },
          { state: "no", text: "Hanya pemutaran" },
        ],
      },
      {
        label: "Tier berbayar",
        cells: [
          { text: "1 kredit per proses, tidak pernah hangus" },
          { text: "Langganan bulanan, plus top-up menit" },
          { text: "Tidak ada, didanai donasi" },
        ],
      },
    ],
    footnote: "Dicek langsung ke halaman mereka pada 21 September 2026. Detail bisa berubah.",
    ctaTitle: "Coba lagu yang sama di keduanya.",
    ctaBody:
      "Preview tool berbayar mana pun melawan AudioForges, lagu yang sama, bagian yang sama. Itu satu-satunya perbandingan yang berarti dan tidak perlu bayar.",
  },
  faqs: [
    {
      question: "Apakah ada penghilang vokal gratis tanpa daftar?",
      answer:
        "Ada, halaman ini. AudioForges memisahkan lagu utuh secara gratis tanpa akun dan hasilnya bisa diunduh sebagai WAV penuh. Untuk hasil paling bersih, Studio Quality memakai model MelBand RoFormer dengan biaya satu kredit per lagu, tanpa langganan, dan kredit tidak pernah hangus.",
    },
    {
      question: "Apakah file saya disimpan?",
      answer:
        "File Anda hanya disimpan sebentar untuk keperluan pemrosesan, lalu dihapus otomatis bersama hasil pemisahannya. Tidak ada akun, jadi tidak ada yang terhubung ke Anda, dipublikasikan, atau dibagikan.",
    },
    {
      question: "Apa itu Studio Quality?",
      answer:
        "Tier kedua yang memakai MelBand RoFormer, bukan htdemucs. Arsitekturnya berbeda, bukan model yang sama dipaksa lebih keras, dan bedanya terdengar: sisa vokal di instrumental jauh berkurang dan artefak berair pada cymbal dan napas lebih sedikit. Prosesnya 1 sampai 2 menit, dan biayanya satu kredit per proses setelah jatah gratis bulanan.",
    },
    {
      question: "Bisa hapus vokal langsung dari video YouTube?",
      answer:
        "Bisa. Tempel tautannya di alat YouTube Vocal Remover kami, tanpa perlu mengunduh audionya dulu, selama Anda punya hak atas konten tersebut.",
    },
    {
      question: "Apakah berfungsi untuk rekaman live?",
      answer:
        "Berfungsi, tapi hasilnya tidak sebersih mix studio. Suara penonton dan bocoran panggung lebih sulit dibedakan dari vokal oleh modelnya.",
    },
    {
      question: "Apakah kualitas audionya jadi lebih bagus?",
      answer:
        "Tidak. Alat ini memisahkan apa yang sudah ada di dalam mix. Ia tidak me-remaster atau menambah kualitas yang tidak ada di rekaman aslinya, dan output selalu WAV stereo 16-bit 44.1 kHz apa pun file yang Anda unggah.",
    },
  ],
  formatsFaq: {
    question: "Format apa saja yang bisa diunggah, dan berapa batas ukurannya?",
    answer:
      "{formats}, maksimal {size} per unggahan. Kualitas Standard dibatasi per alamat IP supaya tetap gratis untuk semua orang.",
  },
  byline: {
    note: "Halaman versi Bahasa Indonesia",
    legal:
      "Anda bertanggung jawab memiliki hak atas lagu yang Anda unggah. AudioForges tidak menyimpan atau menyebarkan lagu yang diproses di sini.",
  },
};