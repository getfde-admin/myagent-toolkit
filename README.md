# myAgentToolkit

`myAgentToolkit` is a repository of agent skills, system templates, and GitHub Actions designed for AI agents (powered by Google Gemini API and the `@google/genai` SDK).

## Toolkit Architecture

- **`skills/`**: Standalone Agent Skills containing `SKILL.md`, `githubagent.json`, and executable scripts. All Gemini skills follow the current `@google/genai` SDK standards and REST API specs.
- **`actions/`**: Composite GitHub Actions and reusable workflow components.
- **`installer/`**: Multi-language configuration templates (`default`, `en`, `ms`, `zh-CN`) for deploying agent workflows.

---

## Agent Skills Summary

| Skill | Category | Description | Model / Standard | Required Credentials |
|---|---|---|---|---|
| [`agent-browser`](skills/agent-browser/) | Browser | Automated web interaction, form filling, and screenshots | Playwright / Puppeteer | — |
| [`find-skills`](skills/find-skills/) | Discovery | Find and recommend optimal skill combinations for tasks | CLI Utility | — |
| [`gemini-audio-transcriber`](skills/gemini-audio-transcriber/) | Audio | Audio transcription & speaker diarization | `gemini-3.5-flash` | `GEMINI_API_KEY` |
| [`gemini-deep-researcher`](skills/gemini-deep-researcher/) | Research | Multi-step research reports with source citations | `deep-research-pro-preview-12-2025` *(Interactions API)* | `GEMINI_API_KEY` |
| [`gemini-image-describer`](skills/gemini-image-describer/) | Vision | Scene description, key objects & OCR recognition | `gemini-3.5-flash` | `GEMINI_API_KEY` |
| [`gemini-lyria-3`](skills/gemini-lyria-3/) | Music | AI music track generation | `lyria-3-pro-preview` *(REST API)* | `GEMINI_API_KEY` |
| [`gemini-nanobanana`](skills/gemini-nanobanana/) | Image | AI image generation, editing, and Search grounding | `gemini-3.1-flash-image-preview` | `GEMINI_API_KEY` |
| [`gemini-summary`](skills/gemini-summary/) | Multimodal | Summarize web pages, PDFs, videos, and audio | `gemini-3.5-flash` | `GEMINI_API_KEY` |
| [`google-stitch`](skills/google-stitch/) | UI Design | Generate UI mockups and HTML code from prompts | `gemini-3.1-flash-image-preview` | `GEMINI_API_KEY` |
| [`pdf-creator`](skills/pdf-creator/) | Document | Render Markdown into PDF documents | `pdfkit` / `md2pdf` | — |
| [`ppt-creator`](skills/ppt-creator/) | Document | Render Markdown / JSON slide specs into `.pptx` files | `pptxgenjs` | — |
| [`skill-creator`](skills/skill-creator/) | Meta | Create, test, evaluate, and optimize new skills | Meta-Skill Tool | — |
| [`telegram-notify`](skills/telegram-notify/) | Messaging | Send Telegram notification messages | Telegram Bot API | `TELEGRAM_NOTIFY_BOT_TOKEN` |

---

## API & Format Compliance Status

All Gemini skills in this toolkit are validated against current Google Gemini specifications:

- **Official SDK (`@google/genai` v2.x)**: Used by `gemini-audio-transcriber`, `gemini-image-describer`, `gemini-summary`, and `google-stitch`.
- **Interactions API (`client.interactions`)**: Used by `gemini-deep-researcher` for asynchronous background agent execution and status polling.
- **Direct REST API (`v1beta`)**: Zero-dependency HTTP POST integrations used by `gemini-lyria-3` and `gemini-nanobanana` for audio and image generation.
