#!/usr/bin/env node
/**
 * Unified Summary Tool
 *
 * Auto-detects input type (URL / PDF / Video) and produces a
 * structured Traditional Chinese Markdown summary using Gemini.
 *
 * Usage:
 * node scripts/summarize.js <url-or-file>
 * node scripts/summarize.js --type url|pdf|video <input>
 */

import { GoogleGenAI } from "@google/genai";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODELS = {
  url: process.env.GEMINI_SUMMARY_MODEL || "gemini-3.5-flash",
  pdf: process.env.GEMINI_SUMMARY_MODEL || "gemini-3.5-flash",
  video: process.env.GEMINI_SUMMARY_MODEL || "gemini-3.5-flash",
  audio: process.env.GEMINI_SUMMARY_MODEL || "gemini-3.5-flash",
};

const MAX_CONTENT_LENGTH = 120_000;
const MIN_CONTENT_LENGTH = 200;
const FETCH_TIMEOUT_MS = 30_000;

const VIDEO_EXTENSIONS = new Set([
  ".3gp", ".avi", ".m4v", ".mkv", ".mov",
  ".mp4", ".mpeg", ".mpg", ".ogv", ".webm",
]);

const VIDEO_MIME_TYPES = {
  ".3gp": "video/3gpp",
  ".avi": "video/x-msvideo",
  ".m4v": "video/x-m4v",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".mpeg": "video/mpeg",
  ".mpg": "video/mpeg",
  ".ogv": "video/ogg",
  ".webm": "video/webm",
};

const YOUTUBE_HOSTS = new Set([
  "youtube.com", "www.youtube.com", "m.youtube.com",
  "youtu.be", "www.youtu.be",
]);

const AUDIO_EXTENSIONS = new Set([
  ".mp3", ".wav", ".aac", ".ogg", ".flac", ".m4a", ".aiff", ".wma", ".opus",
]);

const AUDIO_MIME_TYPES = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".aiff": "audio/aiff",
  ".wma": "audio/x-ms-wma",
  ".opus": "audio/opus",
};

// ---------------------------------------------------------------------------
// Shared Utilities
// ---------------------------------------------------------------------------

function printUsage() {
  console.error("用法：node scripts/summarize.js [--type url|pdf|video|audio] <input>");
  console.error("");
  console.error("范例：");
  console.error('  node scripts/summarize.js "https://example.com/post/123"');
  console.error('  node scripts/summarize.js "./reports/quarterly.pdf"');
  console.error('  node scripts/summarize.js "https://youtu.be/abc123"');
  console.error('  node scripts/summarize.js "./recording.mp3"');
}

function ensureApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "缺少 GEMINI_API_KEY。请先执行 export GEMINI_API_KEY=your_api_key"
    );
  }
  return apiKey;
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function trimContent(value, maxLength = MAX_CONTENT_LENGTH) {
  const normalized = normalizeText(value);
  if (normalized.length <= maxLength) {
    return { text: normalized, truncated: false };
  }
  return {
    text: `${normalized.slice(0, maxLength)}\n\n[内容因长度限制已截断]`,
    truncated: true,
  };
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`抓取逾时（${FETCH_TIMEOUT_MS / 1000} 秒）：${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function isRemoteUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function createMediaPart(uri, mimeType) {
  if (uri && uri.startsWith("data:")) {
    return {
      inlineData: {
        mimeType,
        data: uri.replace(/^data:[^;]+;base64,/, ""),
      },
    };
  }
  return {
    fileData: {
      fileUri: uri,
      mimeType,
    },
  };
}

async function streamContentResponse(stream) {
  for await (const chunk of stream) {
    if (chunk.text) {
      process.stdout.write(chunk.text);
    } else if (
      chunk.event_type === "content.delta" &&
      chunk.delta?.type === "text" &&
      chunk.delta.text
    ) {
      process.stdout.write(chunk.delta.text);
    }
  }
  process.stdout.write("\n");
}

// ---------------------------------------------------------------------------
// Input Type Detection
// ---------------------------------------------------------------------------

function parseCliArgs() {
  const args = process.argv.slice(2);
  let type = null;
  let input = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--type" && i + 1 < args.length) {
      type = args[++i];
      if (!["url", "pdf", "video", "audio"].includes(type)) {
        throw new Error(`不支援的类型：${type}（可用：url, pdf, video, audio）`);
      }
    } else if (!input) {
      input = args[i];
    }
  }

  return { type, input };
}

function detectInputType(input) {
  if (!input) throw new Error("请提供输入（URL 或档案路径）。");

  // data: URI → video
  if (input.startsWith("data:")) return "video";

  // URL-based detection
  if (isRemoteUrl(input)) {
    try {
      const url = new URL(input);
      const pathname = url.pathname.toLowerCase();

      // PDF URL
      if (pathname.endsWith(".pdf")) return "pdf";

      // Video URL
      const ext = path.extname(pathname);
      if (VIDEO_EXTENSIONS.has(ext)) return "video";

      // Audio URL
      if (AUDIO_EXTENSIONS.has(ext)) return "audio";

      // YouTube
      if (YOUTUBE_HOSTS.has(url.hostname)) return "video";

      // Default: treat as web page
      return "url";
    } catch {
      return "url";
    }
  }

  // Local file detection
  let localPath = input;
  if (input.startsWith("file://")) localPath = fileURLToPath(input);
  const ext = path.extname(localPath).toLowerCase();

  if (ext === ".pdf") return "pdf";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (AUDIO_EXTENSIONS.has(ext)) return "audio";

  throw new Error(
    `无法辨识输入类型：${input}。支援的格式：网页 URL、.pdf 档案、影片档案（${[...VIDEO_EXTENSIONS].join(", ")}）、音讯档案（${[...AUDIO_EXTENSIONS].join(", ")}）`
  );
}

// ---------------------------------------------------------------------------
// URL Handler
// ---------------------------------------------------------------------------

async function fetchHtml(url) {
  const response = await fetchWithTimeout(url, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "GitHubClawDev/summary (+https://github.com/rewq0494/GitHubClawDev)",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(
      `抓取网址失败：${url}（HTTP ${response.status} ${response.statusText}）`
    );
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/pdf")) {
    return { __pdfFallback: true };
  }
  if (
    !contentType.includes("text/html") &&
    !contentType.includes("application/xhtml+xml")
  ) {
    throw new Error(
      `网址不是可解析的 HTML 页面：${url}（Content-Type: ${contentType || "unknown"}）。若为 PDF，请改用 --type pdf`
    );
  }
  return response.text();
}

function extractFromBody(document) {
  const root = document.querySelector("main, article, body");
  const title =
    normalizeText(document.querySelector("title")?.textContent || "") ||
    "未命名页面";
  const siteName =
    normalizeText(
      document
        .querySelector('meta[property="og:site_name"]')
        ?.getAttribute("content") || ""
    ) || null;
  return {
    title,
    siteName,
    byline: null,
    excerpt: null,
    content: normalizeText(root?.textContent || ""),
    source: "body-fallback",
  };
}

function extractArticle(html, url) {
  const { document, window } = parseHTML(html);
  if (window?.document && !window.document.location) {
    window.document.location = new URL(url);
  }
  const article = new Readability(document).parse();
  if (!article?.textContent) return extractFromBody(document);

  return {
    title: normalizeText(article.title) || "未命名页面",
    siteName: normalizeText(article.siteName || "") || null,
    byline: normalizeText(article.byline || "") || null,
    excerpt: normalizeText(article.excerpt || "") || null,
    content: normalizeText(article.textContent),
    source: "readability",
  };
}

function buildUrlPrompt({
  url,
  title,
  siteName,
  byline,
  excerpt,
  content,
  truncated,
}) {
  const code = process.env.CLAW_LANGUAGE || "en";
  const map = {
    "zh-CN": "Simplified Chinese",
    "en": "English"
  };
  const fullName = map[code] || "English";

  if (code === "zh-CN") {
    return `你是一个专门整理网页内容的简体中文编辑。请根据以下资料，输出固定格式的 Markdown 摘要。

任务目标：
1. 深入理解文章内容，提供有深度与细节的摘要，避免过于简略空泛。
2. 绝对不要虚构（Hallucination）原文没有提及的信息。若信息不足以形成某个段落，请直接省略该部分或注明信息不足。
3. 全文必须使用简体中文，并尽可能保留原文的专有名词（可于括号内附上原文）。

格式规范（重要）：
- 标题请用粗体加 emoji，例如「**📝 内容摘要**」，不要使用 # 标题语法。
- 不要使用 Markdown 表格（| 语法），改用条列格式。
- 条列项目一律使用扁平结构（只用 - 开头），不要使用编号子列表（1. 2. 3.）或巢状缩进。
- 条列项目中若需标示重点名称，直接写在 - 后面即可，不要在条列内再使用粗体。
- 这些规则是为了确保输出在 GitHub Issue 和 Telegram 都能正确显示。

请依照以下结构输出：

**📝 内容摘要**

**📌 来源**
- 类型：网页
- 标题：
- 网站：
- 作者：
- 网址：

**💡 核心概述**
（请以流畅的段落整理文章的脉络。包含：文章的主题背景、关键论点/方法、以及最终结论。请视原文的丰富度来决定篇幅，确保能完整传达作者的原意与重要细节。）

**🔍 重点条列**
（请萃取原文中最具价值的重点。数量请依据原文内容决定，宁缺勿滥。每个重点请尽量包含具体的细节、范例或解释，不要仅用一句话带过。）
- 重点 1：具体说明...
- 重点 2：具体说明...

**📊 关键数据与事实**
（如原文有关键数字、金额、日期、百分比等，请用条列呈现；若无相关信息则省略此段）
- 项目：数值/日期/事实
- 项目：数值/日期/事实

**🎯 行动建议**
（若文章内容有提供建议或可执行的步骤，请在此条列；若无明确建议，请写「目前无明确行动建议」）

---
以下是原始资料：
- 标题：${title}
- 网站：${siteName || "未提供"}
- 作者：${byline || "未提供"}
- 摘要：${excerpt || "未提供"}
- 网址：${url}
- 内容是否截断：${truncated ? "是" : "否"}

原文内容：
"""
${content}
"""
You MUST respond entirely in ${fullName}.`;
  } else {
    return `You are a professional webpage content editor. Based on the following information, please produce a structured Markdown summary.

Task Goals:
1. Understand the article in depth and provide detailed summaries instead of shallow lists.
2. Never hallucinate facts not present in the source. If information is insufficient for a section, omit or specify it.
3. The entire response must be in English. Keep proper nouns and key terms.

Formatting Rules (Important):
- Headers must use bold and emojis, e.g., "**📝 Summary**", do NOT use "#" markdown headers.
- Do not use markdown tables (| syntax), use bullet points instead.
- Bullet points must be flat (only starting with "-"), do not use sub-numbering (1. 2. 3.) or nested indentation.
- For key points, put key names right after the "-", do not use bolding within bullet items.
- These rules ensure the output displays correctly on GitHub Issues and Telegram.

Please output using the following structure:

**📝 Summary**

**📌 Source**
- Type: Webpage
- Title:
- Website:
- Author:
- URL:

**💡 Core Overview**
(Please write a coherent paragraph outlining the context, key arguments/methods, and final conclusion. Adjust the length based on content depth to capture key details.)

**🔍 Key Highlights**
(Extract the most valuable takeaways. Keep them rich and informative instead of single-sentence bullet points.)
- Point 1: Detailed explanation...
- Point 2: Detailed explanation...

**📊 Key Metrics & Facts**
(If there are metrics, amounts, dates, or percentages, list them here; otherwise omit this section.)
- Item: Value/Date/Fact
- Item: Value/Date/Fact

**🎯 Actionable Recommendations**
(If the article outlines recommendations or actionable steps, list them here; otherwise write "No clear actionable recommendations at this time.")

---
Below is the metadata:
- Title: ${title}
- Website: ${siteName || "Not provided"}
- Author: ${byline || "Not provided"}
- Excerpt: ${excerpt || "Not provided"}
- URL: ${url}
- Truncated: ${truncated ? "Yes" : "No"}

Source Content:
"""
${content}
"""
You MUST respond entirely in ${fullName}.`;
  }
}

async function handleUrl(input, client) {
  const url = (() => {
    try {
      return new URL(input).toString();
    } catch {
      throw new Error(`网址格式错误：${input}`);
    }
  })();

  console.error(`正在抓取网址：${url}`);
  const html = await fetchHtml(url);

  // Auto-fallback: if the URL serves a PDF, delegate to PDF handler
  if (html && html.__pdfFallback) {
    return { __pdfFallback: true, url };
  }

  console.error("正在抽取正文...");
  const article = extractArticle(html, url);
  const prepared = trimContent(article.content);

  if (prepared.text.length < MIN_CONTENT_LENGTH) {
    throw new Error(
      `无法从页面抽出足够正文：${url}。这可能是登入页、动态页，或页面内容过少。`
    );
  }

  return {
    dryRunInfo: {
      detectedType: "url",
      url,
      title: article.title,
      siteName: article.siteName,
      byline: article.byline,
      source: article.source,
      contentLength: prepared.text.length,
      truncated: prepared.truncated,
      preview: prepared.text.slice(0, 280),
    },
    model: MODELS.url,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: buildUrlPrompt({
              url,
              title: article.title,
              siteName: article.siteName,
              byline: article.byline,
              excerpt: article.excerpt,
              content: prepared.text,
              truncated: prepared.truncated,
            }),
          },
        ],
      },
    ],
    cleanup: null,
  };
}

// ---------------------------------------------------------------------------
// PDF Handler
// ---------------------------------------------------------------------------

function buildPdfPrompt() {
  const code = process.env.CLAW_LANGUAGE || "en";
  const map = {
    "zh-CN": "Simplified Chinese",
    "en": "English"
  };
  const fullName = map[code] || "English";

  if (code === "zh-CN") {
    return `你是专业的文件 analysis 助手。请仔细阅读这份 PDF 文件的内容，并产出结构化、重点清晰的简体中文摘要。

任务目标：
1. 确保涵盖文件中各个章节的重要内容，不要只摘要前几页。
2. 绝对不要虚构文件中没有提到的信息。
3. 全文使用简体中文，保留专有名词的原文（括号附上）。
4. 数字和日期必须准确引用，不可估算。

格式规范（重要）：
- 标题请用粗体加 emoji，例如「**📝 内容摘要**」，不要使用 # 标题语法。
- 不要使用 Markdown 表格（| 语法），改用条列格式。
- 条列项目一律使用改变的扁平结构（只用 - 开头），不要使用编号子列表（1. 2. 3.）或巢状缩进。
- 条列项目中若需标示重点名称，直接写在 - 后面即可，不要在条列内再使用粗体。
- 这些规则是为了确保输出在 GitHub Issue 和 Telegram 都能正确显示。

请依照以下结构输出：

**📝 内容摘要**

**📌 来源**
- 类型：PDF 文件
- 文件名：（请从文件内容或脉络推断标题）

**💡 核心概述**
（请以流畅的段落整理文件的核心脉络，包含：文件主旨与背景、主要探讨的方法论或内容、以及结论与影响。请依据文件厚度与信息量调整篇幅，确保重要细节不遗漏。）

**🔍 重点条列**
（请萃取文件中的重要论点、发现或规范。数量请视文件内容而定。每点需包含具体细节、数据或范例说明。）
- 重点说明...

**📊 关键数据与事实**
（如有关键数字、金额、日期、百分比等，请用条列呈现；若无则省略此段）
- 项目：数值/日期
- 项目：数值/日期

**📖 专有名词表**
（若文件中有频繁出现或具关键性的专业术语，请用条列并简要解释；若无则省略此段）
- **术语**：说明
- **术语**：说明

**🎯 行动建议**
（若文件包含后续计划、建议采取的步骤或管理决策，请在此整理出来；若无则写「目前无明确行动建议」）
---
You MUST respond entirely in ${fullName}.`;
  } else {
    return `You are a professional document analysis assistant. Please read this PDF document carefully and produce a structured, clear English summary.

Task Goals:
1. Ensure all sections of the document are covered, not just the first few pages.
2. Never hallucinate facts not present in the document.
3. The entire response must be in English. Keep proper nouns.
4. Numbers and dates must be quoted accurately.

Formatting Rules (Important):
- Headers must use bold and emojis, e.g., "**📝 Summary**", do NOT use "#" markdown headers.
- Do not use markdown tables (| syntax), use bullet points instead.
- Bullet points must be flat (only starting with "-"), do not use sub-numbering (1. 2. 3.) or nested indentation.
- For key points, put key names right after the "-", do not use bolding within bullet items.
- These rules ensure the output displays correctly on GitHub Issues and Telegram.

Please output using the following structure:

**📝 Summary**

**📌 Source**
- Type: PDF Document
- Filename: (Infer the title from content/context)

**💡 Core Overview**
(Please write a coherent paragraph outlining the context, key arguments/methods, and final conclusion. Adjust the length based on content depth to capture key details.)

**🔍 Key Highlights**
(Extract the most valuable takeaways. Keep them rich and informative instead of single-sentence bullet points.)
- Point 1: Detailed explanation...

**📊 Key Metrics & Facts**
(If there are metrics, amounts, dates, or percentages, list them here; otherwise omit this section.)
- Item: Value/Date
- Item: Value/Date

**📖 Glossary**
(If there are frequent or key technical terms, list and explain them briefly; otherwise omit this section.)
- **Term**: Explanation
- **Term**: Explanation

**🎯 Actionable Recommendations**
(If the document outlines recommendations or actionable steps, list them here; otherwise write "No clear actionable recommendations at this time.")
---
You MUST respond entirely in ${fullName}.`;
  }
}

async function resolvePdfBuffer(rawInput) {
  if (!rawInput) throw new Error("请提供 PDF 档案路径或 URL。");

  const lower = rawInput.toLowerCase();
  if (!lower.endsWith(".pdf")) {
    try {
      const url = new URL(rawInput);
      if (!url.pathname.toLowerCase().endsWith(".pdf")) {
        console.error(`警告：输入不像 PDF 档案，仍尝试处理：${rawInput}`);
      }
    } catch {
      console.error(`警告：输入不像 PDF 档案，仍尝试处理：${rawInput}`);
    }
  }

  // Try local file first
  let localPath = rawInput;
  if (rawInput.startsWith("file://")) localPath = fileURLToPath(rawInput);
  const resolvedPath = path.resolve(localPath);

  try {
    const fileBuffer = await readFile(resolvedPath);
    return {
      source: "local-file",
      buffer: fileBuffer,
      mimeType: "application/pdf",
      localPath: resolvedPath,
      displayName: path.basename(resolvedPath),
    };
  } catch (error) {
    if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") {
      throw new Error(`无法读取档案 "${resolvedPath}"：${error.message}`);
    }
  }

  // Try remote URL
  if (isRemoteUrl(rawInput)) {
    console.error(`正在下载 PDF：${rawInput}`);
    const response = await fetchWithTimeout(rawInput);
    if (!response.ok)
      throw new Error(`下载失败（HTTP ${response.status}）：${rawInput}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const urlPath = new URL(rawInput).pathname;
    return {
      source: "remote-url",
      buffer,
      mimeType: "application/pdf",
      remoteUrl: rawInput,
      displayName: path.basename(urlPath) || "document.pdf",
    };
  }

  throw new Error(`输入既非可读取的本地档案，也非有效的 URL：${rawInput}`);
}

