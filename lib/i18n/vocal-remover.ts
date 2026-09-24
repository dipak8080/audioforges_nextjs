import { SITE_URL } from "@/lib/constants";

import type { VocalRemoverCopy } from "@/components/converter/VocalRemoverForm";

export const vocalRemoverLocales: Record<string, string> = {
  en: "/vocal-remover",
  id: "/id/penghilang-vokal",
  es: "/es/quitar-voz-de-una-cancion",
  pt: "/pt/remover-vocal",
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
  /** Text inside the tool itself. Serializable, passed to VocalRemoverForm. */
  form: VocalRemoverCopy;
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
    title: "Standar vs. Studio Quality",
    labels: {
      model: "Model",
      bleed: "Sisa vokal di instrumental",
      artifacts: "Artefak berair",
      time: "Waktu",
      limit: "Batas",
      cost: "Biaya",
    },
    columns: ["Standar", "Studio Quality"],
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
  form: {
    toolLabel: "Penghilang vokal",
    dropTitle: "Letakkan lagu",
    standardName: "Standar",
    standardTime: "20 dtk sampai 1 mnt",
    studioTime: "1 sampai 2 mnt",
    action: "Hapus vokal",
    actionStudio: "Hapus vokal dengan Studio Quality",
    tryAgain: "Coba lagi",
    tryAgainIn: "Coba lagi dalam {t}",
    demoCaption: "Dengarkan hasilnya dulu: trek vokal",
    demoNudge: "Sekarang pindah ke Studio Quality dan dengarkan sisa musiknya hilang",
    demoCredit: "What Would It Mean oleh H4RRIS feat. Nicole Apollonio, digunakan dengan izin",
    costNoteOne: "{n} kredit per lagu setelah jatah gratis habis",
    costNoteMany: "{n} kredit per lagu setelah jatah gratis habis",
    reset: "Pisahkan lagu lain",
    doneFallback: "Pemisahan selesai",
    stage: {
      done: "Selesai",
      release: "Lepaskan",
      dropHint: "Di mana saja di panel ini, atau",
      chooseLink: "pilih file",
      chooseButton: "Pilih file",
      replace: "Ganti",
      remove: "Hapus",
      cancel: "Batal",
      usually: "biasanya",
      working: "Memproses",
    },
  },
};

