import { describe, expect, it } from "vitest";
import { legendStops, legendTicks } from "../../../web/shell/lib/legend.js";
import { heatScale } from "../../../web/tornadoes/lib/scale.js";

describe("legendTicks", () => {
  it("places values on the square-root scale the map uses", () => {
    const ticks = legendTicks(100, 4);
    expect(ticks.length).toBeGreaterThan(2);
    for (const t of ticks) expect(t.offset).toBeCloseTo(Math.sqrt(t.value / 100));
  });

  it("ends on the domain top, labelled as a floor because the colours clamp there", () => {
    const ticks = legendTicks(137, 4);
    expect(ticks[ticks.length - 1]).toEqual({ value: 137, offset: 1, label: "137+" });
  });

  it("starts at 1, the first count that is not the empty fill", () => {
    expect(legendTicks(137, 4)[0]).toMatchObject({ value: 1, label: "1" });
  });

  it("drops a round tick that would crowd the top label", () => {
    const offsets = legendTicks(102, 4).map((t) => t.offset);
    for (let i = 1; i < offsets.length; i += 1) expect(offsets[i] - offsets[i - 1]).toBeGreaterThanOrEqual(0.12);
  });

  it("copes with a domain of 1", () => {
    expect(legendTicks(1, 4)).toEqual([{ value: 1, offset: 1, label: "1+" }]);
  });
});

describe("legendStops", () => {
  it("samples the heat scale from 1 to max, evenly along the bar", () => {
    const color = heatScale(100, "#000");
    const stops = legendStops(100, color, 5);
    expect(stops).toHaveLength(5);
    expect(stops[0]).toEqual({ offset: 0, color: color(1) });
    expect(stops[4]).toEqual({ offset: 1, color: color(100) });
    expect(stops[2].color).toBe(color(25));
  });
});
