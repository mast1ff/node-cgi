const path = require("path");
const esbuild = require("esbuild");

esbuild.build({
  absWorkingDir: process.cwd(),
  entryPoints: [path.resolve(process.cwd(), "src", "index.ts")],
  outfile: path.resolve(process.cwd(), "dist", "node-cgi.js"),
  format: "cjs",
  mainFields: ["main", "module"],
  platform: "node",
  sourcemap: true,
  bundle: true
});
