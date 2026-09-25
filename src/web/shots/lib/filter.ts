import type { ResultFilter, Shot } from "./data.js";

export function filterShots(shots: Shot[], result: ResultFilter): Shot[] {
  if (result === "all") return [...shots];
  const want = result === "made";
  return shots.filter((s) => s.made === want);
}
