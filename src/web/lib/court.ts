/**
 * Court geometry in tenths of a foot, hoop at the origin, y increasing away from the baseline.
 * These are the NBA's published dimensions in the same units stats.nba.com reports shots in.
 */
export const COURT = {
  baselineY: -52.5,
  backboardY: -12.5,
  rimRadius: 7.5,
  restrictedRadius: 40,
  laneHalfWidth: 80,
  freeThrowY: 137.5,
  freeThrowRadius: 60,
  cornerThreeX: 220,
  cornerThreeY: 89.5,
  threeRadius: 237.5,
  halfCourtY: 417.5,
  centerCircleRadius: 60,
  sidelineX: 250,
} as const;

export const COURT_WIDTH = 2 * COURT.sidelineX;
export const COURT_HEIGHT = COURT.halfCourtY - COURT.baselineY;

/** SVG height that preserves the court's aspect ratio at the given width. */
export function svgHeight(width: number): number {
  return (width * COURT_HEIGHT) / COURT_WIDTH;
}

/** Court point to SVG point: origin moves to the left/top edge and y flips. */
export function courtToSvg(x: number, y: number, width: number): { x: number; y: number } {
  const scale = width / COURT_WIDTH;
  return {
    x: (x + COURT.sidelineX) * scale,
    y: (COURT.halfCourtY - y) * scale,
  };
}
