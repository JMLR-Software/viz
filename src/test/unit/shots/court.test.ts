import { describe, expect, it } from "vitest";
import { COURT, COURT_HEIGHT, COURT_WIDTH, courtToSvg, svgHeight } from "../../../web/shots/lib/court.js";

describe("court geometry", () => {
  it("spans the half court", () => {
    expect(COURT_WIDTH).toBe(2 * COURT.sidelineX);
    expect(COURT_HEIGHT).toBe(COURT.halfCourtY - COURT.baselineY);
  });

  it("keeps the backboard narrower than the lane", () => {
    expect(COURT.backboardHalfWidth).toBeGreaterThan(0);
    expect(COURT.backboardHalfWidth).toBeLessThan(COURT.laneHalfWidth);
  });

  it("keeps the aspect ratio", () => {
    expect(svgHeight(500)).toBeCloseTo(470);
    expect(svgHeight(250)).toBeCloseTo(235);
  });

  it("puts the hoop on the centre line near the bottom", () => {
    const p = courtToSvg(0, 0, 500);
    expect(p.x).toBeCloseTo(250);
    expect(p.y).toBeCloseTo(417.5);
  });

  it("flips y so shots further out are higher on screen", () => {
    const near = courtToSvg(0, 50, 500);
    const far = courtToSvg(0, 250, 500);
    expect(far.y).toBeLessThan(near.y);
  });

  it("maps the corners of the half court to the SVG corners", () => {
    expect(courtToSvg(-COURT.sidelineX, COURT.halfCourtY, 500)).toEqual({ x: 0, y: 0 });
    const bottomRight = courtToSvg(COURT.sidelineX, COURT.baselineY, 500);
    expect(bottomRight.x).toBeCloseTo(500);
    expect(bottomRight.y).toBeCloseTo(470);
  });

  it("scales with the requested width", () => {
    const half = courtToSvg(100, 100, 250);
    const full = courtToSvg(100, 100, 500);
    expect(half.x).toBeCloseTo(full.x / 2);
    expect(half.y).toBeCloseTo(full.y / 2);
  });
});
