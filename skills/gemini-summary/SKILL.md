---
name: gemini-summary
description: Use this skill when a user provides a web page URL, PDF file, video, or audio file and wants a Simplified Chinese or English summary. Prefer this skill for requests like "summarize this URL", "summarize this PDF", "summarize this video", "summarize this audio", "帮我摘要", "这篇文章重点是什么", "帮我总结这段视频", "帮我摘要这段音频", or when analyzing articles, documents, presentations, YouTube videos, audio recordings, or any content that needs a zh-CN or en summary. Automatically detects input type (web page, PDF, video, audio) — no manual type selection needed.
---

# 内容摘要 Skill

统一的摘要工具，自动侦测输入类型（网页 / PDF / 视频 / 音频），使用 Gemini Interactions API 产出结构化的简体中文（zh-CN）或英文 Markdown 摘要。

## 需求条件

- **GEMINI_API_KEY**：有效的 Google Gemini API 金钥（设为环境变数）
- **Node.js** ≥ 20.0.0
- `scripts/summarize.js` 为预先建置的零依赖 bundle，不需 `npm install`

## 支援的输入类型

| 类型 | 输入格式 | 使用模型 |
|------|----------|----------|
| 网页 | `https://example.com/article` | gemini-3-pro-preview |
| PDF | 本地 `./report.pdf` 或远端 URL | gemini-3-pro-preview |
| 视频 | YouTube URL、视频 URL、本地视频档、data URI | gemini-3.1-pro-preview |
| 音频 | 本地音频档或远端 URL | gemini-3-pro-preview |

### 自动侦测逻辑

- `data:` 开头 → 视频
- HTTP/HTTPS URL：`.pdf` → PDF；视频副档名或 YouTube 域名 → 视频；音频副档名 → 音频；其他 → 网页
- 本地档案：`.pdf` → PDF；视频副档名 → 视频；音频副档名 → 音频
- 支援的视频格式：`.mp4`, `.mkv`, `.webm`, `.mov`, `.avi`, `.3gp`, `.m4v`, `.mpeg`, `.mpg`, `.ogv`
- 支援的音频格式：`.mp3`, `.wav`, `.aac`, `.ogg`, `.flac`, `.m4a`, `.aiff`, `.wma`, `.opus`

## 使用方式

直接执行预建好的脚本，不需要先安装依赖：

> ⚠️ **路径安全**：skill 脚本位于 **repo 根目录**的 `.agents/skills/` 下。若 cwd 不在 repo root，请先执行 `git rev-parse --show-toplevel` 取得绝对路径，再 `cd` 到该路径后执行。**禁止**在指令中使用 `$(...)` 语法（会被 Copilot CLI 安全过滤器挡下）。

```sh
node .agents/skills/gemini-summary/scripts/summarize.js <input>
```

### 范例

```sh
# 网页摘要
node .agents/skills/gemini-summary/scripts/summarize.js "https://example.com/posts/agentic-workflows"

# PDF 摘要（本地档案）
node .agents/skills/gemini-summary/scripts/summarize.js "./reports/quarterly.pdf"

# PDF 摘要（远端 URL）
node .agents/skills/gemini-summary/scripts/summarize.js "https://example.com/report.pdf"

# 视频摘要（YouTube）
node .agents/skills/gemini-summary/scripts/summarize.js "https://youtu.be/abc123"

# 视频摘要（本地档案）
node .agents/skills/gemini-summary/scripts/summarize.js "./clips/demo.mp4"

# 音频摘要（本地档案）
node .agents/skills/gemini-summary/scripts/summarize.js "./recordings/meeting.mp3"

# 音频摘要（远端 URL）
node .agents/skills/gemini-summary/scripts/summarize.js "https://example.com/podcast.mp3"
```

### 手动指定类型

自动侦测通常足够，但可用 `--type` 覆盖：

