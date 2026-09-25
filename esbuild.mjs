import { build } from "esbuild";
import { existsSync, readdirSync } from "node:fs";

// One page per src/web/<folder>/index.ts. shell/ has no index.ts, so it is only ever a shared chunk.
const pages = Object.fromEntries(
  readdirSync("src/web", { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(`src/web/${d.name}/index.ts`))
    .map((d) => [d.name, `src/web/${d.name}/index.ts`]),
);

await build({
  entryPoints: pages,
  bundle: true,
  splitting: true,
  format: "esm",
  outdir: "public/js",
  // Page entries keep stable names (HTML points at them) and are served no-cache;
  // chunks are content-hashed and served immutable. See src/headers.ts.
  entryNames: "pages/[name]",
  chunkNames: "chunks/[name]-[hash]",
  // Minify in dev too: public/js is what `wrangler dev` serves, there is no separate dev path.
  minify: true,
  // Sourcemaps are for local debugging only; shipping them doubles the upload.
  sourcemap: process.env.NODE_ENV === "production" ? false : "external",
  target: "es2022",
  logLevel: "info",
});
