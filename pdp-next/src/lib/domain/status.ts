import type { ItemStatus } from "./types";

export function statusToPercent(status: ItemStatus): number {
  switch (status) {
    case "done":
      return 100;
    case "in_progress":
      return 50;
    case "not_started":
    default:
      return 0;
  }
}

export function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}
