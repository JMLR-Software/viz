import { describe, expect, it } from "vitest";
import { buildCumulative, countAt, maxFinal } from "../../../web/tornadoes/lib/totals.js";

const counties = { "40025": [[0, 2, 1], [2, 3, 0]], "37047": [[1, 1, 1]] };

describe("buildCumulative", () => {
  it("builds a running total per county through each year", () => {
    const cum = buildCumulative(counties, 3, false);
    expect([...cum.get("40025")!]).toEqual([2, 2, 5]);
    expect([...cum.get("37047")!]).toEqual([0, 1, 1]);
  });

  it("counts only EF3+ when strongOnly", () => {
    const cum = buildCumulative(counties, 3, true);
    expect([...cum.get("40025")!]).toEqual([1, 1, 1]);
  });

  it("does not modify its input", () => {
    const copy = JSON.parse(JSON.stringify(counties));
    buildCumulative(counties, 3, false);
    expect(counties).toEqual(copy);
  });
});

describe("countAt", () => {
  const cum = buildCumulative(counties, 3, false);
  it("reads a county's total through a year", () => expect(countAt(cum, "40025", 1)).toBe(2));
  it("is 0 for a county with no tornadoes", () => expect(countAt(cum, "99999", 2)).toBe(0));
  it("clamps the year index into range", () => {
    expect(countAt(cum, "40025", -1)).toBe(0);
    expect(countAt(cum, "40025", 99)).toBe(5);
  });
});

describe("maxFinal", () => {
  it("is the percentile of final totals, at least 1", () => {
    const cum = buildCumulative(counties, 3, false);
    expect(maxFinal(cum, 1)).toBe(5);
    expect(maxFinal(new Map(), 0.99)).toBe(1);
  });
});