async function uploadPdfAndGetUri(client, pdfInput) {
  console.error("正在上传 PDF 至 Gemini Files API...");
  const blob = new Blob([pdfInput.buffer], { type: pdfInput.mimeType });
  let uploadedFile = await client.files.upload({
    file: blob,
    config: {
      mimeType: pdfInput.mimeType,
      displayName: pdfInput.displayName,
    },
  });

  while (uploadedFile.state === "PROCESSING") {
    await new Promise((r) => setTimeout(r, 2000));
    uploadedFile = await client.files.get({ name: uploadedFile.name });
  }

  if (uploadedFile.state === "FAILED") {
    throw new Error(`Gemini Files API 处理失败：${uploadedFile.name}`);
  }

  return { uri: uploadedFile.uri, name: uploadedFile.name };
}

async function handlePdf(input, client) {
  const pdfInput = await resolvePdfBuffer(input);

  const dryRunInfo = {
    detectedType: "pdf",
    source: pdfInput.source,
    mimeType: pdfInput.mimeType,
    localPath: pdfInput.localPath || null,
    remoteUrl: pdfInput.remoteUrl || null,
    bufferBytes: pdfInput.buffer.length,
    displayName: pdfInput.displayName,
  };

  console.error(`正在分析 PDF：${input}`);
  const { uri, name: uploadedFileName } = await uploadPdfAndGetUri(
    client,
    pdfInput
  );
  console.error(`已上传：${uploadedFileName}`);

  return {
    dryRunInfo,
    model: MODELS.pdf,
    contents: [
      {
        role: "user",
        parts: [
          { text: buildPdfPrompt() },
          createMediaPart(uri, pdfInput.mimeType),
        ],
      },
    ],
    cleanup: async () => {
      await client.files.delete({ name: uploadedFileName }).catch(() => {});
    },
  };
}

