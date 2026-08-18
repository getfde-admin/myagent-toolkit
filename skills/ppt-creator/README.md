# ppt-creator — PPTX Creator Skill

Renders a Markdown deck or a JSON slide spec into a real `.pptx` binary using [pptxgenjs](https://github.com/gitbrent/PptxGenJS) (pure JavaScript — no system dependencies, no API key).

## Why this skill exists

LLM agents can reliably write text but not binary files. This skill turns the agent's text output into a guaranteed-real `.pptx` file on disk, so the workflow's `git add -A` commits a real deck into `artifacts/` — no more "claimed a deck but the repo has no file".

## Quick start

```sh
# from repo root
node .agents/skills/ppt-creator/scripts/build.js deck.md --out artifacts/123/deck.pptx
```

See `SKILL.md` for the full Markdown / JSON input format, options, and path-safety rules.

## Build

```sh
cd skills/ppt-creator
bun install
bun run build      # src/build.js → scripts/build.js (zero-dep bundle)
```

## Layout

```
ppt-creator/
├── SKILL.md            # Agent-facing trigger doc (frontmatter + usage)
├── githubagent.json    # Skill metadata
├── package.json        # build script + pptxgenjs dep
├── README.md           # this file
├── src/build.js        # source
└── scripts/build.js    # pre-built zero-dep bundle (generated)
```

## Requirements

- Node.js ≥ 20
- Runs on the GitHub Actions runner (ubuntu-latest) where Pi executes — not on the Cloudflare Worker.
- No environment variables required.