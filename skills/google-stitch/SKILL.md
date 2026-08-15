---
name: google-stitch
description: Use this skill when users want to generate UI mockups, landing pages, wireframes, design concepts, marketing sections, or page prototypes from a prompt and need both a design image and matching HTML. Prefer this skill whenever the user asks for「设计图 + HTML」、「UI 原型」、「Landing Page 草稿」、「prompt 生成介面」或 Google Stitch / Stitch with Google style workflows.
---

# Google Stitch 设计生成 Skill

此技能会重用 repo 内已经存在的 `google-stitch` tool bundle，从提示词一次产出：

- 设计图片（写入本地档案）
- 对应 HTML（写入本地档案）
- stdout JSON 结果，方便后续自动化流程接续

## 需求条件

- `GEMINI_API_KEY` 或 `GOOGLE_API_KEY`
- Node.js `>=20.0.0`
- repo 内已存在 `.github/scripts/google-stitch.mjs`

## 使用方式

直接执行 skill 脚本：

```sh
node .agents/skills/google-stitch/scripts/generate.js --prompt "一个现代 SaaS 产品首页，深色主题，含 pricing cards 与 CTA 区块"
```

### 常用范例

```sh
node .agents/skills/google-stitch/scripts/generate.js \
  --prompt "设计一个电商首页 Hero 区块，米白背景、精品感、右侧产品主视觉" \
  --aspect-ratio 16:9 \
  --image-size 2K \
  --output-dir /tmp/stitch-hero
```

```sh
GOOGLE_STITCH_DRY_RUN=1 node .agents/skills/google-stitch/scripts/generate.js \
  --prompt "手机版登入页，极简、白底、蓝色主按钮"
```

## 输出结果

预设会把结果存到 `./google-stitch-output/`：

- `design.html`
- `design.png` 或 `design.jpg`

stdout 会输出 JSON，例如：

```json
{
  "htmlPath": "/abs/path/google-stitch-output/design.html",
  "imagePath": "/abs/path/google-stitch-output/design.png",
  "imageMimeType": "image/png",
  "model": "gemini-3.1-flash-image-preview",
  "prompt": "..."
}
```

## Instructions for the Agent

⚠️ skill 脚本位于 **repo 根目录**。若 cwd 不在 repo root，先独立执行 `git rev-parse --show-toplevel` 取得路径，再 `cd` 到该路径后执行。禁止使用 `$(...)` 语法。

1. 当使用者要从提示词直接生成设计稿、介面草图、Landing Page、区块设计或对应 HTML 时，优先使用此技能。
2. 确认环境中已有 `GEMINI_API_KEY` 或 `GOOGLE_API_KEY`。
3. 执行时加上 `--output-dir artifacts/{issue-comment-id}`，让输出直接进入正确路径：
   ```sh
   node .agents/skills/google-stitch/scripts/generate.js --prompt "<user prompt>" --output-dir artifacts/{issue-comment-id}
   ```
4. 若使用者有指定尺寸、比例、模型，分别加上：
   - `--aspect-ratio`
   - `--image-size`
   - `--model`
   - `--output-dir`
5. 脚本完成后，回报输出的 HTML 与图片路径；若需要，也可读取 HTML 档内容再贴回对话。
6. 若只是先确认参数、路径或流程，不要真的呼叫 API，改用 `GOOGLE_STITCH_DRY_RUN=1`。
7. 若脚本以非零代码结束，回传 stderr 错误，不要捏造设计结果。

## 限制

- 这个 skill 依赖 repo 内的 `google-stitch` tool bundle，因此应在本 repo 内使用。
- HTML 由模型生成，可能需要人工微调。
- 图片与 HTML 的风格一致性取决于 prompt 品质。
- 若模型没有回传 fenced ` ```html ` 区块，HTML 档不会被写出。

## 错误处理

- 缺少 prompt：显示 usage 并结束。
- 缺少 API key：明确提示设定 `GEMINI_API_KEY` 或 `GOOGLE_API_KEY`。
- 模型未回传图片：只输出 HTML 路径（若有）。
- 模型未回传 HTML：只输出图片路径（若有）。

## 参考资料

- 详细参数与流程：[`references/workflow.md`](references/workflow.md)
