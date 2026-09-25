export interface Showcase {
  slug: string;
  title: string;
  /** One line, the reel's first second. */
  hook: string;
  /** Footer credit: names the source and states no affiliation (Rule 6). */
  credit: string;
}

/** Built showcases only. Parked ones (quakes, flights, scoring) are added when they ship. */
export const SHOWCASES: readonly Showcase[] = [
  {
    slug: "shots",
    title: "All-Star Shots",
    hook: "Where the 2026 NBA All-Stars shot from, 2025-26",
    credit: "Data: NBA.com/stats via nba_api. Not affiliated with the NBA.",
  },
];

export function showcaseFor(slug: string): Showcase {
  const found = SHOWCASES.find((s) => s.slug === slug);
  if (!found) throw new Error(`unknown showcase: ${slug}`);
  return found;
}
