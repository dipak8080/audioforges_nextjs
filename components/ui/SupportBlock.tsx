"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { Heart, X } from "lucide-react";

type Mood = "happy" | "sheepish";
type PandaState = "pending" | "new" | "seen";

const KEY = "af-panda-swing-v2";

function subscribe() {
  return () => {};
}

function getSnapshot(): PandaState {
  try {
    return sessionStorage.getItem(KEY) ? "seen" : "new";
  } catch {
    return "seen";
  }
}

function getServerSnapshot(): PandaState {
  return "pending";
}

function markSeen() {
  try {
    sessionStorage.setItem(KEY, "seen");
  } catch {}
}

const CSS = `
.af-sb{position:relative}
.af-sb[data-panda="1"]{padding-top:60px}
.af-sb-card{position:relative;animation:af-enter .45s ease-out both;transition:translate .2s ease,color .2s,border-color .2s}
.af-sb[data-first="1"] .af-sb-card{animation:af-enter .45s ease-out both,af-glow 1.4s ease-in-out 1.4s 2}
.af-sb-heart{animation:af-beat 3s ease-in-out 1s infinite}
.af-sb-panda{position:absolute;left:18px;top:-4px;width:104px;height:90px;pointer-events:none;z-index:2;transition:translate .2s ease;filter:drop-shadow(0 3px 4px rgba(0,0,0,.35))}
.af-sb-panda[data-wait="1"]{visibility:hidden}
.af-sb:hover .af-sb-card,.af-sb:hover .af-sb-panda{translate:0 -2px}
.af-swing{transform-origin:42px -150px}
.af-sb-panda[data-swing="1"] .af-swing{animation:af-swing 1.05s cubic-bezier(.4,0,.3,1) .35s both}
.af-land{transform-box:view-box;transform-origin:42px 66px}
.af-sb-panda[data-swing="1"] .af-land{animation:af-land .4s ease-out 1.35s both}
.af-web,.af-armup{opacity:0}
.af-sb-panda[data-swing="1"] .af-web,.af-sb-panda[data-swing="1"] .af-armup{animation:af-hold 1.4s linear .35s both}
.af-sb-panda[data-swing="1"] .af-armmouth{animation:af-show 1.4s linear .35s both}
.af-eyes{transform-box:fill-box;transform-origin:center;animation:af-blink 4.6s infinite}
.af-suck{transform-box:fill-box;transform-origin:0 100%;animation:af-suck 2.4s ease-in-out infinite}
.af-leg{transform-box:fill-box;transform-origin:50% 0}
.af-leg-l{animation:af-kick 2.2s ease-in-out infinite}
.af-leg-r{animation:af-kick 2.2s ease-in-out -1.1s infinite}
.af-tail{transform-box:fill-box;transform-origin:0 100%;animation:af-wag 2.8s ease-in-out infinite alternate}
.af-drool{transform-box:fill-box;transform-origin:50% 0;animation:af-drool 5s ease-in infinite}
.af-joy,.af-bubble{opacity:0}
.af-bubble{transform-box:fill-box;transform-origin:0 100%}
.af-sb:hover .af-eyes,.af-sb:focus-within .af-eyes{opacity:0;animation:none}
.af-sb:hover .af-joy,.af-sb:focus-within .af-joy{opacity:1}
.af-sb:hover .af-bubble,.af-sb:focus-within .af-bubble{animation:af-pop .3s cubic-bezier(.3,1.6,.5,1) both}
.af-sb:hover .af-suck,.af-sb:focus-within .af-suck{animation:af-suck .3s ease-in-out infinite}
.af-sb:hover .af-leg-l,.af-sb:focus-within .af-leg-l{animation:af-kick .45s ease-in-out infinite}
.af-sb:hover .af-leg-r,.af-sb:focus-within .af-leg-r{animation:af-kick .45s ease-in-out -.22s infinite}
.af-sb:hover .af-tail,.af-sb:focus-within .af-tail{animation:af-wag .25s ease-in-out infinite alternate}
.af-sb:hover .af-bounce,.af-sb:focus-within .af-bounce{animation:af-bounce .45s ease-in-out infinite}
.af-bounce{transform-box:view-box;transform-origin:42px 66px}
.af-sb-close{opacity:.45;transition:opacity .2s,color .2s}
.af-sb:hover .af-sb-close,.af-sb-close:focus-visible{opacity:1}
@keyframes af-enter{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes af-glow{0%,100%{box-shadow:0 0 0 0 rgba(232,162,61,0)}50%{box-shadow:0 0 0 3px rgba(232,162,61,.28);border-color:rgba(232,162,61,.55)}}
@keyframes af-beat{0%,86%,100%{transform:scale(1)}90%{transform:scale(1.25)}94%{transform:scale(.95)}}
@keyframes af-swing{0%{opacity:0;transform:rotate(-62deg)}12%{opacity:1}62%{transform:rotate(16deg)}82%{transform:rotate(-6deg)}100%{opacity:1;transform:rotate(0)}}
@keyframes af-land{0%{transform:scale(1)}35%{transform:scale(1.12,.84)}70%{transform:scale(.95,1.06)}100%{transform:scale(1)}}
@keyframes af-hold{0%,72%{opacity:1}80%,100%{opacity:0}}
@keyframes af-show{0%,72%{opacity:0}80%,100%{opacity:1}}
@keyframes af-blink{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
@keyframes af-suck{0%,100%{transform:translate(0,0)}50%{transform:translate(.6px,-.8px)}}
@keyframes af-kick{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(9deg)}}
@keyframes af-wag{from{transform:rotate(-5deg)}to{transform:rotate(6deg)}}
@keyframes af-drool{0%,60%{opacity:0;transform:scale(.4)}75%{opacity:1;transform:scale(1)}90%{opacity:1;transform:translateY(2px) scale(1,1.25)}100%{opacity:0;transform:translateY(6px)}}
@keyframes af-pop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
@keyframes af-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}}
@media (prefers-reduced-motion:reduce){
.af-sb *,.af-sb-card,.af-sb-panda{animation:none!important;transition:none!important}
.af-sb:hover .af-sb-card,.af-sb:hover .af-sb-panda{translate:none}
.af-sb-panda .af-web,.af-sb-panda .af-armup{opacity:0!important}
.af-sb-panda .af-armmouth{opacity:1!important}
.af-sb:hover .af-bubble{opacity:1}
}
`;

