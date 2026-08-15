---
name: githubclaw-json-generator
description: 为 GitHubClawToolkit 的 skill 或 template 目录生成 githubclaw.json metadata 档案。当使用者新增、更新 skill/template 并需要建立或更新 githubclaw.json 时触发。也适用于批次为多个 skill/template 产生 githubclaw.json 的情境。不适用于与 GitHubClawToolkit 无关的一般 JSON 生成需求。
---

# GitHubClaw JSON Generator

为 GitHubClawToolkit repo 中的 skill 或 template 目录产生标准化的 `githubclaw.json` metadata 档案，供 GitHubClawCore 统一解析使用。

## 执行流程

### 步骤 1：确认目标目录

确认使用者指定的目标路径。目标必须是 `skills/` 或 `templates/` 下的某个子目录。

- 若使用者未指定，询问要为哪个 skill 或 template 产生 `githubclaw.json`。
- 若使用者要求批次处理，逐一对每个目录执行步骤 2–5。

### 步骤 2：扫描目标目录

读取目标目录中的关键档案以提取资讯：

**Skill 目录优先读取：**
- `SKILL.md`（提取 name、description、required_env）
- `README.md`（提取描述、用途说明）
- `package.json`（提取 version）
- `scripts/` 目录内容（判断功能性质）

**Template 目录优先读取：**
- `AGENTS.md`（提取描述、架构说明）
- `README.md`（提取描述、用途说明）
- `.copilot/config.json`（Copilot 框架设定）
- `.codex/config.toml`（Codex 框架设定）
- `.agents/skills/` 目录内容（判断内含技能）

### 步骤 3：决定各栏位值

参阅 `references/schema.md` 取得完整栏位规格。核心规则：

1. **name**：使用英文，对应目录名称但可加空格（如 `gemini-summary` → `Gemini Summary`）
2. **tagline**：一句繁体中文简介，不超过 50 字
3. **description**：繁体中文详细描述，2-4 句话说明功能与适用情境
4. **category**：根据功能选择合适分类（见 schema.md 中的合法值清单）
5. **tags**：3-6 个相关标签，使用小写英文
6. **version**：优先从 `package.json` 取得，无则预设 `1.0.0`
7. **support_url**：固定为 `https://github.com/jeffsia-blacksmith/altShiftClawToolkit/issues`
8. **homepage**：固定为 `https://github.com/jeffsia-blacksmith/altShiftClawToolkit`
9. **requireEnv**：从 SKILL.md 的 `required_env` 栏位、README 中的环境变数说明、或 scripts 中的 `process.env` 提取

### 步骤 4：生成 JSON

读取 `assets/githubclaw.template.json` 作为结构范本，填入步骤 3 决定的值，将结果写入目标目录的 `githubclaw.json`。

确保 JSON 格式正确：
- 使用 2 空格缩排
- 档案结尾换行
- 无多余逗号

### 步骤 5：验证

执行以下验证：
- JSON 语法正确（可用 `python3 -m json.tool` 验证）
- 所有必填栏位皆存在且非空
- `category` 值在合法清单内
- `tags` 为非空阵列
- `requireEnv` 为阵列（可为空）

若验证失败，修正后重新写入。

## 输出格式范例

```json
{
  "name": "Gemini Summary",
  "tagline": "多格式内容摘要工具，自动辨识输入类型并输出繁体中文摘要",
  "description": "Gemini Summary 可自动侦测输入来源类型（网页、PDF、影片、音讯），透过 Google Gemini API 产生繁体中文摘要。支援多种格式，一键取得精简重点整理。",
  "category": "content",
  "tags": ["summarization", "gemini", "content-analysis", "multilingual"],
  "version": "1.0.0",
  "support_url": "https://github.com/jeffsia-blacksmith/altShiftClawToolkit/issues",
  "homepage": "https://github.com/jeffsia-blacksmith/altShiftClawToolkit",
  "requireEnv": ["GEMINI_API_KEY"]
}
```

## 错误处理

| 状况 | 处理方式 |
|------|---------|
| 目标目录不存在 | 提示使用者确认路径 |
| 目标目录无任何描述档案 | 请使用者提供 name、tagline、description |
| 已存在 `githubclaw.json` | 询问使用者是否要覆盖更新 |
| 无法判断 category | 预设使用 `data`，并提示使用者确认 |
| 无法判断 requireEnv | 预设为空阵列 `[]`，并提示使用者确认 |
