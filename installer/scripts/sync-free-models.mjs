#!/usr/bin/env node
// sync-free-models.mjs
// ---------------------------------------------------------------------------
// Fetch each provider's model list from its API and update the catalog
// templates (templates/<locale>/githubagent.json and .pi/models.json) so
// active and free models are present and labeled "(free)".
//
// Supported providers:
//   - openrouter            : Auto-fetches live models, badges :free and prompt:0 as "(free)"
//   - google                : Auto-fetches live Gemini models, badges Flash models as "(free)"
//   - cloudflare-workers-ai : Auto-fetches Cloudflare Workers AI models, badges free-tier models
//   - ollama-cloud          : Auto-fetches Ollama models
//   - openai                : Auto-fetches OpenAI models
//   - anthropic             : Auto-fetches Anthropic Claude models
//
// Env vars:
//   GEMINI_API_KEY          to fetch live Google Gemini models
//   OPENROUTER_API_KEY      optional (OpenRouter listing is public)
//   CLOUDFLARE_API_TOKEN    to fetch Cloudflare Workers AI models
//   CLOUDFLARE_ACCOUNT_ID   to fetch Cloudflare Workers AI models
//   OLLAMA_API_KEY          optional (Ollama listing is public)
//   OPENAI_API_KEY          to fetch live OpenAI models
//   ANTHROPIC_API_KEY       to fetch live Anthropic models
//   FREE_GOOGLE_MODELS      comma-separated Gemini model IDs to badge as "(free)"
//   FREE_OLLAMA_MODELS      comma-separated Ollama model IDs to badge as "(free)"
//   FREE_CF_MODELS          comma-separated Cloudflare model IDs to badge as "(free)"
//   MAX_FREE_OR             max number of OpenRouter free models to add (default 30)
//   ADD_MISSING             set to "1" to also add non-free live models missing from the catalog
//   TEMPLATES_DIR           override the templates directory (defaults to ../templates)
// ---------------------------------------------------------------------------

import { readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = process.env.TEMPLATES_DIR
  ? resolve(process.env.TEMPLATES_DIR)
  : join(__dirname, "..", "templates");

const MAX_FREE_OR = Number(process.env.MAX_FREE_OR ?? 30);
const ADD_MISSING = process.env.ADD_MISSING === "1";

const FREE_GOOGLE_MODELS = (process.env.FREE_GOOGLE_MODELS ?? "gemini-3.6-flash,gemini-3.5-flash,gemini-3.1-flash-lite,gemini-3-flash-preview,gemini-2.5-flash,gemini-2.0-flash")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const FREE_OLLAMA_MODELS = (process.env.FREE_OLLAMA_MODELS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const FREE_CF_MODELS = (process.env.FREE_CF_MODELS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const FREE_TAG = "(free)";
const ENTRY_RE = /\{\s*"value"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"label"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/;
const ENTRY_TEST = /\{\s*"value"\s*:\s*"/;

// --- helpers ---------------------------------------------------------------

function norm(s) {
  return String(s ?? "").trim().toLowerCase();
}

function withFreeTag(label) {
  const l = String(label ?? "").trim();
  return l.includes(FREE_TAG) ? l : `${l} ${FREE_TAG}`.trim();
}

function withoutFreeTag(label) {
  return String(label ?? "")
    .replace(/\s*\(free\)\s*/g, " ")
    .trim();
}

async function fetchJson(url, headers = {}) {
  const resp = await fetch(url, { headers });
  if (!resp.ok) throw new Error(`GET ${url} → HTTP ${resp.status}`);
  return resp.json();
}

function relabelLine(line, newLabel) {
  const m = line.match(/("label"\s*:\s*")((?:[^"\\]|\\.)*)(")/);
  if (!m) return line;
  const start = m.index + m[1].length;
  const end = start + m[2].length;
  return line.slice(0, start) + newLabel + line.slice(end);
}

// Non-chat models to exclude even when free (guardrails, embeddings, music, etc.).
const NON_CHAT = /(content-safety|safety-class|embedding|guard|lyria|clip|tts|whisper|s2t|speech|rerank|moderation)/i;

function isChatText(m) {
  const mod = String(m?.architecture?.modality ?? "");
  if (mod && !/->\s*text$/.test(mod)) return false;
  if (NON_CHAT.test(String(m.id ?? m.name ?? ""))) return false;
  return true;
}

// --- provider fetchers -----------------------------------------------------

async function fetchGoogle() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    // Return known curated Google Gemini models when no API key provided
    return [
      { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash", free: true, contextWindow: 1048576, maxTokens: 65536 },
      { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash", free: true, contextWindow: 1048576, maxTokens: 65536 },
      { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash-Lite", free: true, contextWindow: 1048576, maxTokens: 65536 },
      { id: "gemini-3-flash-preview", name: "Gemini 3 Flash (Preview)", free: true, contextWindow: 1048576, maxTokens: 65536 },
      { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro (Preview)", free: false, contextWindow: 1048576, maxTokens: 65536 },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", free: true, contextWindow: 1048576, maxTokens: 65536 },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", free: true, contextWindow: 1048576, maxTokens: 8192 },
    ];
  }
  const data = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
  return (data?.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent") && !NON_CHAT.test(m.name))
    .map((m) => {
      const id = m.name.replace(/^models\//, "");
      const isFlash = id.includes("flash") || id.includes("lite");
      return {
        id,
        name: m.displayName || id,
        free: isFlash,
        contextWindow: m.inputTokenLimit || 1048576,
        maxTokens: m.outputTokenLimit || 65536,
      };
    });
}

async function fetchOpenRouter() {
  const data = await fetchJson("https://openrouter.ai/api/v1/models", {
    ...(process.env.OPENROUTER_API_KEY
      ? { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` }
      : {}),
  });
  return (data?.data ?? [])
    .filter((m) => isChatText(m))
    .map((m) => ({
      id: m.id,
      name: m.name,
      free: String(m.id).endsWith(":free") || m?.pricing?.prompt === "0",
      contextWindow: m.context_length || 131072,
      maxTokens: m.top_provider?.max_completion_tokens || 8192,
    }));
}

async function fetchCloudflare() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !accId) return [];
  const data = await fetchJson(
    `https://api.cloudflare.com/client/v4/accounts/${accId}/ai/models/search?task=Text%20Generation`,
    { Authorization: `Bearer ${token}` }
  );
  return (data?.result ?? []).map((m) => ({
    id: m.name,
    name: m.name.split("/").pop() || m.name,
    free: false,
    contextWindow: m.properties?.max_input_tokens || 32000,
    maxTokens: m.properties?.max_output_tokens || 8192,
  }));
}

async function fetchOllama() {
  const headers = process.env.OLLAMA_API_KEY
    ? { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` }
    : {};
  const data = await fetchJson("https://ollama.com/v1/models", headers);
  return (data?.data ?? []).map((m) => ({
    id: m.id,
    name: m.id,
    free: false,
    contextWindow: 131072,
    maxTokens: 8192,
  }));
}

async function fetchOpenAI() {
  if (!process.env.OPENAI_API_KEY) return [];
  const data = await fetchJson("https://api.openai.com/v1/models", {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  });
  return (data?.data ?? [])
    .filter((m) => (m.id.startsWith("gpt-") || m.id.startsWith("o1") || m.id.startsWith("o3")) && !NON_CHAT.test(m.id))
    .map((m) => ({ id: m.id, name: m.id, free: false, contextWindow: 128000, maxTokens: 16384 }));
}

async function fetchAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) return [];
  const data = await fetchJson("https://api.anthropic.com/v1/models", {
    "x-api-key": process.env.ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
  });
  return (data?.data ?? []).map((m) => ({
    id: m.id,
    name: m.display_name || m.id,
    free: false,
    contextWindow: 200000,
    maxTokens: 16000,
  }));
}

// --- surgical array rewrite ------------------------------------------------

function findModelsArray(text, providerId) {
  const idRe = new RegExp(`"id"\\s*:\\s*"${providerId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`);
  const idMatch = idRe.exec(text);
  if (!idMatch) return null;
  const modelsRe = /"models"\s*:\s*\[/g;
  modelsRe.lastIndex = idMatch.index;
  const m = modelsRe.exec(text);
  if (!m) return null;
  const bracketStart = text.indexOf("[", m.index);
  return bracketStart;
}

function findArrayEnd(text, start) {
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function newEntryLine(entryIndent, labelCol, value, label) {
  const prefix = `${entryIndent}{ "value": "${value}",`;
  let spaces = labelCol - prefix.length;
  if (spaces < 1) spaces = 1;
  return `${prefix}${" ".repeat(spaces)}"label": "${label}" }`;
}

function rewriteProvider(rawText, providerId, liveModels, freeIds, addMissing) {
  const start = findModelsArray(rawText, providerId);
  if (start === null || start < 0) return { text: rawText, changed: false, added: 0, relabeled: 0 };
  const end = findArrayEnd(rawText, start);
  if (end < 0) return { text: rawText, changed: false, added: 0, relabeled: 0 };
  const block = rawText.slice(start, end + 1);
  const lines = block.split("\n");

  let firstEntryIdx = -1, lastEntryIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (ENTRY_TEST.test(l)) {
      if (firstEntryIdx < 0) firstEntryIdx = i;
      lastEntryIdx = i;
    }
  }
  if (firstEntryIdx < 0) return { text: rawText, changed: false, added: 0, relabeled: 0 };

  const entryIndent = lines[firstEntryIdx].match(/^\s*/)[0];
  const firstLabelCol = lines[firstEntryIdx].indexOf('"label"', lines[firstEntryIdx].indexOf('"value"'));

  const seen = new Set();
  const newEntryLines = [];
  let relabeled = 0;

  for (let i = firstEntryIdx; i <= lastEntryIdx; i++) {
    const line = lines[i];
    const m = line.match(ENTRY_RE);
    if (!m) continue;
    const value = m[1];
    const oldLabel = m[2];
    seen.add(norm(value));
    const isFree = freeIds.has(norm(value));
    const wantLabel = isFree ? withFreeTag(oldLabel) : withoutFreeTag(oldLabel);
    if (wantLabel !== oldLabel) {
      newEntryLines.push(relabelLine(line, wantLabel));
      relabeled++;
    } else {
      newEntryLines.push(line);
    }
  }

  let added = 0;
  for (const model of liveModels) {
    const key = norm(model.id);
    if (seen.has(key)) continue;
    if (!model.free && !addMissing) continue;
    if (model.free || addMissing) {
      const label = model.free ? withFreeTag(model.name || model.id) : (model.name || model.id);
      newEntryLines.push(newEntryLine(entryIndent, firstLabelCol, model.id, label));
      seen.add(key);
      added++;
    }
  }

  if (added === 0 && relabeled === 0) {
    return { text: rawText, changed: false, added: 0, relabeled: 0 };
  }

  const cleaned = newEntryLines.map((l) => l.replace(/,\s*$/, ""));
  const withCommas = cleaned.map((l, i) => (i < cleaned.length - 1 ? l + "," : l));

  const head = lines.slice(0, firstEntryIdx);
  const tail = lines.slice(lastEntryIdx + 1);
  const newBlock = [...head, ...withCommas, ...tail].join("\n");

  return {
    text: rawText.slice(0, start) + newBlock + rawText.slice(end + 1),
    changed: true,
    added,
    relabeled,
  };
}

// Update .pi/models.json specs alongside githubagent.json
async function updatePiModelsJson(templateDir, providers) {
  const piFile = join(templateDir, ".pi", "models.json");
  let piContent;
  try {
    piContent = await readFile(piFile, "utf8");
  } catch {
    return false;
  }

  try {
    const data = JSON.parse(piContent);
    if (!data.providers) return false;
    let modified = false;

    for (const { providerId, liveModels } of providers) {
      if (!data.providers[providerId] || liveModels.length === 0) continue;
      const existing = data.providers[providerId].models ?? [];
      const existingMap = new Map(existing.map((m) => [m.id, m]));

      for (const m of liveModels) {
        if (!existingMap.has(m.id)) {
          existing.push({
            id: m.id,
            name: m.name || m.id,
            input: ["text", "image"],
            contextWindow: m.contextWindow || 131072,
            maxTokens: m.maxTokens || 8192,
          });
          modified = true;
        }
      }
      data.providers[providerId].models = existing;
    }

    if (modified) {
      await writeFile(piFile, JSON.stringify(data, null, 2) + "\n", "utf8");
      return true;
    }
  } catch (e) {
    console.warn(`⚠ Could not parse ${piFile}: ${e.message}`);
  }
  return false;
}

async function processTemplate(templateDir, providers) {
  const file = join(templateDir, "githubagent.json");
  let raw;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    return null;
  }
  let text = raw;
  const report = [];

  for (const { providerId, liveModels, freeIds, addMissing } of providers) {
    const r = rewriteProvider(text, providerId, liveModels, freeIds, addMissing);
    if (r.changed) {
      text = r.text;
      report.push(`  ${providerId}: +${r.added} added, ${r.relabeled} relabeled`);
    } else {
      report.push(`  ${providerId}: no change`);
    }
  }

  if (text !== raw) {
    await writeFile(file, text, "utf8");
  }

  const piUpdated = await updatePiModelsJson(templateDir, providers);
  if (piUpdated) {
    report.push(`  .pi/models.json synced with new models`);
  }

  return report;
}

// --- main ------------------------------------------------------------------

async function main() {
  console.log(`Templates dir: ${TEMPLATES_DIR}`);

  const tasks = [
    { providerId: "openrouter", fn: fetchOpenRouter, freeIds: null, addMissing: false },
    { providerId: "google", fn: fetchGoogle, freeIds: new Set(FREE_GOOGLE_MODELS.map(norm)), addMissing: ADD_MISSING },
    { providerId: "cloudflare-workers-ai", fn: fetchCloudflare, freeIds: new Set(FREE_CF_MODELS.map(norm)), addMissing: ADD_MISSING },
    { providerId: "ollama-cloud", fn: fetchOllama, freeIds: new Set(FREE_OLLAMA_MODELS.map(norm)), addMissing: ADD_MISSING },
    { providerId: "openai", fn: fetchOpenAI, freeIds: new Set(), addMissing: ADD_MISSING },
    { providerId: "anthropic", fn: fetchAnthropic, freeIds: new Set(), addMissing: ADD_MISSING },
  ];

  const providers = [];
  for (const t of tasks) {
    let live = [];
    try {
      live = await t.fn();
      if (live.length > 0) {
        console.log(`Fetched ${t.providerId}: ${live.length} models (${live.filter((m) => m.free).length} free)`);
      }
    } catch (e) {
      console.warn(`⚠ ${t.providerId}: ${e.message} — live fetch skipped`);
    }
    const freeIds = t.freeIds ?? new Set(live.filter((m) => m.free).map((m) => norm(m.id)));
    let liveForCatalog = live;
    if (t.providerId === "openrouter" && live.filter((m) => m.free).length > MAX_FREE_OR) {
      liveForCatalog = [
        ...live.filter((m) => !m.free),
        ...live.filter((m) => m.free).slice(0, MAX_FREE_OR),
      ];
    }
    providers.push({ providerId: t.providerId, liveModels: liveForCatalog, freeIds, addMissing: t.addMissing });
  }

  const entries = await readdir(TEMPLATES_DIR, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    console.log(`\n=== template: ${ent.name} ===`);
    const report = await processTemplate(join(TEMPLATES_DIR, ent.name), providers);
    if (report) report.forEach((line) => console.log(line));
    else console.log("  (no githubagent.json)");
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
