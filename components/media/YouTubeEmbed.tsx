"use client";

import { useState } from "react";

type Props = {
  videoId: string;
  title: string;
  description: string;
  uploadDate: string;
  pageUrl: string;
  siteUrl: string;
};

export function YouTubeEmbed({ videoId, title, description, uploadDate, pageUrl, siteUrl }: Props) {
  const [play, setPlay] = useState(false);
  const thumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: title,
    description,
    thumbnailUrl: [thumb],
    uploadDate,
    contentUrl: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
    publisher: { "@type": "Organization", name: "AudioForges", url: siteUrl },
    url: `${siteUrl}${pageUrl}`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900">
        <div className="relative aspect-video">
          {play ? (
            <iframe
              className="absolute inset-0 h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlay(true)}
              aria-label={`Play video: ${title}`}
              className="group absolute inset-0 h-full w-full"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumb}
                alt={title}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/30 transition group-hover:bg-black/20">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500 text-graphite-950 shadow-lg transition group-hover:scale-105">
                  <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7 fill-current" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}