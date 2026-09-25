import { describe, expect, it } from "vitest";
import { DELTA_CLAMP, FREQ_PERCENTILE, HEADSHOT_URL, HEX_RADIUS, RADIUS_FLOOR, ZONES } from "../../../web/shots/config.js";

describe("config", () => {
  it("lists the six zones in pipeline order", () => {
    expect([...ZONES]).toEqual([
      "Restricted Area",
      "In The Paint (Non-RA)",
      "Mid-Range",
      "Left Corner 3",
      "Right Corner 3",
      "Above the Break 3",
    ]);
  });

  it("keeps the tuning constants in range", () => {
    expect(HEX_RADIUS).toBeGreaterThan(0);
    expect(FREQ_PERCENTILE).toBeGreaterThan(0.5);
    expect(FREQ_PERCENTILE).toBeLessThanOrEqual(1);
    expect(DELTA_CLAMP).toBeGreaterThan(0);
    expect(RADIUS_FLOOR).toBeGreaterThan(0);
    expect(RADIUS_FLOOR).toBeLessThan(1);
  });

  it("builds a headshot URL from a player id", () => {
    expect(HEADSHOT_URL(203999)).toBe("https://cdn.nba.com/headshots/nba/latest/260x190/203999.png");
  });
});
