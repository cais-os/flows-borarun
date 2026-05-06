"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildCustomDateRange,
  formatDateInputValue,
  getPresetRange,
  type DateRange,
  type Preset,
} from "./date-range-utils";

export type { DateRange } from "./date-range-utils";

const PRESETS: Array<{ key: Preset; label: string }> = [
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "all", label: "Todos" },
];

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
  const [customFrom, setCustomFrom] = useState(
    formatDateInputValue(value.from)
  );
  const [customTo, setCustomTo] = useState(formatDateInputValue(value.to));
  const activePreset = useMemo(
    () =>
      PRESETS.find((preset) => {
        const range = getPresetRange(preset.key);
        if (preset.key === "all") return !value.from && !value.to;
        if (!value.from) return false;

        const diff = Math.abs(
          new Date(range.from).getTime() - new Date(value.from).getTime()
        );
        return diff < 3600000;
      }),
    [value.from, value.to]
  );
  const customRangeIsActive = Boolean(value.from || value.to) && !activePreset;
  const canApplyCustom = Boolean(customFrom || customTo);

  function applyPresetRange(preset: Preset) {
    const range = getPresetRange(preset);
    setCustomFrom(formatDateInputValue(range.from));
    setCustomTo(formatDateInputValue(range.to));
    onChange(range);
  }

  function applyCustomRange() {
    const range = buildCustomDateRange(customFrom, customTo);
    setCustomFrom(formatDateInputValue(range.from));
    setCustomTo(formatDateInputValue(range.to));
    onChange(range);
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="flex items-center gap-1">
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => applyPresetRange(preset.key)}
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

      <div
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-xl border bg-white px-2 py-1.5 shadow-sm",
          customRangeIsActive ? "border-slate-400" : "border-slate-200"
        )}
      >
        <CalendarDays size={14} className="text-slate-400" />
        <label className="flex items-center gap-1 text-xs font-medium text-slate-500">
          De
          <input
            type="date"
            value={customFrom}
            onChange={(event) => setCustomFrom(event.target.value)}
            className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-slate-400"
          />
        </label>
        <label className="flex items-center gap-1 text-xs font-medium text-slate-500">
          Ate
          <input
            type="date"
            value={customTo}
            onChange={(event) => setCustomTo(event.target.value)}
            className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-slate-400"
          />
        </label>
        <button
          type="button"
          onClick={applyCustomRange}
          disabled={!canApplyCustom}
          className="inline-flex h-7 items-center gap-1 rounded-md bg-slate-900 px-2.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          <Check size={13} />
          Aplicar
        </button>
      </div>
    </div>
  );
}
