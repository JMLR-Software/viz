import { MS_PER_DAY } from "../config.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** A position at the very end still reads as the window's last day. */
const LAST_MOMENT_DAYS = 1 / 1440;

function labelFor(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function monthLabel(iso: string): string {
  return labelFor(Date.parse(`${iso}T00:00:00Z`));
}

/** "Sep 2025 – Aug 2026" for start 2025-09-01 and exclusive end 2026-09-01. */
export function windowLabel(start: string, end: string): string {
  return `${monthLabel(start)} – ${labelFor(Date.parse(`${end}T00:00:00Z`) - MS_PER_DAY)}`;
}

export function monthAt(start: string, day: number, span: number): string {
  const clamped = Math.min(Math.max(day, 0), span - LAST_MOMENT_DAYS);
  return labelFor(Date.parse(`${start}T00:00:00Z`) + clamped * MS_PER_DAY);
}
