"use client";

import { useId, useMemo, useRef, useState } from "react";
import { FileAudio, Film, Layers, Link2, Sparkles, SplitSquareVertical, Upload, Waves } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FileDropOverlay } from "@/components/ui/FileDropOverlay";
import { OptionCards, Segmented, ToggleRow } from "@/components/converter/ToolControls";
import { useI18n } from "@/components/i18n/I18nProvider";
import { PeaksBars } from "./PeaksBars";
import { cn } from "@/lib/utils/cn";
import { useStudioConfig } from "@/lib/studio/use-studio-config";
import { useStudioPrice } from "@/lib/studio/price";
import {
  estimateSongs,
  sanitizeSelection,
  stemCountOf,
  studioTool,
  vocalOptionsOf,
  STUDIO_PRESETS,
  type InputSource,
  type StemOutput,
  type StudioPresetKey,
  type StudioSelection,
} from "@/lib/studio/presets";
import type { StudioEngine } from "@/lib/studio/run";
import { fileExt, formatDuration, isYoutubeUrl, readLocalAudio, type LocalAudio } from "@/lib/studio/local-audio";

const AUDIO_EXTS = ["mp3", "wav", "flac", "m4a", "aac", "ogg", "aiff"];
const FALLBACK_VIDEO_EXTS = ["mp4", "mov", "mkv", "avi", "webm", "flv", "wmv", "m4v", "3gp", "mpeg", "mpg"];


export interface StudioStartRequest {
  engine: StudioEngine;
  source: { kind: "file"; files: File[] } | { kind: "link"; url: string };
  selection: StudioSelection;
  seconds: number | null;
}

type Picked = { files: File[]; audio: LocalAudio | null; decoding: boolean; error: string | null };

