#!/usr/bin/env node
/**
 * Audio Transcriber Tool
 *
 * Uses Gemini Interactions API to transcribe audio into Traditional Chinese.
 * Supports speaker diarization when multiple speakers are detected.
 *
 * Usage:
 *   node scripts/transcribe.js <audio-path-or-url>
 *
 * Required environment variable:
 *   GEMINI_API_KEY — your Gemini API key
 */

import { GoogleGenAI } from "@google/genai";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIME_TYPES = {
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".webm": "audio/webm",
  ".wma": "audio/x-ms-wma",
};

function printUsage() {
  console.error("用法：node scripts/transcribe.js <audio-path-or-url>");
  console.error("");
  console.error("范例：");
  console.error(
    '  node scripts/transcribe.js "https://example.com/audio/meeting.mp3"'
  );
  console.error('  node scripts/transcribe.js "./recordings/meeting.m4a"');
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
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "audio/mpeg";
}

async function resolveAudioInput(rawInput) {
  if (!rawInput) {
    throw new Error("需要提供音讯 URL 或本机档案路径。");
  }

  if (isDataUri(rawInput)) {
    return {
      source: "data-uri",
      uri: rawInput,
      mimeType: rawInput.match(/^data:([^;]+);base64,/)?.[1] || "audio/mpeg",
    };
  }

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
      throw new Error(
        `无法读取本机音讯档案 "${resolvedPath}"：${error.message}`
      );
    }
  }

  if (isRemoteUrl(rawInput)) {
    return {
      source: "remote-url",
      uri: rawInput,
      mimeType: getMimeType(rawInput),
    };
  }

  throw new Error(
    `输入既非可读取的本机档案，也非有效的音讯 URL：${rawInput}`
  );
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
    console.error("错误：需要提供音讯 URL 或本机档案路径。");
    printUsage();
    process.exit(1);
  }

  const audioInput = await resolveAudioInput(rawInput);

  if (process.env.AUDIO_TRANSCRIBER_DRY_RUN === "1") {
    process.stdout.write(
      `${JSON.stringify(
        {
          source: audioInput.source,
          mimeType: audioInput.mimeType,
          localPath: audioInput.localPath || null,
          uriPreview:
            audioInput.source === "local-file" ||
            audioInput.source === "data-uri"
              ? `${audioInput.uri.slice(0, 48)}...`
              : audioInput.uri,
        },
        null,
        2
      )}\n`
    );
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("错误：需要设定 GEMINI_API_KEY 环境变数。");
    console.error("请先设定：export GEMINI_API_KEY=your_api_key");
    process.exit(1);
  }

  const client = new GoogleGenAI({ apiKey });

  console.error(`正在分析音讯：${rawInput}`);
  console.error("请稍候，Gemini 正在处理音讯...\n");

  const stream = await client.models.generateContentStream({
    model: process.env.GEMINI_AUDIO_MODEL || "gemini-3.5-flash",
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
                  "请仔细聆听这段音讯内容，并完成以下任务：",
                  "",
                  "1. 将所有语音内容转录为简体中文逐字稿",
                  "2. 如果音讯中有多位说话者，请用「说话者 A」「说话者 B」等标记区分每位说话者的发言",
                  "3. 保留语意完整，不遗漏重要内容",
                  "4. 如果音讯品质不佳导致某段无法辨识，请用「[无法辨识]」标记",
                  "5. 输出格式为简体中文 Markdown",
                  "",
                  "请直接输出逐字稿内容，不需要额外的前言或说明。",
                  "",
                  `You MUST respond entirely in ${fullName}.`,
                ].join("\n");
              } else {
                return [
                  "Please listen carefully to this audio content and complete the following tasks:",
                  "",
                  "1. Transcribe all spoken content into an English transcript",
                  "2. If there are multiple speakers, distinguish them using labels like 'Speaker A', 'Speaker B', etc.",
                  "3. Keep the meaning intact, do not omit important details",
                  "4. If the audio quality is poor and a segment is unrecognizable, mark it with '[unrecognizable]'",
                  "5. The output format must be English Markdown",
                  "",
                  "Output the transcript content directly, without any introduction or additional explanation.",
                  "",
                  `You MUST respond entirely in ${fullName}.`,
                ].join("\n");
              }
            })(),
          },
          createMediaPart(audioInput.uri, audioInput.mimeType),
        ],
      },
    ],
  });

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

main().catch((err) => {
  console.error(`错误：${err.message || err}`);
  process.exit(1);
});
