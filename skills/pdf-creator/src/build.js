// pdf-creator skill — Markdown / JSON spec → .pdf binary (pdfkit, pure JS)
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const opts = { input: null, out: null, title: null, author: null, font: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") opts.out = argv[++i];
    else if (a === "--title") opts.title = argv[++i];
    else if (a === "--author") opts.author = argv[++i];
    else if (a === "--font") opts.font = argv[++i];
    else if (a === "-h" || a === "--help") opts.help = true;
    else if (!a.startsWith("--")) opts.input = a;
  }
  return opts;
}

function readInput(opts) {
  if (!opts.input || opts.input === "-") return fs.readFileSync(0, "utf8");
  return fs.readFileSync(opts.input, "utf8");
}

// ─── CJK font resolution ────────────────────────────────────────────────────
// pdfkit's built-in Helvetica has no CJK glyphs. We bundle a subsetted CJK font
// (GB2312 level-1, ~3MB) so Chinese/Japanese/Korean renders out of the box.
// `--font` overrides it; otherwise we fall back to a system CJK font if present.
import { fileURLToPath } from "node:url";

const BUNDLED_FONT = fileURLToPath(new URL("../assets/NotoSansCJK-subset.ttf", import.meta.url));

const CJK_FONT_CANDIDATES = [
  "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
  "/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf",
  "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
  "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
  "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
  "/System/Library/Fonts/PingFang.ttc",
  "/System/Library/Fonts/STHeiti Medium.ttc",
  "/System/Library/Fonts/Hiragino Sans GB.ttc",
  "C:\\Windows\\Fonts\\msyh.ttc",
  "C:\\Windows\\Fonts\\simhei.ttf",
];

function hasCJK(text) {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(text);
}

function findCJKFont(explicit) {
  if (explicit && fs.existsSync(explicit)) return explicit;
  if (fs.existsSync(BUNDLED_FONT)) return BUNDLED_FONT;
  // pdfkit cannot subset .ttc (TrueType Collection) fonts, so only accept .ttf/.otf.
  for (const p of CJK_FONT_CANDIDATES) {
    if (fs.existsSync(p) && /\.(ttf|otf)$/i.test(p)) return p;
  }
  return null;
}

// ─── Markdown → blocks ──────────────────────────────────────────────────────
// Blocks: { type: "title"|"h1"|"h2"|"h3"|"p"|"bullets"|"table"|"code"|"pagebreak", ... }
function parseMarkdown(md) {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  const push = (b) => { if (b) blocks.push(b); };

  while (i < lines.length) {
    const line = lines[i];

    // page break
    if (/^\s*-{3,}\s*$/.test(line)) { push({ type: "pagebreak" }); i++; continue; }

    // code fence
    if (/^\s*```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; // closing fence
      push({ type: "code", text: buf.join("\n") });
      continue;
    }

    // headings
    const h1 = line.match(/^#\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    const h3 = line.match(/^###\s+(.*)$/);
    if (h1) { push({ type: "h1", text: h1[1].trim() }); i++; continue; }
    if (h2) { push({ type: "h2", text: h2[1].trim() }); i++; continue; }
    if (h3) { push({ type: "h3", text: h3[1].trim() }); i++; continue; }

    // table
    if (/^\s*\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        const cells = lines[i].split("|").slice(1, -1).map((c) => c.trim());
        rows.push(cells);
        i++;
      }
      // drop separator row (|---|)
      const header = rows[0] || [];
      const body = rows.filter((r, idx) => idx !== 0 && !r.every((c) => /^:?-+:?$/.test(c)));
      push({ type: "table", headers: header, rows: body });
      continue;
    }

    // bullets (collect consecutive bullet lines, track nesting)
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        const m = lines[i].match(/^(\s*)[-*+]\s+(.*)$/);
        const level = Math.floor((m[1] || "").length / 2);
        items.push({ text: m[2].trim(), level });
        i++;
      }
      push({ type: "bullets", items });
      continue;
    }

    // blockquote
    if (/^\s*>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
      push({ type: "quote", text: buf.join(" ") });
      continue;
    }

    // blank line
    if (line.trim() === "") { i++; continue; }

    // paragraph (collect until blank line)
    const buf = [line.trim()];
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !/^\s*[-*+]\s+/.test(lines[i]) && !/^\s*\|/.test(lines[i]) && !/^\s*```/.test(lines[i]) && !/^#{1,3}\s/.test(lines[i])) {
      buf.push(lines[i].trim());
      i++;
    }
    push({ type: "p", text: buf.join(" ") });
  }
  return blocks;
}

