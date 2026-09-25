export interface Timeline {
  years: number;
  playMs: number;
  holdMs: number;
}

/** Position in years since the first year, 0..years. Holds at `years` for holdMs, then loops. */
export function positionAt(elapsedMs: number, t: Timeline): number {
  const e = elapsedMs % (t.playMs + t.holdMs);
  return e >= t.playMs ? t.years : (e / t.playMs) * t.years;
}

/** Year index p-1 < position <= p is year p-1: a whole position is the end of the year before it, so a scrubbed year reads back as itself. */
export function yearIndexAt(position: number, years: number): number {
  return Math.min(years - 1, Math.max(0, Math.ceil(position) - 1));
}

/** A scrubbed year sits at its end: its heat is counted and its tracks are bright. */
export function positionForYearIndex(yearIndex: number): number {
  return yearIndex + 1;
}

export function elapsedForPosition(position: number, t: Timeline): number {
  return (Math.min(position, t.years) / t.years) * t.playMs;
}

/** Bright from the start of its year through one year later, then fading out over fadeYears. */
export function trackAlpha(trackYearIndex: number, position: number, fadeYears: number): number {
  const age = position - trackYearIndex;
  if (age < 0) return 0;
  if (age <= 1) return 1;
  return Math.max(0, 1 - (age - 1) / fadeYears);
}