export function StudioInput({
  preset,
  onStart,
  busy = false,
  hidden = false,
}: {
  preset: StudioPresetKey;
  hidden?: boolean;
  onStart: (req: StudioStartRequest) => void;
  busy?: boolean;
}) {
  const { t, fill, plural } = useI18n();
  const p = t.panel;
  const { config } = useStudioConfig();
  const base = STUDIO_PRESETS[preset];
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const decodeToken = useRef(0);

  const [rawSelection, setSelection] = useState<StudioSelection>({
    output: base.output,
    dereverb: base.dereverb,
    leadBack: base.leadBack,
  });
  const [rawSource, setSource] = useState<InputSource>(base.source);
  const [picked, setPicked] = useState<Picked>({ files: [], audio: null, decoding: false, error: null });
  const [url, setUrl] = useState("");

  const selection = sanitizeSelection(rawSelection, config);
  const source: InputSource = rawSource === "link" && !config.youtubeStudio ? "file" : rawSource;
  const videoExts = config.video.formats.length ? config.video.formats : FALLBACK_VIDEO_EXTS;
  const accept = [...AUDIO_EXTS, ...videoExts].map((e) => `.${e}`).join(",");
  const seconds = source === "file" && picked.files.length === 1 ? picked.audio?.duration ?? null : null;
  const batch = source === "file" && picked.files.length > 1;

  const price = useStudioPrice({
    tool: studioTool(selection.output, source),
    vocalOptions: vocalOptionsOf(selection),
    stemCount: stemCountOf(selection),
    inputSeconds: seconds,
  });

  const perSong = price?.billable ? price.songs : estimateSongs(selection, config);
  const totalSongs = batch ? perSong * picked.files.length : perSong;
  const freeSong = !batch && price?.willUse === "free";
  const canAffordStudio = !!price && (freeSong || price.balance >= totalSongs);
  const linkValid = isYoutubeUrl(url);
  const hasInput = source === "file" ? picked.files.length > 0 && !picked.error : linkValid;

  const priceLabel = freeSong ? p.priceFreeSong : fill(p.priceStudio, { songs: plural(totalSongs, t.songs.count) });

  function validate(file: File): string | null {
    const ext = fileExt(file.name);
    const isVideo = videoExts.includes(ext) || file.type.startsWith("video/");
    if (!isVideo && !AUDIO_EXTS.includes(ext) && !file.type.startsWith("audio/")) return p.unsupported;
    const maxMb = isVideo ? config.video.maxMb : config.video.audioMaxMb;
    if (maxMb > 0 && file.size > maxMb * 1024 * 1024) return fill(p.tooBig, { mb: maxMb });
    return null;
  }

  function pick(list: FileList | File[] | null) {
    const files = Array.from(list ?? []).slice(0, 20);
    if (files.length === 0) return;
    const error = files.map(validate).find(Boolean) ?? null;
    const token = ++decodeToken.current;
    setSource("file");
    setPicked({ files, audio: null, decoding: !error && files.length === 1, error });
    if (error || files.length !== 1) return;
    void readLocalAudio(files[0]).then((audio) => {
      if (decodeToken.current === token) setPicked((cur) => ({ ...cur, audio, decoding: false }));
    });
  }

  function start(engine: StudioEngine) {
    if (!hasInput || busy) return;
    const req: StudioStartRequest = {
      engine,
      source: source === "file" ? { kind: "file", files: picked.files } : { kind: "link", url: url.trim() },
      selection,
      seconds,
    };
    onStart(req);
  }

  const outputOptions = useMemo(
    () =>
      [
        { value: "2", title: p.out2, detail: p.out2Desc },
        { value: "4", title: p.out4, detail: p.out4Desc },
        ...(config.sixStems
          ? [{ value: "6", title: p.out6, detail: p.out6Desc, meta: config.sixStemSongs === 0 ? p.sameAs4 : undefined }]
          : []),
      ] as { value: "2" | "4" | "6"; title: string; detail: string; meta?: string }[],
    [p, config.sixStems, config.sixStemSongs]
  );

  const optionMeta = config.pass.optionsIncluded && price?.waivedSongs ? p.includedPass : plural(config.optionSongs, p.plusSongs);
  const file = picked.files[0];
  const isVideoFile = file ? videoExts.includes(fileExt(file.name)) : false;

  return (
    <section
      hidden={hidden}
      className="surface grain relative overflow-hidden rounded-2xl border border-graphite-800 bg-graphite-900"
    >
      <FileDropOverlay onFile={(f) => pick([f])} disabled={busy || hidden} label={p.dropTitle} />

      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-graphite-800 px-5 py-3.5">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(232,162,61,0.7)]" />
          {p.engine}
        </span>
        <span
          className={cn(
            "rounded-full border px-3 py-1 font-mono text-[11px] tracking-wider",
            freeSong ? "border-teal-500/40 text-teal-400" : "border-amber-500/40 text-amber-400"
          )}
          aria-live="polite"
        >
          {priceLabel}
        </span>
      </header>

      <div className="grid gap-px bg-graphite-800 md:grid-cols-[1.35fr_1fr]">
        <div className="flex flex-col gap-4 bg-graphite-900 p-5">
          {config.youtubeStudio && (
            <Segmented
              label={p.tabUpload}
              value={source}
              onChange={(v) => setSource(v)}
              options={[
                { value: "file", label: p.tabUpload, icon: <Upload className="h-3.5 w-3.5" /> },
                { value: "link", label: p.tabLink, icon: <Link2 className="h-3.5 w-3.5" /> },
              ]}
            />
          )}

          {source === "file" ? (
            <div
              className={cn(
                "relative flex min-h-56 flex-1 flex-col justify-between overflow-hidden rounded-xl border border-dashed p-5 transition-colors",
                picked.files.length ? "border-graphite-700 bg-graphite-850" : "border-graphite-700 hover:border-graphite-600"
              )}
            >
              <input
                ref={fileRef}
                id={inputId}
                type="file"
                accept={accept}
                multiple
                className="sr-only"
                onChange={(e) => {
                  pick(e.target.files);
                  e.target.value = "";
                }}
              />
              {picked.files.length === 0 ? (
                <>
                  <div>
                    <p className="display text-4xl text-text-primary md:text-5xl">{p.dropTitle}</p>
                    <p className="mt-2 text-sm text-text-muted">{fill(p.dropHint, { mb: config.video.maxMb })}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                      <Upload />
                      {p.chooseFile}
                    </Button>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-text-subtle">
                      {AUDIO_EXTS.slice(0, 5).join(" · ")} · MP4 · MOV
                    </span>
                  </div>
                </>
              ) : batch ? (
                <>
                  <div className="flex items-start gap-3">
                    <Layers className="mt-1 h-5 w-5 text-amber-400" />
                    <div>
                      <p className="text-lg text-text-primary">{plural(picked.files.length, p.batch)}</p>
                      <p className="mt-1 font-mono text-[11px] text-text-muted">{p.batchStudioOnly}</p>
                    </div>
                  </div>
                  <ul className="mt-3 max-h-32 space-y-1 overflow-auto font-mono text-[11px] text-text-body">
                    {picked.files.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="truncate">
                        {String(i + 1).padStart(2, "0")} {f.name}
                      </li>
                    ))}
                  </ul>
                  <ChangeRow label={p.changeFile} onClick={() => fileRef.current?.click()} />
                </>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      {isVideoFile ? (
                        <Film className="mt-0.5 h-5 w-5 shrink-0 text-text-muted" />
                      ) : (
                        <FileAudio className="mt-0.5 h-5 w-5 shrink-0 text-text-muted" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-text-primary">{file?.name}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-text-muted">
                          {picked.error ??
                            (picked.decoding
                              ? p.decoding
                              : [
                                  picked.audio ? formatDuration(picked.audio.duration) : null,
                                  file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · "))}
                        </p>
                      </div>
                    </div>
                    <ChangeRow label={p.changeFile} onClick={() => fileRef.current?.click()} inline />
                  </div>
                  <div className="mt-4 h-20">
                    {picked.audio ? (
                      <PeaksBars peaks={picked.audio.peaks} />
                    ) : (
                      <div className={cn("h-full rounded-md bg-graphite-800/60", picked.decoding && "animate-pulse")} />
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex min-h-56 flex-1 flex-col justify-center gap-3 rounded-xl border border-graphite-700 bg-graphite-850 p-5">
              <label htmlFor={`${inputId}-url`} className="display text-3xl text-text-primary">
                {p.tabLink}
              </label>
              <input
                id={`${inputId}-url`}
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder={p.linkPlaceholder}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full rounded-lg border border-graphite-700 bg-graphite-900 px-3.5 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-subtle focus-visible:border-amber-500/60"
              />
              <p className={cn("text-xs", url && !linkValid ? "text-red-400" : "text-text-muted")}>
                {url && !linkValid ? p.linkInvalid : p.linkHint}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5 bg-graphite-900 p-5">
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-text-subtle">{p.output}</p>
            <OptionCards
              label={p.output}
              columns={1}
              value={String(selection.output) as "2" | "4" | "6"}
              onChange={(v) => setSelection((s) => ({ ...s, output: Number(v) as StemOutput }))}
              options={outputOptions}
            />
          </div>

          {config.vocalOptions && (
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-text-subtle">{p.options}</p>
              <div className="flex flex-col gap-2">
                <ToggleRow
                  pressed={selection.dereverb}
                  onToggle={() => setSelection((s) => ({ ...s, dereverb: !s.dereverb }))}
                  iconOn={<Waves className="h-4 w-4" />}
                  iconOff={<Waves className="h-4 w-4" />}
                >
                  <OptionLabel name="Forge Clean" desc={p.cleanDesc} meta={optionMeta} />
                </ToggleRow>
                <ToggleRow
                  pressed={selection.leadBack}
                  onToggle={() => setSelection((s) => ({ ...s, leadBack: !s.leadBack }))}
                  iconOn={<SplitSquareVertical className="h-4 w-4" />}
                  iconOff={<SplitSquareVertical className="h-4 w-4" />}
                >
                  <OptionLabel name="Forge Split" desc={p.splitDesc} meta={optionMeta} />
                </ToggleRow>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="flex flex-col gap-3 border-t border-graphite-800 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <p className="font-mono text-[11px] text-text-muted">
          {price && price.balance > 0 ? fill(p.balance, { songs: plural(price.balance, t.songs.count) }) : p.freeQueue}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          {!batch && (
            <Button
              variant={canAffordStudio ? "ghost" : "primary"}
              size="lg"
              disabled={!hasInput || busy}
              onClick={() => start("one")}
            >
              {p.runFree}
            </Button>
          )}
          <Button
            variant={canAffordStudio || batch ? "accent" : "outline"}
            size="lg"
            disabled={!hasInput || busy}
            loading={busy}
            onClick={() => start("studio")}
          >
            <Sparkles />
            {p.runStudio}
            <span className="font-mono text-xs opacity-70">· {freeSong ? p.priceFreeSong : plural(totalSongs, t.songs.count)}</span>
          </Button>
        </div>
      </footer>

    </section>
  );
}

function OptionLabel({ name, desc, meta }: { name: string; desc: string; meta: string }) {
  return (
    <span className="flex items-center justify-between gap-3">
      <span>
        <span className="block text-text-primary">{name}</span>
        <span className="block text-xs text-text-muted">{desc}</span>
      </span>
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider">{meta}</span>
    </span>
  );
}

function ChangeRow({ label, onClick, inline = false }: { label: string; onClick: () => void; inline?: boolean }) {
  return (
    <div className={cn(!inline && "mt-3")}>
      <Button variant="ghost" size="sm" onClick={onClick}>
        {label}
      </Button>
    </div>
  );
}