// ---------------------------------------------------------------------------
// Video Handler
// ---------------------------------------------------------------------------

function getVideoMimeType(filePath) {
  return VIDEO_MIME_TYPES[path.extname(filePath).toLowerCase()] || "video/mp4";
}

function buildVideoPrompt() {
  const code = process.env.CLAW_LANGUAGE || "en";
  const map = {
    "zh-CN": "Simplified Chinese",
    "en": "English"
  };
  const fullName = map[code] || "English";

  if (code === "zh-CN") {
    return `你是一个专业的影片内容分析师。请仔细观看这段影片的完整内容，并产出结构化、重点清晰的简体中文摘要。

任务目标：
1. 确保涵盖影片从头到尾的重要段落，不要只摘要开头。
2. 绝对不要虚构影片中没有出现的信息。
3. 全文使用简体中文，保留专有名词的原文（括号附上）。

格式规范（重要）：
- 标题请用粗体加 emoji，例如「**📝 内容摘要**」，不要使用 # 标题语法。
- 不要使用 Markdown 表格（| 语法），改用条列格式。
- 条列项目一律使用扁平结构（只用 - 开头），不要使用编号子列表（1. 2. 3.）或巢状缩进。
- 条列项目中若需标示重点名称，直接写在 - 后面即可，不要在条列内再使用粗体。
- 这些规则是为了确保输出在 GitHub Issue 和 Telegram 都能正确显示。

请依照以下结构输出：

**📝 内容摘要**

**📌 来源**
- 类型：影片

**💡 核心概述**
（请以流畅的段落整理影片的脉络，包含：影片主题与背景、核心内容或关键步骤、以及最终结论与启示。请依据影片长度与信息丰富度调整篇幅。）

**🔍 重点条列**
（请萃取影片中的精华重点。数量视内容而定，宁缺勿滥。若影片中有特定的步骤、操作画面或关键论述，请尽量补上具体细节。）
- 重点说明...

**📊 关键数据与事实**
（如影片中提及关键数字、金额、日期、百分比等，请用条列呈现；若无则省略此段）
- 项目：数值/日期
- 项目：数值/日期

**🎯 行动建议**
（观看后若有建议行动或下一步，请整理于此；若无则写「目前无明确行动建议」）
---
You MUST respond entirely in ${fullName}.`;
  } else {
    return `You are a professional video analyst. Please watch the entire content of the video carefully and produce a structured English summary.

Task Goals:
1. Ensure the summary covers segments from beginning to end, not just the introduction.
2. Never hallucinate information not shown in the video.
3. The entire response must be in English. Keep proper nouns.

Formatting Rules (Important):
- Headers must use bold and emojis, e.g., "**📝 Summary**", do NOT use "#" markdown headers.
- Do not use markdown tables (| syntax), use bullet points instead.
- Bullet points must be flat (only starting with "-"), do not use sub-numbering (1. 2. 3.) or nested indentation.
- For key points, put key names right after the "-", do not use bolding within bullet items.
- These rules ensure the output displays correctly on GitHub Issues and Telegram.

Please output using the following structure:

**📝 Summary**

**📌 Source**
- Type: Video

**💡 Core Overview**
(Please write a coherent paragraph outlining the context, key arguments/methods, and final conclusion. Adjust the length based on content depth to capture key details.)

**🔍 Key Highlights**
(Extract the most valuable takeaways. Keep them rich and informative instead of single-sentence bullet points.)
- Point 1: Detailed explanation...

**📊 Key Metrics & Facts**
(If there are metrics, amounts, dates, or percentages, list them here; otherwise omit this section.)
- Item: Value/Date
- Item: Value/Date

**🎯 Actionable Recommendations**
(If the video outlines recommendations or actionable steps, list them here; otherwise write "No clear actionable recommendations at this time.")
---
You MUST respond entirely in ${fullName}.`;
  }
}

