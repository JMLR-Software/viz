import { geoDistance } from "d3-geo";
import { DRAG_DEG_PER_PX, GLOBE_TILT, MAX_TILT, TURNS_PER_PLAY } from "../config.js";

/** What the viewer's dragging has added to the automatic spin, in degrees. */
export interface Drag {
  lambda: number;
  phi: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
// Bounds for the stored (unclamped-by-display) phi, so GLOBE_TILT + phi always lands in [-MAX_TILT, MAX_TILT].
const PHI_LO = -MAX_TILT - GLOBE_TILT;
const PHI_HI = MAX_TILT - GLOBE_TILT;

/** d3 rotate [λ, φ] at a position: the spin follows the timeline, so a scrub or a loop turns the globe with it. */
export function rotationAt(position: number, span: number, drag: Drag): [number, number] {
  const spin = (position / span) * 360 * TURNS_PER_PLAY;
  return [spin + drag.lambda, clamp(GLOBE_TILT + drag.phi, -MAX_TILT, MAX_TILT)];
}

/** Drag right to turn east, drag down to tip the north toward the viewer. dx, dy in CSS pixels.
 * phi is clamped here (not just where it is displayed), so a long drag past the tilt limit leaves
 * no dead zone before dragging back starts moving the globe again. */
export function applyDrag(drag: Drag, dx: number, dy: number): Drag {
  return {
    lambda: drag.lambda + dx * DRAG_DEG_PER_PX,
    phi: clamp(drag.phi - dy * DRAG_DEG_PER_PX, PHI_LO, PHI_HI),
  };
}

/** Orthographic projection() does not clip points, so far-side quakes must be skipped by hand. */
export function onNearSide(lonLat: [number, number], rotate: [number, number]): boolean {
  return geoDistance(lonLat, [-rotate[0], -rotate[1]]) < Math.PI / 2;
}