export const esDict: VocalRemoverDict = {
  locale: "es",
  path: vocalRemoverLocales.es,
  updated: "2026-09-21",
  pageTitle: "Quitar la Voz de una Canción Gratis: Separador de Voz con IA",
  pageDescription:
    "Quita la voz de cualquier canción gratis con IA. Descarga el instrumental y el acapella en WAV. Sin registro, sin marca de agua, directo en el navegador.",
  ogTitle: "Quitar la Voz de una Canción Gratis",
  appName: "Separador de Voz IA",
  appAlternateNames: [
    "Quitar Voz de una Canción",
    "Quitar Voz Online",
    "Separador de Voz",
    "Quita Voces",
    "Extractor de Acapella",
    "Creador de Karaoke",
    "Creador de Instrumentales",
  ],
  breadcrumbTools: "Herramientas",
  breadcrumbSelf: "Quitar Voz",
  heroTitle: "Quitar la Voz de una Canción",
  heroLede:
    "Sube una canción y recibe la voz y el instrumental como dos archivos WAV separados. Sin crear cuenta, sin instalar nada.",
  heroMeta: ["Sin cuenta", "Sin marca de agua", "WAV completo"],
  proofs: [
    {
      label: "Modelos",
      value: "htdemucs y MelBand RoFormer",
      note: "Nombramos los modelos para que puedas verificarlos tú mismo. Separación de fuentes real, no un truco de canal central.",
    },
    {
      label: "Salida",
      value: "WAV estéreo 16-bit 44.1 kHz",
      note: "Sin pérdida, con la especificación publicada. La mayoría de herramientas de esta categoría nunca lo dicen.",
    },
    {
      label: "Precio",
      value: "Canciones completas gratis, sin marca de agua",
      note: "Sin cuenta, sin nivel que solo deja escuchar. Limitado por IP para que siga siendo gratis para todos.",
    },
  ],
  hear: {
    title: "Escucha la diferencia",
    intro:
      "La pista de voz de ambos niveles, en la misma canción. Haz clic en un carril para cambiar mientras suena; la posición de reproducción no se mueve, así escuchas el mismo compás dos veces. Arrastra sobre un carril para repetir la parte que quieras comparar.",
    stemLabel: "Voz",
    trackLabel: "Mezcla completa con voz principal",
    cues: [
      { at: 2, label: "entra la voz" },
      { at: 21, label: "estribillo" },
      { at: 37, label: "pico vocal" },
    ],
    credit: "Música: What Would It Mean de H4RRIS feat. Nicole Apollonio, usada con permiso",
  },
  mixer: {
    title: "Ajusta la mezcla antes de descargar",
    intro:
      "El resultado se abre en Forge Mixer, un reproductor de dos carriles integrado en esta página. Ambas pistas corren con el mismo reloj, así que nunca se desfasan. Ajusta el balance que te guste y expórtalo como WAV sin salir del navegador.",
    points: [
      "Silenciar, solo, volumen hasta 150% y paneo completo en cada pista.",
      "Presets de Karaoke y Acapella, con un toque.",
      "Arrastra sobre la línea de tiempo para repetir una sección, con precisión de muestra.",
      "Exporta la mezcla que ajustaste como WAV. Se procesa en tu equipo, sin gastar créditos.",
    ],
  },
  stems: {
    title: "Dos pistas, cuatro usos",
    outputs: [
      {
        name: "Instrumental",
        desc: "La mezcla completa con la voz eliminada. Batería, bajo y todo lo demás quedan intactos.",
      },
      {
        name: "Voz",
        desc: "Voz principal y coros por su cuenta. Sirve como acapella tal cual.",
      },
    ],
    jobs: [
      { name: "Karaoke", uses: "instrumental", desc: "Canta sobre el arreglo original, no sobre una versión MIDI." },
      { name: "Remix", uses: "either", desc: "Construye sobre una base limpia o un hook limpio." },
      { name: "Mashup de DJ", uses: "vocals", desc: "Pon el acapella de una canción sobre el instrumental de otra." },
      { name: "Referencia para covers", uses: "instrumental", desc: "Escucha cada parte con claridad sin la voz principal encima." },
    ],
  },
  tiers: {
    title: "Estándar vs. Studio Quality",
    labels: {
      model: "Modelo",
      bleed: "Restos de voz en el instrumental",
      artifacts: "Artefactos acuosos",
      time: "Tiempo",
      limit: "Límite",
      cost: "Costo",
    },
    columns: ["Estándar", "Studio Quality"],
    bleedCells: ["Se oyen en mezclas densas y colas de reverb largas", "Desaparecen en casi todo el material"],
    artifactCells: ["En platillos, respiraciones y sibilancias", "Platillos y consonantes quedan intactos"],
    timeCells: ["20 segundos a 1 minuto", "1 a 2 minutos"],
    limitSubStandard: "compartido entre todas las herramientas de separación",
    limitSubHq: "en el nivel gratuito",
    costCells: ["Gratis, siempre", "Cupo gratis mensual, luego 1 crédito por proceso"],
    costSubHq: "cupo compartido entre las herramientas Studio Quality",
  },
  compare: {
    title: "Comparado con las herramientas de pago",
    intro:
      "Cada celda de abajo se puede verificar en las páginas de esos sitios. No hacemos ninguna afirmación que no puedas comprobar; la demo de arriba y tus oídos juzgan el resto.",
    columns: ["AudioForges", "LALAL.AI", "Vocalremover.org"],
    rows: [
      {
        label: "Resultado completo sin pagar",
        cells: [
          { state: "yes", text: "Sí" },
          { state: "no", text: "Solo vista previa, la descarga completa es de pago" },
          { state: "yes", text: "Sí" },
        ],
      },
      {
        label: "Sin necesidad de cuenta",
        cells: [
          { state: "yes", text: "Sí" },
          { state: "no", text: "Cuenta obligatoria para ver resultados" },
          { state: "yes", text: "Sí" },
        ],
      },
      {
        label: "Modelos nombrados",
        cells: [
          { state: "yes", text: "htdemucs, MelBand RoFormer", sub: "código abierto, verificable" },
          { state: "partial", text: "Motor Andromeda, cerrado" },
          { state: "unknown", text: "No lo dicen" },
        ],
      },
      {
        label: "Especificación de salida publicada",
        cells: [
          { state: "yes", text: "WAV 16-bit 44.1 kHz" },
          { state: "unknown", text: "No lo dicen" },
          { state: "unknown", text: "No lo dicen" },
        ],
      },
      {
        label: "Mezclar pistas en el navegador",
        cells: [
          { state: "yes", text: "Forge Mixer", sub: "silenciar, solo, paneo, loop, exportar" },
          { state: "no", text: "Solo fragmentos de vista previa" },
          { state: "no", text: "Solo reproducción" },
        ],
      },
      {
        label: "Nivel de pago",
        cells: [
          { text: "1 crédito por proceso, nunca caducan" },
          { text: "Suscripción mensual, más recargas de minutos" },
          { text: "No tiene, se financia con donaciones" },
        ],
      },
    ],
    footnote: "Verificado en sus propias páginas el 21 de septiembre de 2026. Los detalles pueden cambiar.",
    ctaTitle: "Prueba la misma canción en los dos.",
    ctaBody:
      "La vista previa de cualquier herramienta de pago contra AudioForges, misma canción, misma sección. Es la única comparación que importa y no cuesta nada.",
  },
  faqs: [
    {
      question: "¿Hay una forma de quitar la voz de una canción gratis y sin registro?",
      answer:
        "Sí, esta página. AudioForges separa canciones completas gratis, sin cuenta, y el resultado se descarga como WAV completo. Para el resultado más limpio, Studio Quality usa el modelo MelBand RoFormer por un crédito por canción, sin suscripción, y los créditos nunca caducan.",
    },
    {
      question: "¿Guardan mis archivos?",
      answer:
        "Tu archivo se conserva solo el tiempo necesario para procesarlo y luego se borra automáticamente junto con las pistas separadas. No hay cuentas, así que nada queda vinculado a ti, ni se publica, ni se comparte.",
    },
    {
      question: "¿Qué es Studio Quality?",
      answer:
        "Un segundo nivel que usa MelBand RoFormer en lugar de htdemucs. Es otra arquitectura, no el mismo modelo forzado, y la diferencia se oye: muchos menos restos de voz en el instrumental y menos artefactos acuosos en platillos y respiraciones. Tarda 1 a 2 minutos y cuesta un crédito por proceso después del cupo gratis mensual.",
    },
    {
      question: "¿Funciona con grabaciones en vivo?",
      answer:
        "Funciona, pero el resultado no queda tan limpio como con una mezcla de estudio. El ruido del público y las filtraciones del escenario son más difíciles de distinguir de la voz para el modelo.",
    },
    {
      question: "¿Mejora la calidad del audio?",
      answer:
        "No. La herramienta aísla lo que ya está en la mezcla. No remasteriza ni agrega calidad que la grabación original no tenía, y la salida siempre es WAV estéreo 16-bit 44.1 kHz sin importar qué archivo subas.",
    },
  ],
  formatsFaq: {
    question: "¿Qué formatos puedo subir y cuál es el límite de tamaño?",
    answer:
      "{formats}, hasta {size} por subida. La calidad Standard está limitada por dirección IP para que siga siendo gratis para todos.",
  },
  byline: {
    note: "Versión en español de la página",
    legal:
      "Eres responsable de tener los derechos de la canción que subes. AudioForges no guarda ni distribuye las canciones procesadas aquí.",
  },
  form: {
    toolLabel: "Quitar voz",
    dropTitle: "Suelta una canción",
    standardName: "Estándar",
    standardTime: "20 s a 1 min",
    studioTime: "1 a 2 min",
    action: "Quitar la voz",
    actionStudio: "Quitar la voz en Studio Quality",
    tryAgain: "Intentar de nuevo",
    tryAgainIn: "Reintenta en {t}",
    demoCaption: "Escucha primero un resultado: la pista de voz",
    demoNudge: "Ahora cambia a Studio Quality y escucha cómo desaparecen los restos de música",
    demoCredit: "What Would It Mean, de H4RRIS feat. Nicole Apollonio, usada con permiso",
    costNoteOne: "{n} crédito por canción después de tus usos gratis",
    costNoteMany: "{n} créditos por canción después de tus usos gratis",
    reset: "Separar otra canción",
    doneFallback: "Separación completa",
    stage: {
      done: "Listo",
      release: "Suéltala",
      dropHint: "En cualquier parte de este panel, o",
      chooseLink: "elige un archivo",
      chooseButton: "Elegir archivo",
      replace: "Cambiar",
      remove: "Quitar",
      cancel: "Cancelar",
      usually: "normalmente",
      working: "Procesando",
    },
  },
};