// JSON spec → blocks
function parseSpec(text) {
  const data = JSON.parse(text);
  const blocks = [];
  if (data.title) blocks.push({ type: "h1", text: data.title });
  if (data.subtitle) blocks.push({ type: "h3", text: data.subtitle });
  const pages = Array.isArray(data.pages) ? data.pages : (Array.isArray(data.blocks) ? [{ blocks: data.blocks }] : []);
  for (const page of pages) {
    if (blocks.length) blocks.push({ type: "pagebreak" });
    for (const b of (page.blocks || [])) {
      switch (b.type) {
        case "heading": blocks.push({ type: b.level === 1 ? "h1" : b.level === 2 ? "h2" : "h3", text: b.text }); break;
        case "paragraph": blocks.push({ type: "p", text: b.text }); break;
        case "bullets": blocks.push({ type: "bullets", items: (b.items || []).map((x) => typeof x === "string" ? { text: x, level: 0 } : { text: x.text, level: x.level || 0 }) }); break;
        case "quote": blocks.push({ type: "quote", text: b.text }); break;
        case "code": blocks.push({ type: "code", text: b.text }); break;
        case "table": blocks.push({ type: "table", headers: b.headers || [], rows: b.rows || [] }); break;
        case "pagebreak": blocks.push({ type: "pagebreak" }); break;
        default: break;
      }
    }
  }
  return blocks;
}

// ─── PDF rendering ──────────────────────────────────────────────────────────
const MARGIN = 50;
const PAGE_W = 612; // US Letter
const PAGE_H = 792;
const CONTENT_W = PAGE_W - MARGIN * 2;

