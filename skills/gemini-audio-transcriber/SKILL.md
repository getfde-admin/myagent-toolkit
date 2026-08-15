---
name: gemini-audio-transcriber
description: Use this skill when a user provides an audio file (local file or URL) and wants it transcribed into Simplified Chinese or English text. Prefer this skill for requests like "transcribe this audio", "convert speech to text", "转录这段录音", "语音转文字", or when converting meeting recordings, voice memos, or podcast clips to text. The output can be further processed by meeting-note-formatter for structured meeting notes.
---

# 音频转简中/英文逐字稿 Skill

使用 Gemini Interactions API 的原生音频理解能力，将音频文件转录为简体中文（zh-CN）或英文逐字稿。支持本地文件与远端 URL，当侦测到多位说话者时会自动标记区分。输出的逐字稿可搭配 `meeting-note-formatter` skill 进一步整理为结构化会议纪录。

## 需求条件

- `GEMINI_API_KEY` 环境变数必须设定
- 有效的远端音讯 URL、data URI 或可读取的本机音讯档案
- Node.js >= 20.0.0
- 支援格式：`.mp3`、`.wav`、`.ogg`、`.flac`、`.m4a`、`.aac`、`.webm`、`.wma`

## 使用方式

直接执行预建脚本 — **不需要 `npm install` 或额外设定**：

```sh
node .agents/skills/gemini-audio-transcriber/scripts/transcribe.js <audio-path-or-url>
```

### 范例

远端 URL：

```sh
GEMINI_API_KEY=your_api_key node .agents/skills/gemini-audio-transcriber/scripts/transcribe.js "https://example.com/audio/meeting.mp3"
```

本机档案：

```sh
GEMINI_API_KEY=your_api_key node .agents/skills/gemini-audio-transcriber/scripts/transcribe.js "./recordings/meeting.m4a"
```

搭配 meeting-note-formatter 使用：

```sh
# 先转录音讯
GEMINI_API_KEY=your_api_key node .agents/skills/gemini-audio-transcriber/scripts/transcribe.js "recording.mp3" > transcript.md

# 再用 meeting-note-formatter 整理成会议纪录
```

## Dry Run

设定 `AUDIO_TRANSCRIBER_DRY_RUN=1` 可在不呼叫 Gemini API 的情况下，预览输入解析结果：

```sh
AUDIO_TRANSCRIBER_DRY_RUN=1 node .agents/skills/gemini-audio-transcriber/scripts/transcribe.js "https://example.com/test.mp3"
```

输出范例：

```json
{
  "source": "remote-url",
  "mimeType": "audio/mpeg",
  "localPath": null,
  "uriPreview": "data:audio/mpeg;base64,..."
}
```

## 输出格式

- 输出为简体中文/英文 Markdown 格式的逐字稿
- 多位说话者时使用「说话者 A」「说话者 B」等标记区分
- 无法辨识的片段标记为「[无法辨识]」
- 结果输出至 stdout，进度与错误讯息输出至 stderr

## Instructions for the Agent

⚠️ skill 脚本位于 **repo 根目录**。若 cwd 不在 repo root，先独立执行 `git rev-parse --show-toplevel` 取得路径，再 `cd` 到该路径后执行。禁止使用 `$(...)` 语法。

1. 向使用者取得音讯档案的 URL 或本机路径（如果尚未提供）。
2. 确认环境中已设定 `GEMINI_API_KEY`。
3. 执行转录脚本：
   ```sh
   node .agents/skills/gemini-audio-transcriber/scripts/transcribe.js "<audio-path-or-url>"
   ```
4. 如果输入是本机档案路径或 `file://` URL，脚本会自动转换为 Base64 data URI。
5. 将生成的逐字稿呈现给使用者。
6. 如果使用者需要进一步整理为会议纪录，建议搭配 `meeting-note-formatter` skill 处理转录结果。
7. 如果脚本以非零状态码退出，将错误讯息回报给使用者。

## 限制

- 音讯档案大小受 Gemini API 限制（建议不超过 20MB）
- 远端 URL 下载有 30 秒逾时限制
- 转录品质取决于音讯清晰度与语言
- 主要针对中文语音最佳化，其他语言仍会尝试转录为简体中文/英文

## 错误处理

- 缺少 `GEMINI_API_KEY` 时，脚本以状态码 1 退出并显示错误讯息。
- 缺少音讯输入或格式无效时，脚本以状态码 1 退出并显示用法说明。
- 无法读取本机档案时，脚本以状态码 1 退出并回报路径相关错误。
- 远端 URL 下载逾时或失败时，脚本以状态码 1 退出并回报网路错误。
- API 错误讯息输出至 stderr，程序以状态码 1 退出。

## 重新建置

如需修改脚本，编辑 `src/transcribe.js` 后重新建置：

```sh
cd .agents/skills/gemini-audio-transcriber
bun install
bun build src/transcribe.js --outfile scripts/transcribe.js --target node --minify
```
