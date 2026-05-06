export interface DateRange {
  from: string;
  to: string;
}

export type Preset = "7d" | "30d" | "90d" | "all";

function formatDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function parseDateInput(value: string, endOfDay = false) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function formatDateInputValue(value: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return [
    date.getFullYear(),
    formatDatePart(date.getMonth() + 1),
    formatDatePart(date.getDate()),
  ].join("-");
}

export function buildCustomDateRange(fromInput: string, toInput: string): DateRange {
  const fromDate = parseDateInput(fromInput, false);
  const toDate = parseDateInput(toInput, true);

  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    return {
      from: parseDateInput(toInput, false)?.toISOString() || "",
      to: parseDateInput(fromInput, true)?.toISOString() || "",
    };
  }

  return {
    from: fromDate?.toISOString() || "",
    to: toDate?.toISOString() || "",
  };
}

export function getPresetRange(
  preset: Preset,
  now: Date = new Date()
): DateRange {
  if (preset === "all") return { from: "", to: "" };

  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const to = new Date(now).toISOString();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    .toISOString();

  return { from, to };
}
