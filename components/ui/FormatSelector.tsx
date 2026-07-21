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
    <div role="radiogroup" aria-label="Output format" className="grid grid-cols-2 gap-3">
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
              "flex flex-col items-start rounded-lg border px-4 py-3 text-left transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              isSelected
                ? "border-amber-500/60 bg-amber-500/10"
                : "border-graphite-700 bg-graphite-900 hover:border-graphite-700/80 hover:bg-graphite-850"
            )}
          >
            <span
              className={cn(
                "font-mono text-lg font-semibold tracking-tight",
                isSelected ? "text-amber-400" : "text-text-primary"
              )}
            >
              {option.label}
            </span>
            <span className="text-xs text-text-muted mt-0.5">{option.description}</span>
          </button>
        );
      })}
    </div>
  );
}