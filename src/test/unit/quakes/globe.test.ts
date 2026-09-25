import { describe, expect, it } from "vitest";
import { GLOBE_TILT, MAX_TILT, TURNS_PER_PLAY } from "../../../web/quakes/config.js";
import { applyDrag, onNearSide, rotationAt } from "../../../web/quakes/lib/globe.js";

const still = { lambda: 0, phi: 0 };

describe("rotationAt", () => {
  it("starts at the resting tilt and turns eastward with the year", () => {
    expect(rotationAt(0, 365, still)).toEqual([0, GLOBE_TILT]);
    expect(rotationAt(365 / (2 * TURNS_PER_PLAY), 365, still)[0]).toBeCloseTo(180);
  });
  it("ends on a whole number of turns, so the loop is seamless", () => {
    expect(rotationAt(365, 365, still)[0] % 360).toBeCloseTo(0);
  });
  it("adds the drag and clamps the tilt", () => {
    expect(rotationAt(0, 365, { lambda: 30, phi: 10 })).toEqual([30, GLOBE_TILT + 10]);
    expect(rotationAt(0, 365, { lambda: 0, phi: -500 })[1]).toBe(-MAX_TILT);
  });
});

describe("applyDrag", () => {
  it("returns a new drag and leaves the old one alone", () => {
    const before = { lambda: 0, phi: 0 };
    const after = applyDrag(before, 10, -10);
    expect(after.lambda).toBeGreaterThan(0);
    expect(after.phi).toBeGreaterThan(0);
    expect(before).toEqual({ lambda: 0, phi: 0 });
  });
});

describe("onNearSide", () => {
  it("sees the point at the centre of view and not its antipode", () => {
    // rotate [λ, φ] puts lon -λ, lat -φ at the centre.
    expect(onNearSide([-30, 20], [30, -20])).toBe(true);
    expect(onNearSide([150, -20], [30, -20])).toBe(false);
  });
});
