/**
 * 최소 유효 PDF 생성 → public/forms/sample.pdf
 * 실행: node scripts/gen-sample-pdf.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const out = path.join(root, "public", "forms", "sample.pdf");

const stream = "BT /F1 18 Tf 50 150 Td (AuctionFlow PDF sample) Tj ET\n";
const streamLen = Buffer.byteLength(stream, "utf8");

const objs = {
  1: "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n",
  2: "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n",
  3: "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n",
  4: `4 0 obj<</Length ${streamLen}>>stream\n${stream}endstream\nendobj\n`,
  5: "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n",
};

const header = "%PDF-1.4\n";
const order = [1, 2, 3, 4, 5];
let body = header;
/** @type {Record<number, number>} */
const offsets = {};
for (const id of order) {
  offsets[id] = Buffer.byteLength(body, "utf8");
  body += objs[id];
}
const xrefStart = Buffer.byteLength(body, "utf8");
let xref = "xref\n0 6\n0000000000 65535 f \n";
for (const id of order) {
  xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
}
const trailer = `trailer<</Size 6/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF\n`;
const pdf = body + xref + trailer;

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, pdf, "utf8");
console.log("wrote", out, pdf.length, "bytes");
