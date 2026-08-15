# Repository Guidelines

## Project Structure & Module Organization

- `skills/`: standalone Agent Skills with `SKILL.md`, `README.md`, and `githubclaw.json`; add `scripts/`, `src/`, `references/`, or `assets/` only when needed.
- `templates/`: reusable agent or system templates, usually with `AGENTS.md` or `SYSTEM.md` plus `githubclaw.json`.
- `actions/`: composite GitHub Actions and reusable workflow assets. Each action has `action.yml` and `README.md`.
- `workers/telegram-bot/`: Bun/Node Cloudflare Worker source, tests, scripts, migrations, and deployment config.

* * *

## Build, Test, and Development Commands

- `cd workers/telegram-bot && bun install`: install Worker dependencies.
- `cd workers/telegram-bot && bun run build`: bundle `src/index.js`.
- `cd workers/telegram-bot && bun run test`: run Node's built-in test suite.
- `cd workers/telegram-bot && WORKER_NAME=your-worker-name bun run dev`: start Wrangler development mode.
- `cd skills/<skill-name> && bun run build`: rebuild skills that provide `src/` and a `package.json`.

* * *

## Coding Style & Naming Conventions

Use ESM JavaScript for Worker and skill scripts. Keep modules small and purpose-named, such as `config.js`, `telegram.js`, or `resolve-worker-name.mjs`. Use kebab-case directories and `UPPER_SNAKE_CASE` environment variables.

* * *

## Testing Guidelines

Worker tests live in `workers/telegram-bot/test/` and use Node's `node --test` runner. Name tests with the `.test.js` suffix. Add tests for parsing, configuration, request handling, and branch/name normalization when changing Worker behavior.

* * *

## Commit & Pull Request Guidelines

Use Conventional Commits 1.0.0: `<type>[optional scope]: <description>`. Examples: `feat(telegram-bot): ...`, `fix(workflow): ...`, `docs: ...`, `chore(templates): ...`. Write the full commit message to a temporary file and run `git commit -F /tmp/commit-message.txt`.

* * *

## Action Release Reminder

Reusable workflow consumers are pinned to the `v1` tag. If any file under `actions/` changes, explicitly remind the maintainer to decide whether to republish or move `v1` to the latest compatible commit.

* * *

## Security & Configuration Tips

Never commit API keys, Telegram tokens, GitHub tokens, `.dev.vars`, or generated dependency directories. For `workers/telegram-bot/`, copy expected variables from `env.example`, then use `WORKER_NAME=your-worker-name bun run set` to upload secrets through Wrangler.
