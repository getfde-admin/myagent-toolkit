# google-stitch skill workflow

这个 skill 是 repo 内 `google-stitch` tool 的薄包装，目的是让 agent 能直接用 `.agents/skills` 的方式产生设计图与 HTML，而不必重新实作 Gemini 呼叫。

## 实作来源

- runtime wrapper：`.agents/skills/google-stitch/scripts/generate.js`
- underlying tool bundle：`.github/scripts/tools/google-stitch.mjs`

## 执行流程

1. 解析 CLI 参数
2. 组出 tool request：
   - `prompt`
   - `aspectRatio`
   - `imageSize`
   - `model`
3. 从环境读取：
   - `GEMINI_API_KEY`
   - 或 `GOOGLE_API_KEY`
4. 呼叫 `tool.handler(request, { secrets: { apiKey } })`
5. 将结果写成档案：
   - HTML → `design.html`
   - 图片 → `design.png` / `design.jpg` / `design.webp`
6. 回传 stdout JSON，方便 agent 继续使用

## CLI flags

| flag | 说明 |
| --- | --- |
| `--prompt` | 必填，设计提示词 |
| `--aspect-ratio` | 图片比例 |
| `--image-size` | 解析度：`512` / `1K` / `2K` / `4K` |
| `--model` | `gemini-3.1-flash-image-preview` 或 `gemini-3-pro-image-preview` |
| `--output-dir` | 预设输出目录 |
| `--html-out` | HTML 档完整路径 |
| `--image-out` | 图片档完整路径 |

## Dry run

设定：

```sh
GOOGLE_STITCH_DRY_RUN=1
```

会只输出解析后的 request 与输出路径，不会真的呼叫 Gemini API。

## 输出行为

- 若模型只回传图片，脚本只会写出 `imagePath`
- 若模型只回传 HTML，脚本只会写出 `htmlPath`
- 若两者都有，两个档案都会建立

## 注意事项

- 这个 wrapper 依赖已提交的 tool bundle，因此在本 repo 中可零安装使用。
- 若未来 `tools/src/google-stitch` 的 contract 改变，这里要同步更新。
