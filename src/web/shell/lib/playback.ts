/** A looping timeline: `span` units play over playMs, hold on the last frame for holdMs, then start again. */
export interface Playback {
  span: number;
  playMs: number;
  holdMs: number;
}

/** Position in the showcase's units, 0..span. Holds at `span` for holdMs, then loops. */
export function positionAt(elapsedMs: number, p: Playback): number {
  const e = elapsedMs % (p.playMs + p.holdMs);
  return e >= p.playMs ? p.span : (e / p.playMs) * p.span;
}

export function elapsedForPosition(position: number, p: Playback): number {
  return (Math.min(position, p.span) / p.span) * p.playMs;
}
