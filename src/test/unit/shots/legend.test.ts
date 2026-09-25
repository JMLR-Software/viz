import { describe, expect, it } from "vitest";
import { efficiencyLegend, frequencyLegend, legendNote } from "../../../web/shots/lib/legend.js";
import { efficiencyColor, frequencyColor } from "../../../web/shots/lib/scales.js";

describe("frequencyLegend", () => {
  it("runs from 1 shot to the cap, labelled as a floor because the colours clamp there", () => {
    const { ticks } = frequencyLegend(40, 4, 8);
    expect(ticks[0]).toMatchObject({ value: 1, label: "1" });
    expect(ticks[ticks.length - 1]).toEqual({ value: 40, offset: 1, label: "40+" });
  });

  it("samples the same colours the hexes use", () => {
    const { stops } = frequencyLegend(40, 4, 8);
    expect(stops[stops.length - 1].color).toBe(frequencyColor(40, 40));
    expect(stops[0].color).toBe(frequencyColor(1, 40));
  });

  it("names what the colour counts", () => {
    expect(frequencyLegend(40, 4, 8).title).toMatch(/shots/i);
  });
});

describe("efficiencyLegend", () => {
  it("spans minus the clamp to plus the clamp with the average in the middle", () => {
    const { ticks } = efficiencyLegend(0.15, 8);
    expect(ticks.map((t) => t.offset)).toEqual([0, 0.5, 1]);
    expect(ticks.map((t) => t.label)).toEqual(["−15 or worse", "average", "+15 or better"]);
  });

  it("samples the same colours the hexes use, blue below and red above", () => {
    const { stops } = efficiencyLegend(0.15, 9);
    expect(stops[0].color).toBe(efficiencyColor(-0.15, 0.15));
    expect(stops[4].color).toBe(efficiencyColor(0, 0.15));
    expect(stops[8].color).toBe(efficiencyColor(0.15, 0.15));
  });

  it("names the unit and the baseline", () => {
    expect(efficiencyLegend(0.15, 8).title).toMatch(/FG% points vs the All-Star average/);
  });
});

describe("legendNote", () => {
  it("is empty for one player's frequency map", () => {
    expect(legendNote("frequency", false, 5)).toBe("");
  });

  it("explains size and fading in efficiency mode", () => {
    const note = legendNote("efficiency", false, 5);
    expect(note).toMatch(/bigger/i);
    expect(note).toMatch(/fewer than 5/);
  });

  it("says why efficiency is unavailable for the combined view", () => {
    expect(legendNote("frequency", true, 5)).toMatch(/All-Star average is the baseline/);
  });
});
