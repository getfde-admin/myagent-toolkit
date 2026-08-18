---
name: pdf-creator
description: Use this skill when a user asks for a PDF / PDF file / document / report / 报告 / 文档 / 生成PDF / "make me a PDF" / "generate a PDF report", or when the task deliverable should be a .pdf file. Renders Markdown or a JSON spec into a real .pdf binary using pdfkit (pure JS, no system deps, no API key). Always write the output into `artifacts/{issue-comment-id}/` so the file is committed to the repo — never claim a .pdf exists without calling this skill.
---

# PDF 產生 Skill

把 Markdown 或 JSON spec 渲染成真實的 `.pdf` 二進位檔，使用 `pdfkit`（純 JS，無系統依賴、無 API key）。在 GitHub Actions runner（ubuntu-latest, Node ≥ 20）上執行。

## 需求條件

- Node.js ≥ 20.0.0
- `scripts/build.js` 為預建的零依賴 bundle，**不需 `npm install`** 即可直接執行
- 不需要任何環境變數 / API key
- 內建 GB2312 子集字型（`assets/NotoSansCJK-subset.ttf`，約 6MB），**簡體中文 + 英文開箱即用**；繁體/生僻字可能缺字（可用 `--font` 指定完整字型）

## 輸入格式

### Markdown（建議，LLM 最容易產）

- `# 標題` → 大標題（置中）
- `## 區段` → 區段標題
- `### 副標題` → 小標題
- `- ` / `* ` / `+ ` → 條列（縮排 2 空格 = 子條列）
- `> 註解` → 引用
- `| a | b |` → 表格（第一列為表頭）
- ` ``` ` 程式碼區塊 → 等寬字型灰底
- 單獨一行 `---` → 分頁

範例 `report.md`：

```markdown
# 第三季營運報告
### 2025 年 10 月

## 摘要
- 月活用戶 120 萬，較上季 +18%
- 留存率 64%

## 明細
| 指標 | 數值 |
| --- | --- |
| 營收 | 3.2M |
| 成本 | 1.1M |
```

### JSON spec（進階，完整控制）

```json
{ "title": "報告", "pages": [
  { "blocks": [
    { "type": "heading", "level": 2, "text": "摘要" },
    { "type": "paragraph", "text": "一段文字" },
    { "type": "bullets", "items": ["項目1", "項目2"] },
    { "type": "table", "headers": ["a","b"], "rows": [["1","2"]] }
  ]}
]}
```

## 使用方式

> ⚠️ **路徑安全**：skill 腳本位於 repo 根目錄的 `.agents/skills/` 下。若 cwd 不在 repo root，請先 `git rev-parse --show-toplevel` 取得絕對路徑，再 `cd` 到該路徑後執行。**禁止**在指令中使用 `$(...)` 語法（會被安全過濾器擋下）。

```sh
node .agents/skills/pdf-creator/scripts/build.js <input.md|input.json> [options]
```

### 選項

| 選項 | 說明 | 預設 |
|---|---|---|
| `--out <path.pdf>` | 輸出路徑 | 與輸入同名 `.pdf` |
| `--title <str>` | PDF 中繼標題 | `Document` |
| `--author <str>` | 作者 | `MyAgent` |
| `--font <path>` | 指定 CJK 字型檔（.ttf/.otf） | 內建 GB2312 子集字型 |

### 範例

```sh
# 基本：產生 report.pdf
node .agents/skills/pdf-creator/scripts/build.js artifacts/123/report.md --out artifacts/123/report.pdf

# 從 stdin 讀
cat report.md | node .agents/skills/pdf-creator/scripts/build.js -

# 指定字型
node .agents/skills/pdf-creator/scripts/build.js report.md --font /usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc
```

腳本會把最終輸出路徑印到 stdout（一行），方便串接。

## 產出規則（重要）

- 產出的 `.pdf` 一律寫進 `artifacts/{issue-comment-id}/`，由 workflow 的 `git add -A` commit 進 repo。
- **禁止**在 `result.md` 寫 `.pdf` 連結卻不呼叫本 skill——那會造成「issue 裡沒檔」。
- 完成後在 `result.md` 附上 `[報告](https://github.com/{owner}/{repo}/blob/issue-{n}/artifacts/{id}/report.pdf?raw=true)` 連結。

## 建置

```sh
cd skills/pdf-creator && bun install && bun run build
```

`bun run build` 會把 `src/build.js` bundle 成 `scripts/build.js`（零依賴、minify、target node）。
