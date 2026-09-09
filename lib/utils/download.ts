export function triggerDownload(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Browsers throttle rapid multi-downloads; stagger them slightly. */
export function triggerDownloadsStaggered(urls: string[], gapMs = 400) {
  urls.forEach((url, i) => {
    window.setTimeout(() => triggerDownload(url), i * gapMs);
  });
}