export const ptDict: VocalRemoverDict = {
  locale: "pt",
  path: vocalRemoverLocales.pt,
  updated: "2026-09-21",
  pageTitle: "Remover Vocal de Música Grátis: Separador de Voz com IA",
  pageDescription:
    "Remova o vocal de qualquer música grátis com IA. Baixe o instrumental e o acapella em WAV completo. Sem cadastro, sem marca d'água, direto no navegador.",
  ogTitle: "Remover Vocal de Música Grátis",
  appName: "Removedor de Vocal IA",
  appAlternateNames: [
    "Remover Vocal",
    "Remover Vocal Online",
    "Removedor de Voz",
    "Separador de Voz",
    "Extrator de Acapella",
    "Criador de Karaokê",
    "Criador de Instrumental",
  ],
  breadcrumbTools: "Ferramentas",
  breadcrumbSelf: "Remover Vocal",
  heroTitle: "Remover Vocal de Música",
  heroLede:
    "Envie uma música e receba o vocal e o instrumental como dois arquivos WAV separados. Sem criar conta, sem instalar nada.",
  heroMeta: ["Sem conta", "Sem marca d'água", "WAV completo"],
  proofs: [
    {
      label: "Modelos",
      value: "htdemucs e MelBand RoFormer",
      note: "Dizemos o nome dos modelos para você poder conferir. Separação de fontes de verdade, não um truque de canal central.",
    },
    {
      label: "Saída",
      value: "WAV estéreo 16-bit 44.1 kHz",
      note: "Sem perdas, com a especificação publicada. A maioria das ferramentas dessa categoria nunca diz.",
    },
    {
      label: "Preço",
      value: "Músicas completas grátis, sem marca d'água",
      note: "Sem conta, sem nível que só deixa ouvir. Limitado por IP para continuar grátis para todo mundo.",
    },
  ],
  hear: {
    title: "Ouça a diferença",
    intro:
      "A pista de vocal dos dois níveis, na mesma música. Clique em uma faixa para alternar enquanto toca; a posição de reprodução não muda, então você ouve o mesmo compasso duas vezes. Arraste sobre uma faixa para repetir o trecho que quiser comparar.",
    stemLabel: "Vocal",
    trackLabel: "Mixagem completa com vocal principal",
    cues: [
      { at: 2, label: "entrada do vocal" },
      { at: 21, label: "refrão" },
      { at: 37, label: "pico do vocal" },
    ],
    credit: "Música: What Would It Mean de H4RRIS feat. Nicole Apollonio, usada com permissão",
  },
  mixer: {
    title: "Ajuste a mixagem antes de baixar",
    intro:
      "O resultado abre no Forge Mixer, um player de duas faixas embutido nesta página. As duas pistas rodam no mesmo relógio, então nunca desalinham. Ajuste o balanço do seu jeito e exporte como WAV sem sair do navegador.",
    points: [
      "Mudo, solo, volume até 150% e pan completo em cada pista.",
      "Presets de Karaokê e Acapella, com um toque.",
      "Arraste na linha do tempo para repetir um trecho, com precisão de amostra.",
      "Exporte a mixagem que você ajustou como WAV. Processado no seu aparelho, sem gastar créditos.",
    ],
  },
  stems: {
    title: "Duas pistas, quatro usos",
    outputs: [
      {
        name: "Instrumental",
        desc: "A mixagem completa com a voz removida. Bateria, baixo e todo o resto ficam intactos.",
      },
      {
        name: "Vocal",
        desc: "Vocal principal e backing vocals sozinhos. Serve como acapella do jeito que vem.",
      },
    ],
    jobs: [
      { name: "Karaokê", uses: "instrumental", desc: "Cante sobre o arranjo original, não sobre uma versão MIDI." },
      { name: "Remix", uses: "either", desc: "Construa sobre uma base limpa ou um hook limpo." },
      { name: "Mashup de DJ", uses: "vocals", desc: "Coloque o acapella de uma música sobre o instrumental de outra." },
      { name: "Referência para covers", uses: "instrumental", desc: "Ouça cada parte com clareza sem o vocal principal por cima." },
    ],
  },
  tiers: {
    title: "Padrão vs. Studio Quality",
    labels: {
      model: "Modelo",
      bleed: "Resto de vocal no instrumental",
      artifacts: "Artefatos aquosos",
      time: "Tempo",
      limit: "Limite",
      cost: "Custo",
    },
    columns: ["Padrão", "Studio Quality"],
    bleedCells: ["Aparece em mixagens densas e caudas longas de reverb", "Some em quase todo material"],
    artifactCells: ["Em pratos, respirações e sibilância", "Pratos e consoantes ficam intactos"],
    timeCells: ["20 segundos a 1 minuto", "1 a 2 minutos"],
    limitSubStandard: "compartilhado entre todas as ferramentas de separação",
    limitSubHq: "no nível gratuito",
    costCells: ["Grátis, para sempre", "Cota grátis mensal, depois 1 crédito por processo"],
    costSubHq: "cota compartilhada entre as ferramentas Studio Quality",
  },
  compare: {
    title: "Comparado com as ferramentas pagas",
    intro:
      "Cada célula abaixo pode ser conferida nas páginas dos próprios sites. Nenhuma afirmação aqui é impossível de verificar; a demo acima e os seus ouvidos julgam o resto.",
    columns: ["AudioForges", "LALAL.AI", "Vocalremover.org"],
    rows: [
      {
        label: "Resultado completo sem pagar",
        cells: [
          { state: "yes", text: "Sim" },
          { state: "no", text: "Só prévia, o download completo é pago" },
          { state: "yes", text: "Sim" },
        ],
      },
      {
        label: "Sem precisar de conta",
        cells: [
          { state: "yes", text: "Sim" },
          { state: "no", text: "Conta obrigatória para ver resultados" },
          { state: "yes", text: "Sim" },
        ],
      },
      {
        label: "Modelos com nome divulgado",
        cells: [
          { state: "yes", text: "htdemucs, MelBand RoFormer", sub: "código aberto, verificável" },
          { state: "partial", text: "Motor Andromeda, fechado" },
          { state: "unknown", text: "Não informam" },
        ],
      },
      {
        label: "Especificação de saída publicada",
        cells: [
          { state: "yes", text: "WAV 16-bit 44.1 kHz" },
          { state: "unknown", text: "Não informam" },
          { state: "unknown", text: "Não informam" },
        ],
      },
      {
        label: "Mixar pistas no navegador",
        cells: [
          { state: "yes", text: "Forge Mixer", sub: "mudo, solo, pan, loop, exportar" },
          { state: "no", text: "Só trechos de prévia" },
          { state: "no", text: "Só reprodução" },
        ],
      },
      {
        label: "Nível pago",
        cells: [
          { text: "1 crédito por processo, nunca expiram" },
          { text: "Assinatura mensal, mais recargas de minutos" },
          { text: "Não tem, financiado por doações" },
        ],
      },
    ],
    footnote: "Conferido nas páginas deles em 21 de setembro de 2026. Os detalhes podem mudar.",
    ctaTitle: "Teste a mesma música nos dois.",
    ctaBody:
      "A prévia de qualquer ferramenta paga contra o AudioForges, mesma música, mesmo trecho. É a única comparação que importa e não custa nada.",
  },
  faqs: [
    {
      question: "Existe um removedor de vocal grátis e sem cadastro?",
      answer:
        "Existe, esta página. O AudioForges separa músicas completas grátis, sem conta, e o resultado sai como WAV completo para download. Para o resultado mais limpo, o Studio Quality usa o modelo MelBand RoFormer por um crédito por música, sem assinatura, e os créditos nunca expiram.",
    },
    {
      question: "Meus arquivos ficam guardados?",
      answer:
        "Seu arquivo fica guardado só o tempo necessário para o processamento e depois é apagado automaticamente junto com as pistas separadas. Não há contas, então nada fica ligado a você, nem é publicado, nem compartilhado.",
    },
    {
      question: "O que é Studio Quality?",
      answer:
        "Um segundo nível que usa MelBand RoFormer no lugar do htdemucs. É outra arquitetura, não o mesmo modelo forçado, e a diferença dá para ouvir: muito menos resto de vocal no instrumental e menos artefatos aquosos em pratos e respirações. Leva 1 a 2 minutos e custa um crédito por processo depois da cota grátis mensal.",
    },
    {
      question: "Funciona com gravações ao vivo?",
      answer:
        "Funciona, mas o resultado não fica tão limpo quanto com uma mixagem de estúdio. O barulho da plateia e o vazamento do palco são mais difíceis de separar do vocal para o modelo.",
    },
    {
      question: "A qualidade do áudio melhora?",
      answer:
        "Não. A ferramenta isola o que já está na mixagem. Ela não remasteriza nem adiciona qualidade que a gravação original não tinha, e a saída é sempre WAV estéreo 16-bit 44.1 kHz, não importa o arquivo que você envie.",
    },
  ],
  formatsFaq: {
    question: "Quais formatos posso enviar e qual é o limite de tamanho?",
    answer:
      "{formats}, até {size} por envio. A qualidade Standard é limitada por endereço IP para continuar grátis para todo mundo.",
  },
  byline: {
    note: "Versão em português da página",
    legal:
      "Você é responsável por ter os direitos da música que envia. O AudioForges não guarda nem distribui as músicas processadas aqui.",
  },
  form: {
    toolLabel: "Remover vocal",
    dropTitle: "Solte uma música",
    standardName: "Padrão",
    standardTime: "20 s a 1 min",
    studioTime: "1 a 2 min",
    action: "Remover o vocal",
    actionStudio: "Remover o vocal em Studio Quality",
    tryAgain: "Tentar de novo",
    tryAgainIn: "Tente de novo em {t}",
    demoCaption: "Ouça um resultado primeiro: a faixa de voz",
    demoNudge: "Agora mude para Studio Quality e ouça os restos da música sumirem",
    demoCredit: "What Would It Mean, de H4RRIS feat. Nicole Apollonio, usada com permissão",
    costNoteOne: "{n} crédito por música depois dos seus usos grátis",
    costNoteMany: "{n} créditos por música depois dos seus usos grátis",
    reset: "Separar outra música",
    doneFallback: "Separação concluída",
    stage: {
      done: "Pronto",
      release: "Pode soltar",
      dropHint: "Em qualquer lugar deste painel, ou",
      chooseLink: "escolha um arquivo",
      chooseButton: "Escolher arquivo",
      replace: "Trocar",
      remove: "Remover",
      cancel: "Cancelar",
      usually: "normalmente",
      working: "Processando",
    },
  },
};