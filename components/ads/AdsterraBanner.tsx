"use client";

import { cn } from "@/lib/utils/cn";

const KEY = "d7dcd6f0f39891584d1480b952d2daa0";

const SRC_DOC = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}</style></head><body><script>atOptions={'key':'${KEY}','format':'iframe','height':250,'width':300,'params':{}};</script><script src="https://www.highrevenueformat.com/${KEY}/invoke.js"></script></body></html>`;

// Sandboxed without allow-same-origin or top-navigation: the ad cannot touch
// this page or redirect it. Clicks still open the advertiser in a new tab.
const SANDBOX = "allow-scripts allow-popups allow-popups-to-escape-sandbox";

export function AdsterraBanner({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">
        Advertisement
      </span>
      <iframe
        title="Advertisement"
        srcDoc={SRC_DOC}
        width={300}
        height={250}
        scrolling="no"
        sandbox={SANDBOX}
        className="block h-[250px] w-[300px] max-w-full overflow-hidden rounded-md border-0 bg-graphite-950/40"
      />
    </div>
  );
}