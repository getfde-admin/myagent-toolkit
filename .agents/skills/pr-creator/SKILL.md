---
name: pr-creator
description:
  Use this skill when asked to create a pull request (PR). It creates a new
  branch, commits with detailed Traditional Chinese (zh-TW) messages, enriches
  the related issue with technical context and problem definition, then creates
  a PR with a zh-TW description.
---

# Pull Request Creator

This skill guides the creation of high-quality Pull Requests. All user-facing
output (commit messages, PR descriptions, issue comments) MUST be written in
**Traditional Chinese (zh-TW)**. The skill document itself is in English.

## Workflow

Follow these steps in order to create a Pull Request:

### 1. Create a New Branch

**CRITICAL:** NEVER work directly on the `main` branch.

- Run `git branch --show-current` to check the current branch.
- If on `main`, create and switch to a new descriptive branch:
  ```bash
  git checkout -b feat/<short-description>
  ```
- Branch naming convention: `feat/xxx`, `fix/xxx`, `refactor/xxx`, `docs/xxx`

### 2. Analyze Changes

Before committing, thoroughly analyze all changes to produce high-quality commit
messages:

- Run `git diff --stat` and `git diff` to understand all changed files.
- Identify and summarize:
  - **Problem definition**: What problem does this change solve?
  - **Technical context**: Why this approach? What alternatives were considered?
  - **Impact scope**: Which modules / features are affected?
  - **Breaking changes**: Are there any?

### 3. Commit in Traditional Chinese

All commit messages MUST be written in **Traditional Chinese (zh-TW)**, using
the following format:

```bash
git add .
git commit -m "type(scope): 简短摘要

详细说明：
- 变更项目 1：说明具体修改内容与原因
- 变更项目 2：说明具体修改内容与原因

技术细节：
- 采用的技术方案与理由
- 相关的设计决策

影响范围：
- 受影响的模组或功能
- 是否有破坏性变更"
```

- **type**: Use English (feat / fix / refactor / docs / chore / test)
- **scope**: Use English module name
- **Summary and body**: Must be in Traditional Chinese
- The commit body should be detailed enough that a reviewer can understand the
  full context without reading the code

### 4. Enrich the Related Issue

If this PR is linked to an issue, update the issue with technical context
**before** creating the PR:

- Read the existing issue with `gh issue view <issue_number>`.
- Add a comment with `gh issue comment <issue_number> --body "..."` containing:
  ```markdown
  ## 技术分析

  ### 问题根因
  （说明问题的根本原因，不只是表面症状）

  ### 解决方案
  （说明采用的技术方案与原因）

  ### 影响评估
  - 受影响的模组：...
  - 破坏性变更：有 / 无
  - 效能影响：...

  ### 测试验证
  （说明如何验证修改是正确的）
  ```
- This ensures the issue serves as a complete technical record, not just a
  one-line description.

### 5. Locate PR Template

Search the repository for a Pull Request template:

- Check `.github/pull_request_template.md`
- Check `.github/PULL_REQUEST_TEMPLATE.md`
- If multiple templates exist (e.g., in `.github/PULL_REQUEST_TEMPLATE/`),
  select the most appropriate one based on the change type.
- If no template is found, use the default structure in Step 6.

### 6. Draft PR Description

The PR description MUST be in **Traditional Chinese**. Follow the template
structure strictly. If no template exists, use the following default:

```markdown
## 概述
（一段话说明这个 PR 做了什么）

## 问题描述
（这个 PR 要解决什么问题？连结相关 Issue）

## 解决方案
（采用了什么技术方案？为什么？）

## 变更内容
- [ ] 变更项目 1
- [ ] 变更项目 2

## 测试方式
（如何验证这些变更是正确的？）

## 相关连结
- Issue: #xxx
- 相关文件：...
```

### 7. Push Branch

**Safety check:** Verify the branch name one more time before pushing.

```bash
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" = "main" ]; then
  echo "ERROR: must not push to main!"
  exit 1
fi
git push -u origin HEAD
```

### 8. Create the PR

Use the `gh` CLI to create the PR. To avoid shell escaping issues with
multi-line Markdown, write the description to a temporary file first:

```bash
# 1. Write the PR description to a temp file
cat > /tmp/pr-body.md << 'EOF'
(PR description content in zh-TW)
EOF

# 2. Create the PR
gh pr create \
  --title "type(scope): 繁体中文简短摘要" \
  --body-file /tmp/pr-body.md

# 3. Clean up
rm /tmp/pr-body.md
```

- **Title format**: `type(scope): 繁体中文摘要`
- If linked to an issue, include `Fixes #xxx` in the body and add `--assignee @me`

## Principles

- **Safety First**: NEVER push to `main`. This is the highest priority rule.
- **Traditional Chinese Output**: All commit messages, PR descriptions, and
  issue comments MUST be in Traditional Chinese (zh-TW).
- **Full Context**: Commits and PRs must provide enough technical context for
  reviewers to understand changes quickly.
- **Issues as Documentation**: Issues are permanent technical decision records,
  not just task trackers. Enrich them accordingly.
- **Honesty**: Don't check boxes for tasks you haven't completed.
