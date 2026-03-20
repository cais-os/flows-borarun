"use client";

import { cn } from "@/lib/utils";

export interface DateRange {
  from: string;
  to: string;
}

type Preset = "7d" | "30d" | "90d" | "all";

const PRESETS: Array<{ key: Preset; label: string }> = [
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "all", label: "Todos" },
];

function getPresetRange(preset: Preset): DateRange {
  if (preset === "all") return { from: "", to: "" };

  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const to = new Date().toISOString();
  return { from, to };
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

export function DateRangeFilter({
  value,
  onChange,
  className,
}: DateRangeFilterProps) {
  const activePreset = PRESETS.find((p) => {
    const range = getPresetRange(p.key);
    if (p.key === "all") return !value.from && !value.to;
    // Rough match — within 1 hour tolerance
    if (!value.from) return false;
    const diff = Math.abs(
      new Date(range.from).getTime() - new Date(value.from).getTime()
    );
    return diff < 3600000;
  });

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {PRESETS.map((preset) => (
        <button
          key={preset.key}
          type="button"
          onClick={() => onChange(getPresetRange(preset.key))}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            activePreset?.key === preset.key
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          )}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
