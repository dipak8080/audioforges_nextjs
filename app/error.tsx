"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-20 sm:py-28">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-graphite-700 bg-graphite-850 text-amber-500">
          <AlertTriangle className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="mt-6 text-3xl font-semibold text-text-primary sm:text-4xl">
          Something went wrong
        </h1>
        <p className="mt-3 max-w-lg text-text-muted">
          This page hit an error. Nothing you uploaded was kept, so trying again is safe. If it
          keeps happening, the tools listed on the homepage all work independently of this one.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-text-subtle">Reference: {error.digest}</p>
        )}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className={buttonStyles({ size: "lg" })}>
            Try again
          </button>
          <Link href="/tools" className={buttonStyles({ variant: "outline", size: "lg" })}>
            All tools
          </Link>
        </div>
      </div>
    </main>
  );
}