import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "node_modules", "pdfjs-dist", "build");
const destDir = path.join(root, "public");

for (const name of ["pdf.mjs", "pdf.worker.min.mjs"]) {
  const src = path.join(srcDir, name);
  const dest = path.join(destDir, name);
  if (!fs.existsSync(src)) {
    console.warn(`[copy-pdfjs-public] skip missing ${src}`);
    continue;
  }
  fs.copyFileSync(src, dest);
  console.log(`[copy-pdfjs-public] ${name} → public/`);
}