function render(doc, blocks, fontPath) {
  const font = fontPath ? "CJK" : "Helvetica";
  if (fontPath) {
    try { doc.registerFont("CJK", fontPath); } catch { /* fall back to Helvetica */ }
  }
  const useCJK = font === "CJK";
  const F = (name) => (useCJK ? "CJK" : name);

  let y = MARGIN;
  const ensure = (needed) => {
    if (y + needed > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN; }
  };

  for (const b of blocks) {
    switch (b.type) {
      case "h1": {
        ensure(60);
        doc.font(F("Helvetica-Bold")).fontSize(26).fillColor("#1a1a1a");
        doc.text(b.text, MARGIN, y, { width: CONTENT_W, align: "center" });
        y = doc.y + 14;
        break;
      }
      case "h2": {
        ensure(40);
        doc.font(F("Helvetica-Bold")).fontSize(18).fillColor("#1f6feb");
        doc.text(b.text, MARGIN, y, { width: CONTENT_W });
        y = doc.y + 10;
        break;
      }
      case "h3": {
        ensure(30);
        doc.font(F("Helvetica-Bold")).fontSize(14).fillColor("#333333");
        doc.text(b.text, MARGIN, y, { width: CONTENT_W });
        y = doc.y + 8;
        break;
      }
      case "p": {
        ensure(30);
        doc.font(F("Helvetica")).fontSize(11).fillColor("#333333");
        doc.text(b.text, MARGIN, y, { width: CONTENT_W, lineGap: 4 });
        y = doc.y + 8;
        break;
      }
      case "quote": {
        ensure(30);
        doc.font(F("Helvetica-Oblique")).fontSize(11).fillColor("#666666");
        doc.text(b.text, MARGIN + 12, y, { width: CONTENT_W - 12, lineGap: 4 });
        y = doc.y + 8;
        break;
      }
      case "bullets": {
        for (const it of b.items) {
          ensure(20);
          const indent = MARGIN + 12 + (it.level || 0) * 16;
          doc.font(F("Helvetica")).fontSize(11).fillColor("#333333");
          doc.text("•  " + it.text, indent, y, { width: CONTENT_W - (indent - MARGIN), lineGap: 3 });
          y = doc.y + 4;
        }
        y += 4;
        break;
      }
      case "code": {
        ensure(20);
        const lines = b.text.split("\n");
        const lineH = 13;
        const blockH = lines.length * lineH + 16;
        ensure(blockH);
        doc.rect(MARGIN, y, CONTENT_W, blockH).fill("#f5f5f5");
        doc.font(F("Courier")).fontSize(9).fillColor("#24292f");
        doc.text(b.text, MARGIN + 8, y + 8, { width: CONTENT_W - 16, lineGap: 2 });
        y = y + blockH + 10;
        break;
      }
      case "table": {
        const headers = b.headers || [];
        const rows = b.rows || [];
        const colW = CONTENT_W / Math.max(1, headers.length || (rows[0]?.length || 1));
        const rowH = 22;
        const totalH = (rows.length + 1) * rowH;
        ensure(totalH);
        // header
        doc.rect(MARGIN, y, CONTENT_W, rowH).fill("#1f6feb");
        doc.font(F("Helvetica-Bold")).fontSize(10).fillColor("#ffffff");
        headers.forEach((h, ci) => doc.text(String(h), MARGIN + ci * colW + 4, y + 6, { width: colW - 8 }));
        y += rowH;
        // body
        doc.font(F("Helvetica")).fontSize(10).fillColor("#333333");
        rows.forEach((r, ri) => {
          if (ri % 2 === 1) doc.rect(MARGIN, y, CONTENT_W, rowH).fill("#f5f5f5");
          r.forEach((c, ci) => doc.text(String(c), MARGIN + ci * colW + 4, y + 6, { width: colW - 8 }));
          y += rowH;
        });
        y += 10;
        break;
      }
      case "pagebreak": {
        doc.addPage();
        y = MARGIN;
        break;
      }
      default: break;
    }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || (!opts.input && process.stdin.isTTY)) {
    process.stderr.write(
      "pdf-creator skill — Markdown/JSON → .pdf\n" +
      "Usage: node build.js <input.md|input.json|-> [--out path.pdf] [--title T] [--author A] [--font path]\n"
    );
    process.exit(0);
  }

  const text = readInput(opts);
  let blocks;
  try {
    blocks = opts.input && /\.json$/i.test(opts.input) ? parseSpec(text) : parseMarkdown(text);
  } catch (e) {
    process.stderr.write("Parse error: " + e.message + "\n");
    process.exit(1);
  }
  if (!blocks.length) { process.stderr.write("No content parsed.\n"); process.exit(1); }

  const needsCJK = hasCJK(text);
  const fontPath = needsCJK ? findCJKFont(opts.font) : null;
  if (needsCJK && !fontPath) {
    process.stderr.write("Warning: input contains CJK but no CJK font found; CJK glyphs may render as blank boxes.\n");
  }

  const doc = new PDFDocument({ size: "LETTER", margin: MARGIN, info: {
    Title: opts.title || "Document",
    Author: opts.author || "MyAgent",
    Subject: "Generated by pdf-creator skill",
  } });

  let outPath = opts.out;
  if (!outPath) {
    const base = opts.input && opts.input !== "-"
      ? opts.input.replace(/\.(md|markdown|json)$/i, "")
      : "document";
    outPath = base + ".pdf";
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);
  render(doc, blocks, fontPath);
  doc.end();
  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
  process.stdout.write(outPath + "\n");
}

main().catch((e) => {
  process.stderr.write("Error: " + (e?.message || String(e)) + "\n");
  process.exit(1);
});
