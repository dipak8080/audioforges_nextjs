"use client";

import { useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Loader2, MessageCircle } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";

const TAWK_SRC = "https://embed.tawk.to/6ab7ab71ebd8ee3448286bd9/1k3enbd4s";

const PAID_PATHS = [
  "/",
  "/vocal-remover",
  "/stems",
  "/youtube-vocal-remover",
  "/youtube-stem-splitter",
  "/acapella-extractor",
  "/instrumental-maker",
  "/drum-remover",
  "/bass-remover",
  "/echo-reverb-remover",
  "/lead-backing-vocal-splitter",
  "/audio-to-midi",
  "/audio-to-sheet-music",
  "/pricing",
  "/account",
  "/es/quitar-voz-de-una-cancion",
  "/pt/remover-vocal",
  "/id/penghilang-vokal",
];

type TawkApi = {
  onLoad?: () => void;
  onChatMinimized?: () => void;
  hideWidget?: () => void;
  showWidget?: () => void;
  maximize?: () => void;
};

declare global {
  interface Window {
    Tawk_API?: TawkApi;
    Tawk_LoadStart?: Date;
  }
}

let loading: Promise<void> | null = null;

function loadTawk(): Promise<void> {
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const api: TawkApi = window.Tawk_API ?? {};
    window.Tawk_API = api;
    window.Tawk_LoadStart = new Date();
    api.onLoad = () => resolve();
    api.onChatMinimized = () => window.Tawk_API?.hideWidget?.();
    const s = document.createElement("script");
    s.async = true;
    s.src = TAWK_SRC;
    s.charset = "UTF-8";
    s.setAttribute("crossorigin", "*");
    document.body.appendChild(s);
    window.setTimeout(resolve, 15_000);
  });
  return loading;
}

export function ChatWithDipak() {
  const { t } = useI18n();
  const pathname = usePathname() ?? "/";
  const [busy, setBusy] = useState(false);
  const [photoOk, setPhotoOk] = useState(true);
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  if (!PAID_PATHS.includes(path)) return null;

  async function open() {
    setBusy(true);
    await loadTawk();
    setBusy(false);
    window.Tawk_API?.showWidget?.();
    window.Tawk_API?.maximize?.();
  }

  return (
    <button
      type="button"
      onClick={() => void open()}
      aria-label={t.chat.button}
      className="group fixed bottom-4 right-4 z-[55] flex items-center gap-3 rounded-full border border-graphite-700 bg-graphite-900/95 py-2 pl-2 pr-4 shadow-2xl backdrop-blur transition-colors hover:border-amber-500/50 print:hidden"
    >
      <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-graphite-800 font-display text-lg text-text-primary">
        {photoOk ? (
          <Image
            src="/images/dipak.jpg"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 rounded-full object-cover"
            onError={() => setPhotoOk(false)}
          />
        ) : (
          "D"
        )}
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-graphite-900 bg-amber-500" />
      </span>
      <span className="hidden text-left sm:block">
        <span className="block text-sm text-text-primary">{busy ? t.chat.opening : t.chat.button}</span>
        <span className="block text-[11px] text-text-muted">{t.chat.reply}</span>
      </span>
      {busy ? (
        <Loader2 className="h-4 w-4 text-amber-400 motion-safe:animate-spin sm:hidden" />
      ) : (
        <MessageCircle className="h-4 w-4 text-amber-400 sm:hidden" />
      )}
    </button>
  );
}