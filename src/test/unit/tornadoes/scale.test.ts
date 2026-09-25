import { describe, expect, it } from "vitest";
import { UNKNOWN_TRACK_WIDTH, TRACK_WIDTH_BY_MAG } from "../../../web/tornadoes/config.js";
import { heatScale, trackWidth } from "../../../web/tornadoes/lib/scale.js";

describe("heatScale", () => {
  const color = heatScale(100, "#000");
  it("draws a county with none as the empty fill", () => expect(color(0)).toBe("#000"));
  it("gets brighter with more tornadoes and clamps above max", () => {
    expect(color(1)).not.toBe(color(100));
    expect(color(1000)).toBe(color(100));
  });
});

describe("trackWidth", () => {
  it("widens with rating", () => expect(trackWidth(5)).toBeGreaterThan(trackWidth(0)));
  it("uses the table for known ratings", () => expect(trackWidth(3)).toBe(TRACK_WIDTH_BY_MAG[3]));
  it("draws an unknown rating thinnest", () => expect(trackWidth(-1)).toBe(UNKNOWN_TRACK_WIDTH));
});