async function resolveVideoInput(rawInput) {
  if (!rawInput) throw new Error("请提供影片 URL 或本地档案路径。");

  if (rawInput.startsWith("data:")) {
    return {
      source: "data-uri",
      uri: rawInput,
      mimeType:
        rawInput.match(/^data:([^;]+);base64,/)?.[1] || "video/mp4",
    };
  }

  // Try local file first
  let localPath = rawInput;
  if (rawInput.startsWith("file://")) localPath = fileURLToPath(rawInput);
  const resolvedPath = path.resolve(localPath);

  try {
    const fileBuffer = await readFile(resolvedPath);
    const mimeType = getVideoMimeType(resolvedPath);
    return {
      source: "local-file",
      uri: `data:${mimeType};base64,${fileBuffer.toString("base64")}`,
      mimeType,
      localPath: resolvedPath,
    };
  } catch (error) {
    if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") {
      throw new Error(`无法读取影片档案 "${resolvedPath}"：${error.message}`);
    }
  }

  // Remote URL
  if (isRemoteUrl(rawInput)) {
    return {
      source: "remote-url",
      uri: rawInput,
      mimeType: "video/mp4",
    };
  }

  throw new Error(
    `输入既非可读取的本地档案，也非有效的影片 URL：${rawInput}`
  );
}

