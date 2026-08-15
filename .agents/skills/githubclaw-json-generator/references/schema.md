# githubclaw.json Schema 规格

本文件定义 `githubclaw.json` 的完整栏位规格，供 agent 在产生档案时参照。

---

## 完整结构

```json
{
  "name": "string",
  "tagline": "string",
  "description": "string",
  "category": "string",
  "tags": ["string"],
  "version": "string",
  "support_url": "string",
  "homepage": "string",
  "requireEnv": ["string"]
}
```

---

## 栏位详细规格

### name（必填）

- **类型**：string
- **说明**：显示名称，使用英文，与目录名对应但可加空格与大写
- **规则**：
  - 将目录名的 `-` 转为空格，每个单字首字母大写
  - 例：`gemini-summary` → `Gemini Summary`
  - 例：`felo-x-search` → `Felo X Search`
  - 例：`copilot-gemini-api` → `Copilot Gemini API`

### tagline（必填）

- **类型**：string
- **语言**：繁体中文
- **说明**：一句话简介，不超过 50 字
- **范例**：`"多格式内容摘要工具，自动辨识输入类型并输出繁体中文摘要"`

### description（必填）

- **类型**：string
- **语言**：繁体中文
- **说明**：详细描述，2-4 句话，说明功能、技术、适用情境
- **范例**：`"Gemini Summary 可自动侦测输入来源类型（网页、PDF、影片、音讯），透过 Google Gemini API 产生繁体中文摘要。支援多种格式，一键取得精简重点整理。"`

### category（必填）

- **类型**：string
- **说明**：分类标签，必须为以下合法值之一

| 值 | 说明 | 适用情境 |
|----|------|---------|
| `data` | 资料搜寻与撷取 | 搜寻引擎、爬虫、资料提取 |
| `content` | 内容生成与分析 | 摘要、翻译、图片生成、简报 |
| `integration` | 第三方服务整合 | Telegram、LINE、Slack 通知 |
| `automation` | 自动化与工作流程 | 浏览器自动化、CI/CD |
| `meta` | 技能管理与辅助 | 技能搜寻、技能建立工具 |
| `starter` | 入门/空白范本 | 最小设定的起步范本 |
| `framework` | 框架整合范本 | 预设整合多项技能的完整范本 |

### tags（必填）

- **类型**：string[]
- **说明**：3-6 个相关标签
- **规则**：
  - 使用小写英文
  - 使用 `-` 连接多词标签（如 `content-analysis`）
  - 包含核心技术（如 `gemini`、`felo`）
  - 包含功能类型（如 `search`、`summarization`）

### version（必填）

- **类型**：string
- **说明**：语意化版本号（SemVer）
- **规则**：
  - 优先从 `package.json` 的 `version` 栏位取得
  - 无 `package.json` 时预设为 `1.0.0`
  - 格式：`MAJOR.MINOR.PATCH`

### support_url（必填）

- **类型**：string
- **固定值**：`https://github.com/jeffsia-blacksmith/altShiftClawToolkit/issues`

### homepage（必填）

- **类型**：string
- **固定值**：`https://github.com/jeffsia-blacksmith/altShiftClawToolkit`

### requireEnv（必填）

- **类型**：string[]
- **说明**：该 skill/template 所需的环境变数名称
- **规则**：
  - 无需环境变数时使用空阵列 `[]`
  - 环境变数名称使用全大写、底线分隔（如 `GEMINI_API_KEY`）
  - 提取来源优先顺序：
    1. SKILL.md 的 `required_env` frontmatter 栏位
    2. README.md 中明确提及的环境变数
    3. scripts 中 `process.env.XXX` 或 `$XXX` 的用法
    4. .codex/config.toml 或 .copilot/config.json 中的环境变数设定

---

## 常见 requireEnv 对照表

| 环境变数 | 用途 | 常见于 |
|---------|------|--------|
| `GEMINI_API_KEY` | Google Gemini API 金钥 | gemini-* 系列 skill/template |
| `FELO_API_KEY` | Felo Open API 金钥 | felo-* 系列 skill/template |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot 令牌 | telegram-notify |
| `TELEGRAM_CHAT_ID` | Telegram 聊天室 ID | telegram-notify |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Channel 存取令牌 | line-bot template |
| `LINE_CHANNEL_SECRET` | LINE Channel 密钥 | line-bot template |

---

## 验证规则

产生 `githubclaw.json` 后，确认以下条件：

1. JSON 语法正确（无多余逗号、括号配对正确）
2. 所有 9 个栏位皆存在
3. 无额外栏位（严格遵循 schema）
4. `category` 值在合法值清单内
5. `tags` 为非空字串阵列（至少 3 个）
6. `requireEnv` 为字串阵列（可为空）
7. `version` 符合 SemVer 格式
8. `support_url` 与 `homepage` 为固定值
9. `tagline` 与 `description` 为繁体中文
10. 使用 2 空格缩排，档案结尾有换行
