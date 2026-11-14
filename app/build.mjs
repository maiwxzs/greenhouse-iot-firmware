// Construye la aplicación en app/dist (archivos estáticos, sin servidor).
//   node build.mjs            compila una vez (minificado)
//   node build.mjs --servir   compila, observa cambios y sirve en http://localhost:8000
import * as esbuild from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const servir = process.argv.includes("--servir");
const version = JSON.parse(readFileSync("package.json", "utf8")).version;

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist/assets", { recursive: true });
cpSync("public", "dist", { recursive: true });

const opciones = {
  entryPoints: ["src/main.jsx"],
  bundle: true,
  outfile: "dist/assets/app.js",
  format: "iife",
  jsx: "automatic",
  target: ["chrome110", "edge110"],
  minify: !servir && !process.env.DEPURAR,
  sourcemap: servir || !!process.env.DEPURAR,
  define: { "process.env.NODE_ENV": servir ? '"development"' : '"production"', __VERSION__: JSON.stringify(version) },
  loader: { ".svg": "text" },
  legalComments: "none",
  logLevel: "info",
};

function escribirIndex() {
  const css = readFileSync("dist/assets/app.css", "utf8");
  const js = readFileSync("dist/assets/app.js", "utf8");
  const huella = createHash("sha1").update(css + js).digest("hex").slice(0, 8);
  const html = readFileSync("src/index.html", "utf8").replaceAll("{{HUELLA}}", huella).replaceAll("{{VERSION}}", version);
  writeFileSync("dist/index.html", html);
  // El service worker usa la huella para renovar la caché en cada versión
  const sw = readFileSync("public/sw.js", "utf8").replace("{{HUELLA}}", huella);
  writeFileSync("dist/sw.js", sw);
}

if (servir) {
  const ctx = await esbuild.context({ ...opciones, plugins: [{ name: "index", setup(b) { b.onEnd(() => escribirIndex()); } }] });
  await ctx.watch();
  await ctx.serve({ servedir: "dist", port: 8000 });
  console.log("Servidor en http://localhost:8000");
} else {
  await esbuild.build(opciones);
  escribirIndex();
  console.log(`Aplicación ${version} construida en app/dist`);
}
