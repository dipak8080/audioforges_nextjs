"use client";

import { cn } from "@/lib/utils/cn";
import { useCredits } from "./CreditProvider";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { paidJobs, paidJobFor, joinNames, type PaidJob } from "@/lib/data/paid-jobs";

export function PackCoverage({
  credits,
  activeTool,
  variant = "disclosure",
  className,
}: {
  credits: number;
  activeTool?: string | null;
  variant?: "disclosure" | "card";
  className?: string;
}) {
  const { me } = useCredits();
  const [open, setOpen] = useState(false);
  const jobs = paidJobs(me?.paywall?.tools).filter((j) => Math.floor(credits / j.credits) > 0);
  if (!jobs.length) return null;

  if (variant === "disclosure") {
    const current = paidJobFor(jobs, activeTool);
    const others = jobs.filter((j) => j !== current).map((j) => j.short);
    if (!others.length) return null;
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-center gap-1.5 text-xs text-text-muted transition-colors hover:text-text-primary"
        >
          <span>Credits also work on {joinNames(others)}</span>
          <ChevronDown
            aria-hidden
            className={cn("h-3.5 w-3.5 transition-transform motion-reduce:transition-none", open && "rotate-180")}
          />
        </button>
        {open && <CoverageList jobs={jobs} credits={credits} activeTool={activeTool} className="mt-2.5" />}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3 pb-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-subtle">
          {credits} credits get you
        </p>
        <p className="text-[11px] text-text-subtle">Mix and match</p>
      </div>
      <ul className="space-y-2">
        {jobs.map((job) => (
          <li key={job.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-snug text-text-primary">{job.label}</p>
              <p className="truncate text-[11px] text-text-subtle">
                {job.detail}
                {job.credits > 1 ? `, ${job.credits} credits each` : ""}
              </p>
            </div>
            <Runs n={Math.floor(credits / job.credits)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CoverageList({
  jobs,
  credits,
  activeTool,
  className,
}: {
  jobs: PaidJob[];
  credits: number;
  activeTool?: string | null;
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "divide-y divide-graphite-800 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-950/40",
        className
      )}
    >
      <li className="flex justify-between px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-subtle">
        <span>{credits} credits, spend any way</span>
        <span>Runs</span>
      </li>
      {jobs.map((job) => {
        const current = !!activeTool && (job.keys as string[]).includes(activeTool);
        return (
          <li key={job.id} className={cn("flex items-center gap-3 px-3.5 py-2", current && "bg-amber-500/[0.06]")}>
            <div className="min-w-0 flex-1">
              <p className={cn("text-[13px] leading-snug", current ? "text-amber-400" : "text-text-primary")}>
                {job.label}
                {job.credits > 1 && (
                  <span className="ml-1.5 text-[11px] text-text-subtle">{job.credits} credits each</span>
                )}
              </p>
            </div>
            <Runs n={Math.floor(credits / job.credits)} />
          </li>
        );
      })}
    </ul>
  );
}

function Runs({ n }: { n: number }) {
  return (
    <p className="shrink-0 font-mono text-sm tabular-nums text-text-primary">
      <span className="text-text-subtle">×</span>
      {n}
    </p>
  );
}