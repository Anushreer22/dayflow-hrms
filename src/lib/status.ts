export type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

export const statusColorMap: Record<
  string,
  { badgeClass: string; dotClass: string; label: string }
> = {
  // attendance / general
  present: {
    badgeClass: "bg-green-100 text-green-800 border-green-300",
    dotClass: "bg-green-500",
    label: "Present",
  },
  absent: {
    badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-300",
    dotClass: "bg-yellow-500",
    label: "Absent",
  },
  half_day: {
    badgeClass: "bg-orange-100 text-orange-800 border-orange-300",
    dotClass: "bg-orange-500",
    label: "Half Day",
  },
  leave: {
    badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
    dotClass: "bg-blue-500",
    label: "Leave",
  },
  // leave statuses
  pending: {
    badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-300",
    dotClass: "bg-yellow-500",
    label: "Pending",
  },
  approved: {
    badgeClass: "bg-green-100 text-green-800 border-green-300",
    dotClass: "bg-green-500",
    label: "Approved",
  },
  rejected: {
    badgeClass: "bg-red-100 text-red-800 border-red-300",
    dotClass: "bg-red-500",
    label: "Rejected",
  },
  // roles
  admin: {
    badgeClass: "bg-purple-100 text-purple-800 border-purple-300",
    dotClass: "bg-purple-500",
    label: "Admin",
  },
  employee: {
    badgeClass: "bg-gray-100 text-gray-800 border-gray-300",
    dotClass: "bg-gray-500",
    label: "Employee",
  },
};

export function getStatusBadgeClass(status: string): string {
  return statusColorMap[status]?.badgeClass ?? "bg-gray-100 text-gray-800 border-gray-300";
}

export function getStatusDotClass(status: string): string {
  return statusColorMap[status]?.dotClass ?? "bg-gray-500";
}

export function getStatusLabel(status: string): string {
  return statusColorMap[status]?.label ?? status;
}