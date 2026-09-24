"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, Play, Video } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/* ==================================================================== */
/* One preview card, three forms                                        */
/* ==================================================================== */
/**
 * TranscriptionForm, YouTubeUrlForm and YouTubeConverterForm each grew
 * their own version of "show the video you just pasted". They drifted:
 * different thumbnail sizes, different fallback copy, one of them with
 * no <img onError> at all, one showing the channel and two showing the
 * raw ID. Same job, three appearances, on pages that link to each other.
 *
 * This is that block, once.
 *
 * Two pieces, deliberately separate:
 *   useYouTubeMeta(id)  — the oEmbed lookup. Returned to the CALLER, not
 *                         kept private, because the forms need the title
 *                         in their progress panel and result header too.
 *                         A card that owned the fetch would force a
 *                         second identical request to get at it.
 *   <VideoPreviewCard/> — pure render. Given an id and (maybe) a meta.
 *
 * The card never blocks on the fetch. oEmbed is unauthenticated and
 * CORS-open, which also means it is allowed to fail — private, deleted,
 * region-locked, or the user is offline behind a filter. The thumbnail
 * comes from a different host (i.ytimg.com) and usually survives that,
 * so the card degrades in two independent steps rather than vanishing:
 * title → channel → video ID, and image → icon.
 */

export interface YouTubeMeta {
    id: string;
    title: string | null;
    author: string | null;
}

/**
 * Best-effort title/channel for a video ID.
 *
 * Resets to `{ id, title: null, author: null }` the instant the ID
 * changes, so the card can never show the previous video's title next to
 * the new video's thumbnail — which is the one failure mode that makes a
 * confirmation row worse than no confirmation row.
 */
export function useYouTubeMeta(videoId: string | null): YouTubeMeta | null {
    const [meta, setMeta] = useState<YouTubeMeta | null>(null);

    useEffect(() => {
        if (!videoId) {
            setMeta(null);
            return;
        }

        setMeta((prev) =>
            prev?.id === videoId ? prev : { id: videoId, title: null, author: null }
        );

        let cancelled = false;
        const controller = new AbortController();

        fetch(
            `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
                `https://www.youtube.com/watch?v=${videoId}`
            )}`,
            { signal: controller.signal }
        )
            .then((res) => (res.ok ? res.json() : null))
            .then((data: { title?: string; author_name?: string } | null) => {
                if (cancelled || !data) return;
                setMeta((prev) =>
                    prev?.id === videoId
                        ? { id: videoId, title: data.title ?? null, author: data.author_name ?? null }
                        : prev
                );
            })
            .catch(() => {
                // Private, deleted, region-locked, or offline. The ID is enough.
            });

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [videoId]);

    return meta;
}

/* ------------------------------------------------------------------ */

const SIZES = {
    /** Resting state — the row you read before committing 90 seconds. */
    md: {
        frame: "gap-3.5 p-3",
        thumb: "h-[3.75rem] w-[6.75rem]",
        title: "text-sm",
        sub: "text-xs",
    },
    /** In-progress and result headers, where the card is context, not the
     *  subject, and has to sit under a heading without competing. */
    sm: {
        frame: "gap-3 p-2.5",
        thumb: "h-11 w-[4.9rem]",
        title: "text-[13px]",
        sub: "text-[11px]",
    },
} as const;

/**
 * Thumbnail with its own fallback ladder.
 *
 * `mqdefault` exists for every public video including Shorts, where
 * `maxresdefault` frequently 404s — so we ask for the one that's always
 * there rather than the biggest one. On failure we do NOT retry another
 * size: if ytimg refused this ID once it will refuse it again, and a
 * second dead request just delays the icon.
 */
function Thumb({ videoId, className }: { videoId: string; className?: string }) {
    const [failed, setFailed] = useState(false);

    // A new ID deserves a fresh attempt even if the last one failed.
    useEffect(() => setFailed(false), [videoId]);

    return (
        <div
            className={cn(
                "group/thumb relative shrink-0 overflow-hidden rounded-md bg-graphite-800",
                className
            )}
        >
            {failed ? (
                <div className="flex h-full w-full items-center justify-center">
                    <Video className="h-4 w-4 text-text-subtle" aria-hidden />
                </div>
            ) : (
                <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onError={() => setFailed(true)}
                        className="h-full w-full object-cover"
                    />
                    {/* Reads as video rather than as a random still, and covers the
              one frame in ten that happens to be a black fade-in. */}
                    <span
                        className="absolute inset-0 flex items-center justify-center bg-graphite-950/25"
                        aria-hidden
                    >
                        <Play className="h-3.5 w-3.5 fill-white/85 text-white/85" />
                    </span>
                </>
            )}
        </div>
    );
}

interface VideoPreviewCardProps {
    videoId: string;
    /** From useYouTubeMeta. Null or half-loaded is fine and expected. */
    meta?: YouTubeMeta | null;
    size?: keyof typeof SIZES;
    /** Right-hand slot: the teal check at rest, an elapsed timer while a
     *  job runs. Pass `null` for neither. Defaults to the check. */
    trailing?: ReactNode;
    /** Overrides the title line. Used when the SERVER has told us the real
     *  title — that beats oEmbed, because it's the title of the thing that
     *  actually got downloaded. */
    title?: string | null;
    className?: string;
}

export function VideoPreviewCard({
    videoId,
    meta,
    size = "md",
    trailing,
    title,
    className,
}: VideoPreviewCardProps) {
    const s = SIZES[size];
    const resolved = meta?.id === videoId ? meta : null;
    const headline = title ?? resolved?.title ?? null;
    const subline = resolved?.author ?? `youtu.be/${videoId}`;

    return (
        <div
            className={cn(
                "flex items-center rounded-lg border border-graphite-800 bg-graphite-850/60",
                s.frame,
                className
            )}
        >
            <Thumb videoId={videoId} className={s.thumb} />

            <div className="min-w-0 flex-1">
                {headline ? (
                    <p className={cn("truncate font-medium text-text-primary", s.title)}>{headline}</p>
                ) : (
                    /* A shimmer bar, not the words "Video found". The title is
                       ~200ms away and arriving; filler copy makes the row settle
                       twice and reads as a state that never resolves. */
                    <span
                        className={cn(
                            "block h-3.5 w-2/3 animate-pulse rounded bg-graphite-800 motion-reduce:animate-none",
                            size === "sm" && "h-3"
                        )}
                        aria-hidden
                    />
                )}
                <p className={cn("mt-1 truncate text-text-muted", s.sub)}>{subline}</p>
            </div>

            {trailing === undefined ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-400" aria-hidden />
            ) : (
                trailing
            )}
        </div>
    );
}