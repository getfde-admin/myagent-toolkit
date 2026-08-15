---
name: gemini-image-describer
description: Use this skill when a user provides an image (local file or URL) and wants a detailed Simplified Chinese or English description of the image content. Prefer this skill for requests like "describe this image", "what's in this picture", "OCR this screenshot", "识这张图", "描述这张照片", or when extracting text from screenshots or photos.
---

# Image Describer Skill

此技能使用 Gemini Interactions API 的原生图片理解能力，分析图片并产生简体中文（zh-CN）或英文 Markdown 描述，包含图片场景描述、文字识别（OCR）与关键物件列表。支持本地文件路径、远端 URL 与 data URI。

## 需求条件

- `GEMINI_API_KEY` 环境变数必须已设定
- 有效的远端图片 URL、data URI 或可读取的本地图片档案路径
- Node.js >= 20.0.0

## 使用方式

直接执行预建置脚本 — **不需要 `npm install` 或其他额外设定**：

```sh
node .agents/skills/gemini-image-describer/scripts/describe.js <image-path-or-url>
```

### 范例

```sh
GEMINI_API_KEY=your_api_key node .agents/skills/gemini-image-describer/scripts/describe.js "https://example.com/photo.jpg"
```

```sh
GEMINI_API_KEY=your_api_key node .agents/skills/gemini-image-describer/scripts/describe.js "./photos/screenshot.png"
```

```sh
GEMINI_API_KEY=your_api_key node .agents/skills/gemini-image-describer/scripts/describe.js "data:image/png;base64,iVBOR..."
```

## Dry Run

设定 `IMAGE_DESCRIBER_DRY_RUN=1` 可在不呼叫 Gemini API 的情况下，预览解析后的输入 metadata：

```sh
IMAGE_DESCRIBER_DRY_RUN=1 node .agents/skills/gemini-image-describer/scripts/describe.js "https://example.com/photo.jpg"
```

## 输出格式

输出为简体中文或英文 Markdown，包含以下区段：

- **图片描述** — 整体场景与内容描述
- **文字辨识（OCR）** — 图片中可辨识的文字
- **关键物件** — 画面中的关键物件列表

## Instructions for the Agent

⚠️ skill 脚本位于 **repo 根目录**。若 cwd 不在 repo root，先独立执行 `git rev-parse --show-toplevel` 取得路径，再 `cd` 到该路径后执行。禁止使用 `$(...)` 语法。

⚠️ **必须执行脚本**，不可用自身视觉能力直接回答图片内容。所有图片分析结果必须来自脚本输出。

1. 向使用者取得图片 URL 或本地档案路径（若尚未提供）。
2. 确认环境中已设定 `GEMINI_API_KEY`。
3. **必须**执行描述脚本，并将输出直接写入 `artifacts/{issue-comment-id}/result.md`：
   ```sh
   mkdir -p artifacts/{issue-comment-id}
   node .agents/skills/gemini-image-describer/scripts/describe.js "<image-path-or-url>" > artifacts/{issue-comment-id}/result.md
   ```
4. 若输入为本地档案路径或 `file://` URL，脚本会自动转换为 Base64 data URI。
5. 读取 `artifacts/{issue-comment-id}/result.md` 并将内容呈现给使用者。
6. 若脚本以非零代码结束，回报 stderr 错误讯息，不可自行补充图片描述。

## 限制

- 支援的图片格式：JPEG、PNG、GIF、WebP、BMP、SVG
- 本地大型图片档案会转为 Base64，可能消耗较多记忆体
- 远端 URL 必须可被 Gemini API 直接存取
- OCR 准确度取决于图片品质与文字清晰度

## 错误处理

- 若 `GEMINI_API_KEY` 未设定，脚本会以代码 1 结束并印出错误讯息。
- 若图片输入缺失或无效，脚本会以代码 1 结束并印出用法说明。
- 若本地档案无法读取，脚本会以代码 1 结束并回报路径相关错误。
- API 错误会输出到 stderr，程序以代码 1 结束。

## 实作备注

- `scripts/describe.js` 是预建置的零依赖 bundle（由 Bun 从 `src/describe.js` 建置）。
- 模型：`gemini-3-flash-preview`（快速、平衡，适合图片理解）。
- 远端 URL 直接作为 `image` part 的 `uri` 传入。
- 本地档案转换为 Base64 `data:<mime>;base64,...` URI 后传送。
- 设定 `IMAGE_DESCRIBER_DRY_RUN=1` 可预览解析后的输入 metadata，不呼叫 Gemini API。
- 输出以串流方式写入 stdout，即时显示。
- 需要 Node.js >= 20.0.0。

## 从原始码重新建置

若需修改脚本，编辑 `src/describe.js` 后重新建置：

```sh
cd .agents/skills/gemini-image-describer
bun install
bun build src/describe.js --outfile scripts/describe.js --target node --minify
```
