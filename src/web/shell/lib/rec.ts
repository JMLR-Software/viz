/** Record mode is on when the query has a `rec` param, with or without a value. */
export function isRecording(search: string): boolean {
  return new URLSearchParams(search).has("rec");
}

/** Carry record mode onto a same-site href, keeping any query and hash. */
export function withRec(href: string, rec: boolean): string {
  if (!rec) return href;
  const hashAt = href.indexOf("#");
  const base = hashAt === -1 ? href : href.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : href.slice(hashAt);
  const queryAt = base.indexOf("?");
  if (queryAt !== -1 && isRecording(base.slice(queryAt))) return href;
  return `${base}${queryAt === -1 ? "?" : "&"}rec${hash}`;
}

/** Reduced motion opens a showcase paused, except when recording a reel. */
export function shouldAutoplay(rec: boolean, reducedMotion: boolean): boolean {
  return rec || !reducedMotion;
}
