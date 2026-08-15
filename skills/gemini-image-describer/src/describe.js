#!/usr/bin/env node
/**
 * Image Describer Tool
 *
 * Uses Gemini Interactions API to analyze an image and produce
 * a Simplified Chinese (zh-CN) or English Markdown description including:
 * scene description, OCR text recognition, and key objects.
 *
 * Usage:
 *   node scripts/describe.js <image-path-or-url>
 *
 * Required environment variable:
 *   GEMINI_API_KEY — your Gemini API key
 */

import { GoogleGenAI } from "@google/genai";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIME_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
};

function printUsage() {
  console.error("用法：node scripts/describe.js <image-path-or-url>");
  console.error("");
  console.error("范例：");
  console.error(
    '  node scripts/describe.js "https://example.com/photo.jpg"'
  );
  console.error('  node scripts/describe.js "./photos/screenshot.png"');
}

function isDataUri(value) {
  return value.startsWith("data:");
}

function isRemoteUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol !== "file:";
  } catch {
    return false;
  }
}

function getMimeType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "image/png";
}

async function resolveImageInput(rawInput) {
  if (!rawInput) {
    throw new Error("需要提供图片 URL 或本地档案路径。");
  }

  // Data URI — pass through
  if (isDataUri(rawInput)) {
    return {
      source: "data-uri",
      uri: rawInput,
      mimeType: rawInput.match(/^data:([^;]+);base64,/)?.[1] || "image/png",
    };
  }

  // Try local file first
  let localPath = rawInput;

  if (rawInput.startsWith("file://")) {
    localPath = fileURLToPath(rawInput);
  }

  const resolvedPath = path.resolve(localPath);

  try {
    const fileBuffer = await readFile(resolvedPath);
    const mimeType = getMimeType(resolvedPath);

    return {
      source: "local-file",
      uri: `data:${mimeType};base64,${fileBuffer.toString("base64")}`,
      mimeType,
      localPath: resolvedPath,
    };
  } catch (error) {
    if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") {
      throw new Error(`无法读取本地图片档案 "${resolvedPath}": ${error.message}`);
    }
  }

  // Remote URL — verify reachability with 30s timeout
  if (isRemoteUrl(rawInput)) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(rawInput, {
        method: "HEAD",
        signal: controller.signal,
      });
      if (!res.ok) {
        console.error(`警告：远端 URL 回应 HTTP ${res.status}，仍尝试传送给 Gemini。`);
      }
    } catch {
      console.error("警告：无法确认远端 URL 是否可存取，仍尝试传送给 Gemini。");
    } finally {
      clearTimeout(timeout);
    }

    // Detect MIME from URL path, fallback to image/png
    let mimeType = "image/png";
    try {
      const urlPath = new URL(rawInput).pathname;
      mimeType = getMimeType(urlPath);
    } catch {
      // keep default
    }

    return {
      source: "remote-url",
      uri: rawInput,
      mimeType,
    };
  }

  throw new Error(`输入既非可读取的本地档案，也非有效的图片 URL：${rawInput}`);
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

async function main() {
  const rawInput = process.argv[2];
  if (!rawInput) {
    console.error("错误：需要提供图片 URL 或本地档案路径。");
    printUsage();
    process.exit(1);
  }

  const imageInput = await resolveImageInput(rawInput);

  // Dry-run mode
  if (process.env.IMAGE_DESCRIBER_DRY_RUN === "1") {
    process.stdout.write(
      `${JSON.stringify(
        {
          source: imageInput.source,
          mimeType: imageInput.mimeType,
          localPath: imageInput.localPath || null,
          uriPreview:
            imageInput.source === "local-file" || imageInput.source === "data-uri"
              ? `${imageInput.uri.slice(0, 48)}...`
              : imageInput.uri,
        },
        null,
        2
      )}\n`
    );
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error(
      "错误：需要设定 GEMINI_API_KEY 环境变数。"
    );
    console.error(
      "请先设定：export GEMINI_API_KEY=your_api_key"
    );
    process.exit(1);
  }

  const client = new GoogleGenAI({ apiKey });

  console.error(`正在分析图片：${rawInput}`);
  console.error("请稍候，Gemini 正在处理图片...\n");

  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: (() => {
              const code = process.env.CLAW_LANGUAGE || "en";
              const map = {
                "zh-CN": "Simplified Chinese",
                "en": "English"
              };
              const fullName = map[code] || "English";
              if (code === "zh-CN") {
                return [
                  "请仔细观察这张图片，并以简体中文（zh-CN）Markdown 格式提供以下信息：",
                  "",
                  "## 图片描述",
                  "描述图片的整体场景和内容，包括环境、氛围与主要活动。",
                  "",
                  "## 文字辨识（OCR）",
                  "列出图片中出现的所有可辨识文字。若无文字，请说明「图片中未发现文字」。",
                  "",
                  "## 关键物件",
                  "以条列方式列出画面中的关键物件或元素。",
                  "",
                  "请确保输出完整且结构清楚。",
                  "",
                  `You MUST respond entirely in ${fullName}.`,
                ].join("\n");
              } else {
                return [
                  "Please observe this image carefully and provide the following information in English Markdown format:",
                  "",
                  "## Image Description",
                  "Describe the overall scene and content of the image, including environment, atmosphere, and main activities.",
                  "",
                  "## Text Recognition (OCR)",
                  "List all recognizable text appearing in the image. If there is no text, state 'No text found in the image'.",
                  "",
                  "## Key Objects",
                  "List the key objects or elements in the frame as a bulleted list.",
                  "",
                  "Please ensure the output is complete and clearly structured.",
                  "",
                  `You MUST respond entirely in ${fullName}.`,
                ].join("\n");
              }
            })(),
          },
          createMediaPart(imageInput.uri, imageInput.mimeType),
        ],
      },
    ],
  });

  process.stdout.write(response.text ?? "");
  process.stdout.write("\n");
}

main().catch((err) => {
  console.error(`错误：${err.message || err}`);
  process.exit(1);
});