```sh
node .agents/skills/gemini-summary/scripts/summarize.js --type pdf "https://example.com/download?file=report"
node .agents/skills/gemini-summary/scripts/summarize.js --type audio "https://example.com/download?file=recording"
```

### Dry Run

设定 `SUMMARY_DRY_RUN=1` 可在不呼叫 Gemini API 的情况下，预览输入侦测结果（JSON 格式）：

```sh
SUMMARY_DRY_RUN=1 node .agents/skills/gemini-summary/scripts/summarize.js "https://youtu.be/abc123"
```

## 输出格式

输出为简体中文或英文 Markdown，包含以下区段：

```markdown
**📝 内容摘要**

**📌 来源**
- 类型：网页 / PDF文件 / 视频 / 音频
- 标题：{title}
- 网址：{url}

**💡 核心概述**
{请以流畅的段落整理脉络，包含：主题背景、关键论点与结论}

**🔍 重点条列**
- {重点 1：包含具体的细节、范例或解释}
- {重点 2：包含具体的细节、范例或解释}
- ...

**📊 关键数据与事实**
（如有关键数字、金额、日期或事实才以条列呈现，若无则省略）
- 项目：数值/日期/事实

**🎯 行动建议**
{具体建议或「目前无明确行动建议」}
```

## Instructions for the Agent

⚠️ skill 脚本位于 **repo 根目录**。若 cwd 不在 repo root，先独立执行 `git rev-parse --show-toplevel` 取得路径，再 `cd` 到该路径后执行。禁止使用 `$(...)` 语法。

1. 确认使用者提供了 URL、PDF 档案路径、视频来源、或音频档案。
2. 确认环境中已设定 `GEMINI_API_KEY`。
3. 执行指令：
   ```sh
   node .agents/skills/gemini-summary/scripts/summarize.js "<input>"
   ```
4. 脚本会自动侦测输入类型并选择适当的处理方式与模型。
5. 结果以串流方式输出到 stdout，进度与错误讯息输出到 stderr。
6. 输出中若包含连结，必须使用 Markdown 格式 `[文字](URL)`，不可使用 HTML `<a>` 标签。
7. 如果 exit code 为 1，表示发生错误，请检查 stderr 的错误讯息，不要自行编造摘要。
8. 可先用 `SUMMARY_DRY_RUN=1` 测试输入侦测是否正确。
9. 如果自动侦测不符预期，可用 `--type url|pdf|video|audio` 手动指定。

## 限制

### 网页
- 只支援单一网址
- 不支援登入页或高度依赖前端渲染的页面
- 正文长度截断至 120K 字元

### PDF
- 过大的 PDF（超过数十 MB）可能无法处理
- 扫描式 PDF 品质可能较低，建议使用有文字图层的 PDF
- 无法处理加密 PDF

### 视频
- 远端 URL 有 30 秒逾时限制
- 本地档案会转为 Base64 data URI，过大的档案可能超出记忆体限制

### 音频
- 远端 URL 有 30 秒逾时限制
- 过大的音频档案可能超出 Gemini Files API 限制
- 支援格式：`.mp3`, `.wav`, `.aac`, `.ogg`, `.flac`, `.m4a`, `.aiff`, `.wma`, `.opus`

## 错误处理

| 错误讯息 | 说明 |
|---------|------|
| `缺少 GEMINI_API_KEY` | 未设定 API 金钥环境变数 |
| `无法辨识输入类型` | 输入不是支援的 URL、PDF 或视频格式 |
| `fetch failed` | 网页抓取失败（网路或状态码问题） |
| `无法读取档案` | 本地档案无法存取 |
| `下载失败（HTTP xxx）` | 远端 URL 回传非 200 状态码 |
| `抓取逾时（30 秒）` | 远端资源下载超过 30 秒 |

## 重建方式

`scripts/summarize.js` 是已提交的预建可执行产物；`src/summarize.js` 是可维护的原始码。重建方式：

```sh
cd .agents/skills/gemini-summary
bun install
bun run build
```
