import Link from "next/link";
import { User, Clock } from "lucide-react";

interface GuideBylineProps {
  publishedDate: string;
  updatedDate: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function GuideByline({ publishedDate, updatedDate }: GuideBylineProps) {
  const wasUpdated = updatedDate !== publishedDate;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-subtle">
      <span className="flex items-center gap-1.5">
        <User className="h-3.5 w-3.5" />
        Written by{" "}
        <Link href="/about" className="text-amber-400 hover:underline">
          the AudioForges team
        </Link>
      </span>
      <span className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" />
        {wasUpdated ? `Updated ${formatDate(updatedDate)}` : `Published ${formatDate(publishedDate)}`}
      </span>
    </div>
  );
}