async function handleVideo(input) {
  const videoInput = await resolveVideoInput(input);

  return {
    dryRunInfo: {
      detectedType: "video",
      source: videoInput.source,
      mimeType: videoInput.mimeType,
      localPath: videoInput.localPath || null,
      uriPreview:
        videoInput.source === "local-file" ||
        videoInput.source === "data-uri"
          ? `${videoInput.uri.slice(0, 48)}...`
          : videoInput.uri,
    },
    model: MODELS.video,
    contents: [
      {
        role: "user",
        parts: [
          { text: buildVideoPrompt() },
          createMediaPart(videoInput.uri, videoInput.mimeType),
        ],
      },
    ],
    cleanup: null,
  };
}

// ---------------------------------------------------------------------------
// Audio Handler
// ---------------------------------------------------------------------------

function getAudioMimeType(filePath) {
  return AUDIO_MIME_TYPES[path.extname(filePath).toLowerCase()] || "audio/mpeg";
}

function buildAudioPrompt() {
  const code = process.env.CLAW_LANGUAGE || "en";
  const map = {
    "zh-CN": "Simplified Chinese",
    "en": "English"
  };
  const fullName = map[code] || "English";

  if (code === "zh-CN") {
    return `你是一个专业的音讯内容分析师。请仔细聆听这段音讯的完整内容，并产出结构化、重点清晰的简体中文摘要。

任务目标：
1. 确保涵盖音讯从头到尾的对话或独白重点。
2. 绝对不要虚构音讯中没有出现的信息。
3. 全文使用简体中文，保留专有名词的原文（括号附上）。

格式规范（重要）：
- 标题请用粗体加 emoji，例如「**📝 内容摘要**」，不要使用 # 标题语法。
- 不要使用 Markdown 表格（| 语法），改用条列格式。
- 条列项目一律使用扁平结构（只用 - 开头），不要使用编号子列表（1. 2. 3.）或巢状缩进。
- 条列项目中若需标示重点名称，直接写在 - 后面即可，不要在条列内再使用粗体。
- 这些规则是为了确保输出在 GitHub Issue 和 Telegram 都能正确显示。

请依照以下结构输出：

**📝 内容摘要**

**📌 来源**
- 类型：音讯

**💡 核心概述**
（请以流畅的段落整理音讯的脉络，包含：讨论主题与背景、核心对话内容或关键论点、以及结论。请依据音讯长度与信息丰富度调整篇幅。）

**🔍 重点条列**
（请萃取音讯中的精华论点或对话重点。数量视内容而定，宁缺勿滥。尽可能保留讲者的具体举例或重要细节。）
- 重点说明...

**📊 关键数据与事实**
（如音讯中提及关键数字、金额、日期等，请用条列呈现；若无则省略此段）
- 项目：数值/日期
- 项目：数值/日期

**🎯 行动建议**
（聆听后若有明确的建议行动或后续规划，请整理于此；若无则写「目前无明确行动建议」）
---
You MUST respond entirely in ${fullName}.`;
  } else {
    return `You are a professional audio analyst. Please listen carefully to the entire audio content and produce a structured English summary.

Task Goals:
1. Ensure the summary covers dialogues or monologues from beginning to end.
2. Never hallucinate information not present in the audio.
3. The entire response must be in English. Keep proper nouns.

Formatting Rules (Important):
- Headers must use bold and emojis, e.g., "**📝 Summary**", do NOT use "#" markdown headers.
- Do not use markdown tables (| syntax), use bullet points instead.
- Bullet points must be flat (only starting with "-"), do not use sub-numbering (1. 2. 3.) or nested indentation.
- For key points, put key names right after the "-", do not use bolding within bullet items.
- These rules ensure the output displays correctly on GitHub Issues and Telegram.

Please output using the following structure:

**📝 Summary**

**📌 Source**
- Type: Audio

**💡 Core Overview**
(Please write a coherent paragraph outlining the context, key arguments/methods, and final conclusion. Adjust the length based on content depth to capture key details.)

**🔍 Key Highlights**
(Extract the most valuable takeaways. Keep them rich and informative instead of single-sentence bullet points.)
- Point 1: Detailed explanation...

**📊 Key Metrics & Facts**
(If there are metrics, amounts, dates, or percentages, list them here; otherwise omit this section.)
- Item: Value/Date
- Item: Value/Date

**🎯 Actionable Recommendations**
(If the audio outlines recommendations or actionable steps, list them here; otherwise write "No clear actionable recommendations at this time.")
---
You MUST respond entirely in ${fullName}.`;
  }
}

