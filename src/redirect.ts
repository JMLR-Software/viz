const OLD_HOST = "shots.jmlr.dev";
const NEW_ORIGIN = "https://viz.jmlr.dev";

/** Where a request to the old shots host should go, or null to serve it here. */
export function redirectTarget(url: string): string | null {
  const u = new URL(url);
  if (u.hostname !== OLD_HOST) return null;
  const path = u.pathname === "/" ? "/shots/" : `/shots${u.pathname}`;
  return `${NEW_ORIGIN}${path}${u.search}`;
}
