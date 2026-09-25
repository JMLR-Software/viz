const IMMUTABLE = "public, max-age=31536000, immutable";

const SECURITY: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https://cdn.nba.com; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
};

/** Headers the Worker adds to every asset (what public/_headers did before the Worker ran first). */
export function headersFor(pathname: string): Record<string, string> {
  if (pathname.startsWith("/js/chunks/") || pathname.startsWith("/data/")) {
    return { ...SECURITY, "Cache-Control": IMMUTABLE };
  }
  if (pathname.startsWith("/js/pages/")) return { ...SECURITY, "Cache-Control": "no-cache" };
  return { ...SECURITY };
}