async function resolveAudioInput(rawInput) {
  if (!rawInput) throw new Error("请提供音讯档案路径或 URL。");

  // Try local file first
  let localPath = rawInput;
  if (rawInput.startsWith("file://")) localPath = fileURLToPath(rawInput);
  const resolvedPath = path.resolve(localPath);

  try {
    const fileBuffer = await readFile(resolvedPath);
    const mimeType = getAudioMimeType(resolvedPath);
    return {
      source: "local-file",
      buffer: fileBuffer,
      mimeType,
      localPath: resolvedPath,
      displayName: path.basename(resolvedPath),
    };
  } catch (error) {
    if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") {
      throw new Error(`无法读取音讯档案 "${resolvedPath}"：${error.message}`);
    }
  }

  // Remote URL
  if (isRemoteUrl(rawInput)) {
    console.error(`正在下载音讯：${rawInput}`);
    const response = await fetchWithTimeout(rawInput);
    if (!response.ok)
      throw new Error(`下载失败（HTTP ${response.status}）：${rawInput}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const urlPath = new URL(rawInput).pathname;
    const ext = path.extname(urlPath).toLowerCase();
    return {
      source: "remote-url",
      buffer,
      mimeType: AUDIO_MIME_TYPES[ext] || "audio/mpeg",
      remoteUrl: rawInput,
      displayName: path.basename(urlPath) || "audio.mp3",
    };
  }

  throw new Error(
    `输入既非可读取的本地档案，也非有效的音讯 URL：${rawInput}`
  );
}

async function handleAudio(input, client) {
  const audioInput = await resolveAudioInput(input);

  const dryRunInfo = {
    detectedType: "audio",
    source: audioInput.source,
    mimeType: audioInput.mimeType,
    localPath: audioInput.localPath || null,
    remoteUrl: audioInput.remoteUrl || null,
    bufferBytes: audioInput.buffer.length,
    displayName: audioInput.displayName,
  };

  console.error(`正在分析音讯：${input}`);
  const blob = new Blob([audioInput.buffer], { type: audioInput.mimeType });
  let uploadedFile = await client.files.upload({
    file: blob,
    config: {
      mimeType: audioInput.mimeType,
      displayName: audioInput.displayName,
    },
  });

  while (uploadedFile.state === "PROCESSING") {
    await new Promise((r) => setTimeout(r, 2000));
    uploadedFile = await client.files.get({ name: uploadedFile.name });
  }

  if (uploadedFile.state === "FAILED") {
    throw new Error(`Gemini Files API 处理失败：${uploadedFile.name}`);
  }

  const uploadedFileName = uploadedFile.name;
  console.error(`已上传：${uploadedFileName}`);

  return {
    dryRunInfo,
    model: MODELS.audio,
    contents: [
      {
        role: "user",
        parts: [
          { text: buildAudioPrompt() },
          createMediaPart(uploadedFile.uri, audioInput.mimeType),
        ],
      },
    ],
    cleanup: async () => {
      await client.files.delete({ name: uploadedFileName }).catch(() => {});
    },
  };
}

// ---------------------------------------------------------------------------
// Main Entry
// ---------------------------------------------------------------------------

async function main() {
  const { type: forcedType, input } = parseCliArgs();

  if (!input) {
    printUsage();
    process.exit(1);
  }

  const detectedType = forcedType || detectInputType(input);
  console.error(`侦测到输入类型：${detectedType}`);

  const isDryRun = process.env.SUMMARY_DRY_RUN === "1";

  // For PDF, we need the client before handlePdf (for upload)
  // For URL/Video, we need it only for the interaction
  let client = null;
  if (!isDryRun) {
    const apiKey = ensureApiKey();
    client = new GoogleGenAI({ apiKey });
  }

  let result;
  switch (detectedType) {
    case "url":
      result = await handleUrl(input, client);
      // Auto-fallback: URL returned PDF content-type
      if (result && result.__pdfFallback) {
        console.error("侦测到 PDF Content-Type，自动切换至 PDF 处理器...");
        if (!client) {
          const pdfInput = await resolvePdfBuffer(result.url);
          process.stdout.write(
            `${JSON.stringify(
              {
                detectedType: "pdf",
                source: pdfInput.source,
                mimeType: pdfInput.mimeType,
                localPath: pdfInput.localPath || null,
                remoteUrl: pdfInput.remoteUrl || null,
                bufferBytes: pdfInput.buffer.length,
                displayName: pdfInput.displayName,
              },
              null,
              2
            )}\n`
          );
          return;
        }
        result = await handlePdf(result.url, client);
      }
      break;
    case "pdf":
      if (!client) {
        // dry-run for PDF: still need to resolve buffer but not upload
        const pdfInput = await resolvePdfBuffer(input);
        process.stdout.write(
          `${JSON.stringify(
            {
              detectedType: "pdf",
              source: pdfInput.source,
              mimeType: pdfInput.mimeType,
              localPath: pdfInput.localPath || null,
              remoteUrl: pdfInput.remoteUrl || null,
              bufferBytes: pdfInput.buffer.length,
              displayName: pdfInput.displayName,
            },
            null,
            2
          )}\n`
        );
        return;
      }
      result = await handlePdf(input, client);
      break;
    case "video":
      result = await handleVideo(input);
      break;
    case "audio":
      if (!client) {
        const audioInput = await resolveAudioInput(input);
        process.stdout.write(
          `${JSON.stringify(
            {
              detectedType: "audio",
              source: audioInput.source,
              mimeType: audioInput.mimeType,
              localPath: audioInput.localPath || null,
              remoteUrl: audioInput.remoteUrl || null,
              bufferBytes: audioInput.buffer.length,
              displayName: audioInput.displayName,
            },
            null,
            2
          )}\n`
        );
        return;
      }
      result = await handleAudio(input, client);
      break;
    default:
      throw new Error(`不支援的类型：${detectedType}`);
  }

  // Dry-run: output metadata only
  if (isDryRun) {
    process.stdout.write(`${JSON.stringify(result.dryRunInfo, null, 2)}\n`);
    return;
  }

  // Stream the summary
  console.error("正在请 Gemini 产生摘要...");
  try {
    const stream = await client.models.generateContentStream({
      model: result.model,
      contents: result.contents,
      config: { maxOutputTokens: 65536 },
    });
    await streamContentResponse(stream);
  } finally {
    if (result.cleanup) await result.cleanup();
  }
}

main().catch((error) => {
  console.error(`错误：${error.message || error}`);
  process.exit(1);
});
