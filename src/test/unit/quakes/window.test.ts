import { describe, expect, it } from "vitest";
import { monthAt, monthLabel, windowLabel } from "../../../web/quakes/lib/window.js";

describe("window labels", () => {
  it("names a month in UTC", () => {
    expect(monthLabel("2025-09-01")).toBe("Sep 2025");
    expect(monthLabel("2026-01-01")).toBe("Jan 2026");
  });
  it("states the window with its exclusive end pulled back a month", () => {
    expect(windowLabel("2025-09-01", "2026-09-01")).toBe("Sep 2025 – Aug 2026");
    expect(windowLabel("2025-01-01", "2026-01-01")).toBe("Jan 2025 – Dec 2025");
  });
  it("shows the month a position falls in, never the month after the window", () => {
    expect(monthAt("2025-09-01", 0, 365)).toBe("Sep 2025");
    expect(monthAt("2025-09-01", 30, 365)).toBe("Oct 2025");
    expect(monthAt("2025-09-01", 365, 365)).toBe("Aug 2026");
  });
});
