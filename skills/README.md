# Skills

This directory contains Agent Skills for myAgentToolkit. Each skill has an independent `SKILL.md`, `githubagent.json`, and `scripts/` execution scripts.

## Skills Overview

| Skill | Description | Required Key |
|---|---|---|
| [`hello-world`](hello-world/) | Example reference skill for verifying the skill installation flow | — |
| [`agent-browser`](agent-browser/) | Browser automation: interact with web pages, fill forms, take screenshots | — |
| [`find-skills`](find-skills/) | Discover and recommend the best skill combinations for tasks | — |
| [`gemini-audio-transcriber`](gemini-audio-transcriber/) | Audio transcription with speaker diarization | `GEMINI_API_KEY` |
| [`gemini-deep-researcher`](gemini-deep-researcher/) | In-depth research reports with source citations | `GEMINI_API_KEY` |
| [`gemini-image-describer`](gemini-image-describer/) | Image scene description and OCR recognition | `GEMINI_API_KEY` |
| [`gemini-lyria-3`](gemini-lyria-3/) | AI music and audio generation | `GEMINI_API_KEY` |
| [`gemini-nanobanana`](gemini-nanobanana/) | AI image generation, editing, and composition | `GEMINI_API_KEY` |
| [`gemini-summary`](gemini-summary/) | Summarize web pages, PDFs, videos, and audio | `GEMINI_API_KEY` |
| [`google-stitch`](google-stitch/) | Generate UI mockups and HTML code from prompts | `GEMINI_API_KEY` |
| [`ppt-creator`](ppt-creator/) | Render Markdown / JSON slide specs into real `.pptx` files | — |
| [`skill-creator`](skill-creator/) | Create, test, evaluate, and optimize new skills | — |
| [`telegram-notify`](telegram-notify/) | Send Telegram notification messages | `TELEGRAM_NOTIFY_BOT_TOKEN` |