const TAIL = "M55 62C72 62 80 46 72 32C68 26 62 28 64 33";

function Panda({ mood }: { mood: Mood }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const fur = `url(#${uid}f)`;
  const limb = `url(#${uid}l)`;
  const cream = `url(#${uid}c)`;
  const ink = "#1a1110";

  return (
    <svg viewBox="0 0 104 90" width="104" height="90" aria-hidden="true" className="overflow-visible">
      <defs>
        <radialGradient id={`${uid}f`} cx="45%" cy="35%" r="70%">
          <stop offset="0" stopColor="#e5763a" />
          <stop offset=".7" stopColor="#c2552b" />
          <stop offset="1" stopColor="#9c3f1d" />
        </radialGradient>
        <radialGradient id={`${uid}l`} cx="40%" cy="35%" r="75%">
          <stop offset="0" stopColor="#7a4636" />
          <stop offset="1" stopColor="#452720" />
        </radialGradient>
        <linearGradient id={`${uid}c`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffaf2" />
          <stop offset="1" stopColor="#f0dcc4" />
        </linearGradient>
      </defs>

      <g className="af-swing">
        <line className="af-web" x1="42" y1="-150" x2="42" y2="3" stroke="#e8e7e4" strokeWidth="1.3" />
        <g className="af-land">
          <g className="af-bounce">
            <g className="af-tail">
              <path d={TAIL} fill="none" stroke="#c2552b" strokeWidth="8" strokeLinecap="round" />
              <path d={TAIL} fill="none" stroke="#7a3217" strokeWidth="8" strokeDasharray="4.5 5" strokeDashoffset="2" />
            </g>

            <g className="af-leg af-leg-l">
              <path d="M35 62V79" stroke={limb} strokeWidth="8" strokeLinecap="round" />
              <ellipse cx="35" cy="81" rx="4.6" ry="3.6" fill="#452720" />
              <ellipse cx="35" cy="81.8" rx="2.4" ry="1.7" fill="#c98a80" />
            </g>
            <g className="af-leg af-leg-r">
              <path d="M49 62V79" stroke={limb} strokeWidth="8" strokeLinecap="round" />
              <ellipse cx="49" cy="81" rx="4.6" ry="3.6" fill="#452720" />
              <ellipse cx="49" cy="81.8" rx="2.4" ry="1.7" fill="#c98a80" />
            </g>

            <ellipse cx="42" cy="53" rx="17" ry="15" fill={fur} />
            <ellipse cx="42" cy="57" rx="9" ry="8" fill="#6a3120" opacity=".5" />
            <path d="M57 51C60 55 56 60 50 58" fill="none" stroke={limb} strokeWidth="6" strokeLinecap="round" />
            <circle cx="49" cy="58" r="3.6" fill={limb} />

            <g className="af-armup">
              <path d="M28 48C16 36 20 12 40 4" fill="none" stroke={limb} strokeWidth="6.5" strokeLinecap="round" />
              <circle cx="42" cy="4" r="4.2" fill={limb} />
            </g>

            <path d="M22 22C15 16 16 7 22 6C28 5 31 12 30 16Z" fill={fur} />
            <path d="M23 18C20 14 20 10 23 9C26 9 27 13 27 15Z" fill={cream} />
            <path d="M62 22C69 16 68 7 62 6C56 5 53 12 54 16Z" fill={fur} />
            <path d="M61 18C64 14 64 10 61 9C58 9 57 13 57 15Z" fill={cream} />
            <ellipse cx="42" cy="31" rx="22" ry="18" fill={fur} />
            {mood === "happy" ? (
              <path d="M28 23q4-3 8-.5q-4 2-8 .5ZM56 23q-4-3-8-.5q4 2 8 .5Z" fill={cream} />
            ) : (
              <path d="M29 20q4 .5 7 4q-4-.5-7-4ZM55 20q-4 .5-7 4q4-.5 7-4Z" fill={cream} />
            )}
            <path d="M33 33q-2.5 5-1.5 9M51 33q2.5 5 1.5 9" stroke="#8a3616" strokeWidth="2.6" strokeLinecap="round" fill="none" />
            <ellipse cx="27" cy="39" rx="7.5" ry="6.2" fill={cream} />
            <ellipse cx="57" cy="39" rx="7.5" ry="6.2" fill={cream} />
            <ellipse cx="42" cy="39.5" rx="9" ry="7" fill={cream} />

            <g className="af-eyes">
              <ellipse cx="35" cy="31" rx="4" ry="4.5" fill={ink} />
              <ellipse cx="49" cy="31" rx="4" ry="4.5" fill={ink} />
              <circle cx="36.6" cy="29.6" r="1.5" fill="#fff" />
              <circle cx="50.6" cy="29.6" r="1.5" fill="#fff" />
              <circle cx="34.2" cy="32.8" r=".7" fill="#fff" />
              <circle cx="48.2" cy="32.8" r=".7" fill="#fff" />
            </g>
            <path
              className="af-joy"
              d="M31 29.5l4.5 2-4.5 2M53 29.5l-4.5 2 4.5 2"
              fill="none"
              stroke={ink}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            <path d="M39.8 35.2q2.2-1.3 4.4 0q-.5 2-2.2 2.2q-1.7-.2-2.2-2.2Z" fill={ink} />
            <ellipse cx="42.4" cy="41.6" rx="2.4" ry="2" fill="#3a1512" />
            {mood === "happy" ? (
              <>
                <ellipse cx="25" cy="36.5" rx="3.3" ry="1.8" fill="#f08a80" opacity=".6" />
                <ellipse cx="59" cy="36.5" rx="3.3" ry="1.8" fill="#f08a80" opacity=".6" />
              </>
            ) : (
              <path d="M17 24q3 4 0 6q-3-2 0-6Z" fill="#8fd0f5" />
            )}
            <path className="af-drool" d="M45 43.5q1.4 2 0 3.2q-1.4-1.2 0-3.2Z" fill="#bfe6ff" />

            <g className="af-armmouth">
              <g className="af-suck">
                <path d="M31 49C26 46 30 42 36 43" fill="none" stroke={limb} strokeWidth="6.5" strokeLinecap="round" />
                <circle cx="38" cy="43.5" r="4.2" fill={limb} />
                <path d="M40.5 42.2L42.6 40.6" stroke="#6b3a2c" strokeWidth="2.4" strokeLinecap="round" />
              </g>
            </g>
          </g>
        </g>
      </g>

      <g className="af-bubble">
        <rect x="60" y="2" width="42" height="15" rx="7.5" fill="#f5e6d0" />
        <path d="M64 15l-4 6 9-4Z" fill="#f5e6d0" />
        <text x="81" y="12.6" fontSize="8" fontWeight="700" textAnchor="middle" fill="#3a1512">
          feed me?
        </text>
      </g>
    </svg>
  );
}

export function SupportBlock({
  mood = "happy",
  variant = "card",
}: {
  mood?: Mood;
  /** "line" is one quiet sentence, no mascot. Used inside the stage. */
  variant?: "card" | "line";
}) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [closed, setClosed] = useState(false);
  const showPanda = !closed;

  if (variant === "line") {
    return (
      <p className="text-xs text-text-subtle">
        AudioForges stays free because people chip in.{" "}
        <a
          href="https://ko-fi.com/audioforges"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-muted underline underline-offset-4 outline-none transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-400/70"
        >
          Support it
        </a>
      </p>
    );
  }

  return (
    <div
      className="af-sb"
      data-panda={showPanda ? "1" : undefined}
      data-first={state === "new" ? "1" : undefined}
    >
      <style href="af-support-block" precedence="default">
        {CSS}
      </style>

      <a
        href="https://ko-fi.com/audioforges"
        target="_blank"
        rel="noopener noreferrer"
        className={`af-sb-card flex items-center gap-3 rounded-lg border border-graphite-700 bg-graphite-900/40 text-sm hover:border-amber-500/40 ${
          showPanda ? "px-5 pb-4 pt-8" : "justify-center px-4 py-3"
        }`}
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-text-muted">
            {mood === "happy"
              ? "AudioForges stays free because people chip in."
              : "Every run costs server time, and supporters keep it free."}
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-amber-400">
            <Heart className="af-sb-heart h-3.5 w-3.5 fill-current" />
            Feed the hungry panda
          </span>
        </span>
      </a>

      {showPanda && (
        <>
          <div
            className="af-sb-panda"
            data-swing={state === "new" ? "1" : undefined}
            data-wait={state === "pending" ? "1" : undefined}
          >
            <Panda mood={mood} />
          </div>
          <button
            type="button"
            aria-label="Hide the panda for now"
            onClick={() => setClosed(true)}
            className="af-sb-close absolute right-2 top-[68px] rounded p-1 text-text-muted hover:text-amber-400"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {state === "new" && <SeenMarker />}
        </>
      )}
    </div>
  );
}

function SeenMarker() {
  return (
    <span
      hidden
      ref={() => {
        const t = setTimeout(markSeen, 2500);
        return () => clearTimeout(t);
      }}
    />
  );
}