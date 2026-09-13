import { build } from "esbuild";

await build({
  entryPoints: { index: "src/web/index.ts" },
  bundle: true,
  format: "esm",
  outdir: "public/js",
  // Minify in dev too: public/js is what `wrangler dev` serves, there is no separate dev path.
  minify: true,
  // Sourcemaps are for local debugging only; shipping them doubles the upload.
  sourcemap: process.env.NODE_ENV === "production" ? false : "external",
  target: "es2022",
  logLevel: "info",
});
