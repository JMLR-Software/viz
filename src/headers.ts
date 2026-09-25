const IMMUTABLE = "public, max-age=31536000, immutable";

const SECURITY: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https://cdn.nba.com; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
};

/**
 * Headers the Worker adds to every asset (what public/_headers did before the Worker ran first).
 * Only a found file is cached forever; a 404 must not stick once a later deploy adds the file.
 */
export function headersFor(pathname: string, status = 200): Record<string, string> {
  const found = status >= 200 && status < 300;
  if (found && (pathname.startsWith("/js/chunks/") || pathname.startsWith("/data/"))) {
    return { ...SECURITY, "Cache-Control": IMMUTABLE };
  }
  if (pathname.startsWith("/js/pages/")) return { ...SECURITY, "Cache-Control": "no-cache" };
  return { ...SECURITY };
}
