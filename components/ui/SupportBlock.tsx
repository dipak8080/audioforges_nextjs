import { Heart } from "lucide-react";

// Shared Ko-fi support block — shown after ANY outcome (success or failure),
// since server cost is incurred either way and we want people to know this
// stays free because of support, not just when things go right.
export function SupportBlock() {
  return (
    <a
      href="https://ko-fi.com/audioforges"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 rounded-lg border border-graphite-700 px-4 py-2.5 text-sm text-text-muted hover:text-amber-400 hover:border-amber-500/40 transition-colors"
    >
      <Heart className="h-3.5 w-3.5" />
      Enjoying AudioForges? Buy us a coffee and help keep the servers running ❤️
    </a>
  );
}