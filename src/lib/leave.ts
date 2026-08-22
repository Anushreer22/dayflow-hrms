export const PAID_LEAVE_ANNUAL_DAYS = 24;
export const SICK_LEAVE_ANNUAL_DAYS = 7;

export function formatLeaveDays(value: number) {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}
