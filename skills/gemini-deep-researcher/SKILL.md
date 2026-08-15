---
name: gemini-deep-researcher
description: Use this skill when a user wants a comprehensive research report on any topic with cited sources in Simplified Chinese or English. Prefer this skill for requests like "research this topic", "give me a deep analysis of", "帮我研究", "深度分析", or when the user needs a well-sourced report for decision-making, presentations, or learning. This skill uses Gemini's Deep Research agent and takes several minutes to complete.
---

# Deep Researcher — 深度研究报告工具

使用 Gemini Deep Research agent 针对任意主题产出结构完整、附引用来源的简体中文（zh-CN）或英文研究报告。这是唯一使用 `agent`（而非 `model`）并以 `background: true` 搭配轮询模式运作的 skill。

## 需求条件

- Node.js ≥ 20
- 环境变数 `GEMINI_API_KEY` 或 `GOOGLE_API_KEY`
- 已执行 `bun install && bun run build`（产生 `scripts/research.js`）

## 使用方式

### 命令列引数

```bash
node .agents/skills/gemini-deep-researcher/scripts/research.js "AI 晶片市场趋势"
```

### 管线输入

```bash
echo "量子运算对密码学的影响" | node .agents/skills/gemini-deep-researcher/scripts/research.js
```

### 在其他脚本中使用

```bash
TOPIC="台湾半导体产业供应链分析"
node .agents/skills/gemini-deep-researcher/scripts/research.js "$TOPIC" > report.md
```

## Dry Run

设定 `DEEP_RESEARCHER_DRY_RUN=1` 可在不呼叫 API 的情况下预览将送出的请求：

```bash
DEEP_RESEARCHER_DRY_RUN=1 node .agents/skills/gemini-deep-researcher/scripts/research.js "测试主题"
```

输出为 JSON，包含 `agent`、`background`、`prompt`、`topic` 栏位。

## 输出格式

stdout 输出为 Markdown 格式的研究报告，包含：

1. **摘要** — 200 字以内
2. **背景** — 主题脉络与重要性
3. **主要发现** — 至少 3 项关键资讯
4. **分析** — 深入分析与比较
5. **结论与建议** — 可行建议
6. **参考来源** — 附连结的引用清单

stderr 输出进度讯息（启动、轮询进度、完成）。

## Instructions for the Agent

⚠️ skill 脚本位于 **repo 根目录**。若 cwd 不在 repo root，先独立执行 `git rev-parse --show-toplevel` 取得路径，再 `cd` 到该路径后执行。禁止使用 `$(...)` 语法。

1. 确认使用者提供了研究主题（文字）。
2. 执行 `node .agents/skills/gemini-deep-researcher/scripts/research.js "<主题>"` 并将 stdout 导向档案或直接呈现。
3. **注意：此技能使用 Gemini Deep Research agent，通常需要 2–8 分钟才能完成。** 请提前告知使用者需要等待。
4. 进度讯息会输出到 stderr，可据此回报等待状态。
5. 完成后，stdout 的内容即为完整研究报告（Markdown 格式）。
6. 若需要先测试，可用 `DEEP_RESEARCHER_DRY_RUN=1` 执行确认参数正确。
7. 将报告存为 `.md` 档案或直接呈现给使用者。

## 限制

- **执行时间长**：Deep Research agent 通常需要 2–8 分钟，最长等待 10 分钟后逾时。
- **背景处理**：使用 `background: true` 启动后以轮询方式取得结果，非即时串流。
- **API 配额**：受 Gemini API 配额限制，频繁呼叫可能触发速率限制。
- **语言**：报告固定输出简体中文/英文（zh-CN/en）。

## 错误处理

| 情境 | 行为 |
|------|------|
| 未提供主题 | stderr 显示用法说明，exit code 1 |
| 未设定 API key | stderr 显示错误讯息，exit code 1 |
| 研究任务失败 | stderr 显示失败原因，exit code 1 |
| 超过 10 分钟 | stderr 显示逾时错误，exit code 1 |
| Dry-run 模式 | stdout 输出 JSON 预览，不呼叫 API |
