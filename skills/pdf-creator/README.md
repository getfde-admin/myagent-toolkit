# pdf-creator — PDF Creator Skill

Renders a Markdown document or a JSON spec into a real `.pdf` binary using [pdfkit](https://github.com/foliojs/pdfkit) (pure JavaScript — no system dependencies, no API key).

## Why this skill exists

LLM agents can reliably write text but not binary files. This skill turns the agent's text output into a guaranteed-real `.pdf` file on disk, so the workflow's `git add -A` commits a real document into `artifacts/` — no more "claimed a PDF but the repo has no file".

## Quick start

```sh
# from repo root
node .pi/skills/pdf-creator/scripts/build.js report.md --out artifacts/123/report.pdf
```

See `SKILL.md` for the full Markdown / JSON input format, options, and path-safety rules.

## Build

```sh
cd skills/pdf-creator
bun install
bun run build      # src/build.js → scripts/build.js (zero-dep bundle)
```

## Layout

```
pdf-creator/
├── SKILL.md            # Agent-facing trigger doc (frontmatter + usage)
├── githubagent.json    # Skill metadata
├── package.json        # build script + pdfkit dep
├── README.md           # this file
├── src/build.js        # source
├── assets/             # bundled GB2312 subset CJK font
│   └── NotoSansCJK-subset.ttf
└── scripts/build.js    # pre-built zero-dep bundle (generated)
```

## Requirements

- Node.js ≥ 20
- Runs on the GitHub Actions runner (ubuntu-latest) where Pi executes — not on the Cloudflare Worker.
- No environment variables required.
- Bundles a GB2312 subset CJK font (`assets/NotoSansCJK-subset.ttf`, ~6MB) so simplified Chinese + English render out of the box. Traditional/rare characters may be missing — pass `--font <path.ttf|.otf>` to use a full font.

## Supported Markdown

- `#` / `##` / `###` headings
- paragraphs, `-`/`*`/`+` nested bullets
- `> ` blockquotes
- ` ``` ` code blocks
- `| a | b |` tables (first row = header)
- `---` page breaks
