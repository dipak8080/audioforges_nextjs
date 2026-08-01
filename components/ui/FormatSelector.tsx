"use client";

import type { FormatOption, OutputFormat } from "@/lib/types/converter";
import { cn } from "@/lib/utils/cn";

interface FormatSelectorProps {
  options: FormatOption[];
  value: OutputFormat;
  onChange: (value: OutputFormat) => void;
  disabled?: boolean;
}

export function FormatSelector({ options, value, onChange, disabled }: FormatSelectorProps) {
  return (
    <div role="radiogroup" aria-label="Output format" className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-lg border p-3.5 text-left transition-all",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
              "disabled:cursor-not-allowed disabled:opacity-40",
              isSelected
                ? "border-amber-500/60 bg-amber-500/[0.07]"
                : "border-graphite-700 bg-graphite-850 hover:border-graphite-700/60 hover:bg-graphite-800/60"
            )}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={cn(
                  "text-base font-semibold tracking-tight",
                  isSelected ? "text-amber-400" : "text-text-primary"
                )}
              >
                {option.label}
              </span>
              {option.quality && (
                <span
                  className={cn(
                    "text-[10px] font-medium uppercase tracking-wider",
                    isSelected ? "text-amber-500/80" : "text-text-subtle"
                  )}
                >
                  {option.quality}
                </span>
              )}
            </div>

            <p className="mt-1.5 text-xs leading-snug text-text-muted">{option.description}</p>

            {option.spec && (
              <p className="mt-1 font-mono text-[11px] text-text-subtle">{option.spec}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}