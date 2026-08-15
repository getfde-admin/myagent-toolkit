---
name: gemini-lyria-3
description: Use this skill when the user wants to generate music or audio tracks from lyrics or text prompts using Gemini Lyria-3, including AI music composition, audio generation, track creation, and requests like "帮我作一首歌", "生成音乐", "根据这段歌词产生音轨", or "compose a track".
required_env:
  - GEMINI_API_KEY
---

# Gemini Lyria-3 音乐生成 Skill

使用 Google Lyria-3 模型，从歌词或文字提示词生成 AI 音乐音轨，并将结果储存为音讯档案。

## 需求条件

- **GEMINI_API_KEY**：有效的 Google Gemini API 金钥（设为环境变数）
- **Node.js** ≥ 20.0.0
- `scripts/generate-track.js` 为预先建置的零依赖 bundle，不需 `npm install`

## 使用方式

> ⚠️ **路径安全**：skill 脚本位于 **repo 根目录**的 `.agents/skills/` 下。若 cwd 不在 repo root，请先独立执行 `git rev-parse --show-toplevel` 取得绝对路径，再 `cd` 到该路径后执行。**禁止**在指令中使用 `$(...)` 语法（会被 Copilot CLI 安全过滤器挡下）。

脚本透过环境变数接收所有参数：

| 环境变数 | 必填 | 说明 |
|----------|------|------|
| `GEMINI_API_KEY` | ✅ | Google Gemini API 金钥 |
| `PROMPT_FILE` | ✅ | 包含歌词或提示词的文字档路径 |
| `ISSUE_DIR` | ✅ | 音讯档案输出目录 |
| `NAME_PREFIX` | ❌ | 输出档案名称前缀（预设：`track`） |
| `LYRIA_MODEL` 或 `MODEL` | ❌ | 使用的模型（预设：`lyria-3-pro-preview`） |

### 范例

```sh
# 先取得 repo root（独立执行，不使用 $()）
git rev-parse --show-toplevel

# 再 cd 到 repo root 后执行：
PROMPT_FILE="./lyrics.txt" \
ISSUE_DIR="./music-output" \
node .agents/skills/gemini-lyria-3/scripts/generate-track.js
```

## 输出格式

脚本执行后：
- 每个生成的音轨储存为音讯档案（格式依 API 回传的 MIME type 决定，通常为 `.mp3`）
- stdout 输出每个储存的相对路径，格式为 `Saved: <path>`
- stderr 输出进度讯息与错误

成功后请以下列格式回报结果：

```
🎵 音乐生成完成！

- [track-0.mp3](https://github.com/{GITHUB_REPO}/blob/{BRANCH}/{path}?raw=true)

<!-- githubclaw-artifacts: {"audio":[{"branch":"{BRANCH}","path":"{path}"}],"html":[]} -->
```

## Instructions for the Agent

⚠️ skill 脚本位于 **repo 根目录**。若 cwd 不在 repo root，先独立执行 `git rev-parse --show-toplevel` 取得路径，再 `cd` 到该路径后执行。禁止使用 `$(...)` 语法。

1. 确认使用者提供了歌词内容或文字提示词。
2. 将歌词或提示词写入暂时文字档（例如 `./lyrics.txt`）。
3. 设定 `ISSUE_DIR` 为音讯输出目录（在自动化任务中请务必设定为 `artifacts/${COMMENT_ID}`；一般执行可预设为 `./music-output`）。并且务必将最终文字报告写入 `artifacts/${COMMENT_ID}/result.md`。
4. 确认环境中已设定 `GEMINI_API_KEY`。
5. 执行脚本：
   ```sh
   PROMPT_FILE="./lyrics.txt" ISSUE_DIR="artifacts/${COMMENT_ID:-music-output}" node .agents/skills/gemini-lyria-3/scripts/generate-track.js
   ```
6. 解析 stdout 中 `Saved: <path>` 行取得生成的音轨路径。
7. 以 Markdown 连结格式回报每个音轨，加上 `githubclaw-artifacts` metadata 供 Telegram relay 使用。
8. 若 exit code 非 0，检查 stderr 错误讯息，不要自行编造结果。

## 错误处理

| 错误讯息 | 说明 |
|---------|------|
| `缺少 GEMINI_API_KEY` | 未设定 API 金钥环境变数 |
| `缺少 PROMPT_FILE 环境变数` | 未指定歌词/提示词档案路径 |
| `缺少 ISSUE_DIR 环境变数` | 未指定输出目录 |
| `... 内容为空，无法生成音乐` | 歌词/提示词档案为空 |
| `API 未回传任何音讯资料` | API 没有回传音讯，请确认模型与 API Key |