import { RAILWAY_API_BASE } from "@/lib/api/railway";

export interface StudioPassOffer {
  available: boolean;
  priceUsd: number;
  songsPerMonth: number;
  optionsIncluded: boolean;
  rolloverMonths: number;
}

export interface StudioConfig {
  youtubeStudio: boolean;
  vocalOptions: boolean;
  sixStems: boolean;
  optionSongs: number;
  sixStemSongs: number;
  freeRunCoversExtras: boolean;
  preview: boolean;
  previewSeconds: number;
  previewOnClick: boolean;
  googleSignin: boolean;
  video: { formats: string[]; maxMb: number; audioMaxMb: number };
  signupBonusSongs: number;
  freeNeedsAccount: boolean;
  referral: { enabled: boolean; rewardSongs: number };
  library: { enabled: boolean; retentionDays: number };
  pass: StudioPassOffer;
}

export const STUDIO_CONFIG_OFF: StudioConfig = {
  youtubeStudio: false,
  vocalOptions: false,
  sixStems: false,
  optionSongs: 1,
  sixStemSongs: 0,
  freeRunCoversExtras: false,
  preview: false,
  previewSeconds: 30,
  previewOnClick: true,
  googleSignin: false,
  video: { formats: [], maxMb: 95, audioMaxMb: 0 },
  signupBonusSongs: 0,
  freeNeedsAccount: false,
  referral: { enabled: false, rewardSongs: 0 },
  library: { enabled: false, retentionDays: 30 },
  pass: { available: false, priceUsd: 7.99, songsPerMonth: 40, optionsIncluded: true, rolloverMonths: 2 },
};

type Raw = Record<string, unknown>;

const obj = (v: unknown): Raw => (v && typeof v === "object" ? (v as Raw) : {});
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

export function parseStudioConfig(data: unknown): StudioConfig {
  const d = obj(data);
  const off = STUDIO_CONFIG_OFF;
  const video = obj(d.video_input);
  const referral = obj(d.referral);
  const library = obj(d.library);
  const pass = obj(d.studio_pass);
  return {
    youtubeStudio: bool(d.youtube_studio, off.youtubeStudio),
    vocalOptions: bool(d.vocal_options, off.vocalOptions),
    sixStems: bool(d.six_stems, off.sixStems),
    optionSongs: num(d.option_credits, off.optionSongs),
    sixStemSongs: num(d.six_stem_credits, off.sixStemSongs),
    freeRunCoversExtras: bool(d.free_run_covers_extras, off.freeRunCoversExtras),
    preview: bool(d.preview, off.preview),
    previewSeconds: num(d.preview_seconds, off.previewSeconds),
    previewOnClick: bool(d.preview_on_click, off.previewOnClick),
    googleSignin: bool(d.google_signin, off.googleSignin),
    video: {
      formats: Array.isArray(video.formats) ? video.formats.filter((f): f is string => typeof f === "string") : [],
      maxMb: num(video.max_mb, off.video.maxMb),
      audioMaxMb: num(video.audio_max_mb, off.video.audioMaxMb),
    },
    signupBonusSongs: num(d.signup_bonus_credits, off.signupBonusSongs),
    freeNeedsAccount: bool(d.free_needs_account, off.freeNeedsAccount),
    referral: {
      enabled: bool(referral.enabled, off.referral.enabled),
      rewardSongs: num(referral.reward_credits, off.referral.rewardSongs),
    },
    library: {
      enabled: bool(library.enabled, off.library.enabled),
      retentionDays: num(library.retention_days, off.library.retentionDays),
    },
    pass: {
      available: bool(pass.available, off.pass.available),
      priceUsd: num(pass.price_usd, off.pass.priceUsd),
      songsPerMonth: num(pass.credits_per_month, off.pass.songsPerMonth),
      optionsIncluded: bool(pass.options_included, off.pass.optionsIncluded),
      rolloverMonths: num(pass.rollover_months, off.pass.rolloverMonths),
    },
  };
}

export async function fetchStudioConfig(): Promise<StudioConfig> {
  const res = await fetch(`${RAILWAY_API_BASE}/studio/config`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`studio config ${res.status}`);
  return parseStudioConfig(await res.json());
}