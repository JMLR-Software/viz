export interface Showcase {
  slug: string;
  title: string;
  /** One line, the reel's first second. */
  hook: string;
  /** Footer credit: names the source and states no affiliation (Rule 6). */
  credit: string;
}

/** Built showcases only. Parked ones (flights, scoring) are added when they ship. */
export const SHOWCASES: readonly Showcase[] = [
  {
    slug: "shots",
    title: "All-Star Shots",
    hook: "Where the 2026 NBA All-Stars shot from, 2025-26",
    credit: "Data: NBA.com/stats via nba_api. Not affiliated with the NBA.",
  },
  {
    slug: "tornadoes",
    title: "US Tornadoes",
    hook: "Every US tornado since 1950",
    credit: "Data: NOAA Storm Prediction Center severe weather database. Not affiliated with NOAA.",
  },
  {
    slug: "quakes",
    title: "Earthquakes",
    hook: "Every M4.5+ earthquake, Sep 2025 – Aug 2026",
    credit: "Data: USGS Earthquake Hazards Program. Not affiliated with the USGS.",
  },
];

export function showcaseFor(slug: string): Showcase {
  const found = SHOWCASES.find((s) => s.slug === slug);
  if (!found) throw new Error(`unknown showcase: ${slug}`);
  return found;
}
