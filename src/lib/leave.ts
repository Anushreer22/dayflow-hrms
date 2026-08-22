export const PAID_LEAVE_ANNUAL_DAYS = 24;
export const SICK_LEAVE_ANNUAL_DAYS = 7;
export const LEAVE_ATTACHMENTS_BUCKET = "leave-attachments";

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  paid: "Paid Time Off",
  sick: "Sick Leave",
  unpaid: "Unpaid Leave",
};

export function formatLeaveDays(value: number) {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

export function inclusiveLeaveDays(startDate: string, endDate: string): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return null;
  }
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

export function datesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
) {
  return aStart <= bEnd && aEnd >= bStart;
}
