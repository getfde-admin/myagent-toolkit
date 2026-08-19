---
name: ppt-creator
description: Use this skill when a user asks for a PowerPoint / PPTX / slide deck / presentation file, e.g. "make me a PPT", "generate slides", "做一份简报", "帮我做PPT", "sediakan slide", "produce a deck from this content", or when the task deliverable should be a .pptx file. Renders Markdown or a JSON slide spec into a real .pptx binary using pptxgenjs (pure JS, no system deps, no API key). Always write the output into `artifacts/{issue-comment-id}/` so the deck is committed to the repo — never claim a .pptx exists without calling this skill.
---

# PPT (PPTX) 產生 Skill

把 Markdown 或 JSON slide spec 渲染成真實的 `.pptx` 二進位檔，使用 `pptxgenjs`（純 JS，無系統依賴、無 API key）。在 GitHub Actions runner（ubuntu-latest, Node ≥ 20）上執行。

## 需求條件

- Node.js ≥ 20.0.0
- `scripts/build.js` 為預建的零依賴 bundle，**不需 `npm install`** 即可直接執行
- 不需要任何環境變數 / API key

## 輸入格式

### Markdown（建議，LLM 最容易產）

- 以單獨一行 `---` 分隔投影片
- `# 標題` → 該張投影片標題（第一張若只有標題、無條列，自動當封面）
- `## 區段名` → 區段章節頁
- `### 副標題` → 封面副標題
- `- ` / `* ` / `+ ` → 條列；縮排 2 空格 = 子條列
- `> 註解` → 該張的備忘稿

範例 `deck.md`：

```markdown
# 第三季產品報告
### 2025 年 10 月

---

## 市場概況

---

# 關鍵指標
- 月活用戶 120 萬
  - 較上季 +18%
- 留存率 64%
> 詳見附錄 A
```

### JSON spec（進階，完整控制）

```json
{ "slides": [
  { "type":"title", "title":"標題", "subtitle":"副標題" },
  { "type":"section", "section":"區段" },
  { "type":"content", "title":"標題", "bullets":["項目1","項目2"], "notes":["備忘"] }
]}
```

## 使用方式

> ⚠️ **路徑安全**：skill 腳本位於 repo 根目錄的 `.pi/skills/` 下。若 cwd 不在 repo root，請先 `git rev-parse --show-toplevel` 取得絕對路徑，再 `cd` 到該路徑後執行。**禁止**在指令中使用 `$(...)` 語法（會被安全過濾器擋下）。

```sh
node .pi/skills/ppt-creator/scripts/build.js <input.md|input.json> [options]
```

### 選項

| 選項 | 說明 | 預設 |
|---|---|---|
| `--out <path.pptx>` | 輸出路徑 | 與輸入同名 `.pptx` |
| `--theme dark\|light` | 配色主題 | `light` |
| `--title <str>` | 簡報中繼標題 | 取自第一張 |
| `--author <str>` | 作者 | `MyAgent` |
| `--layout 16x9\|4x3` | 投影片比例 | `16x9` |

### 範例

```sh
# 基本：產生 deck.pptx
node .pi/skills/ppt-creator/scripts/build.js artifacts/123/deck.md --out artifacts/123/deck.pptx

# 深色主題、4:3
node .pi/skills/ppt-creator/scripts/build.js deck.md --theme dark --layout 4x3

# 從 stdin 讀
cat deck.md | node .pi/skills/ppt-creator/scripts/build.js -
```

腳本會把最終輸出路徑印到 stdout（一行），方便串接。

## 產出規則（重要）

- 產出的 `.pptx` 一律寫進 `artifacts/{issue-comment-id}/`，由 workflow 的 `git add -A` commit 進 repo。
- **禁止**在 `result.md` 寫 `.pptx` 連結卻不呼叫本 skill——那會造成「issue 裡沒檔」。
- 完成後在 `result.md` 附上 `[簡報](https://github.com/{owner}/{repo}/blob/issue-{n}/artifacts/{id}/deck.pptx?raw=true)` 連結。

## 建置

```sh
cd skills/ppt-creator && bun install && bun run build
```

`bun run build` 會把 `src/build.js` bundle 成 `scripts/build.js`（零依賴、minify、target node）。