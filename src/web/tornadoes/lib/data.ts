
export interface TornadoFile {
  generatedAt: string;
  source: string;
  firstYear: number;
  lastYear: number;
  trackFields: string[];
  countyFields: string[];
  /** One flat array per year: TRACK_FIELDS.length ints per tornado. */
  tracks: number[][];
  /** fips -> [[yearOffset, all, strong], ...], sorted by year. */
  counties: Record<string, number[][]>;
  unmatchedCountyRefs: number;
}
