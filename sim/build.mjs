// Bundle src/main.js (three.js + the show + the print art as data URLs) into one self-contained index.html.
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
const r = await build({ entryPoints: ["src/main.js"], bundle: true, format: "iife", minify: true, write: false,
  target: "es2020", loader: { ".jpg": "dataurl" }, legalComments: "eof" });
const js = r.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const html = readFileSync("src/index.template.html", "utf8").replace("/*BUNDLE*/", () => js);
writeFileSync("index.html", html);
console.log(`index.html ${(html.length / 1024).toFixed(0)} KB`);
