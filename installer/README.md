# installer/ — 安装器种入包（Seed Payload）

这一包是「安装一只小龙虾」时要种进**使用者 instance repo** 的档案，等价于官方安装器种入 `yh_claw` 的内容。
由 `altShiftClawAdmin` 前端 bundle 后，透过 GitHub Git Data API 一次 commit 进使用者 repo。

反推与设计说明见：[`_DOCS/altShiftClawAdmin/05_worker-package-and-workflows-reverse-engineered.md`](../../_DOCS/altShiftClawAdmin/05_worker-package-and-workflows-reverse-engineered.md)

## 内容

```
installer/
├── workflows/           → 种入 instance 的 .github/workflows/
│   ├── deploy-lobster-burger.yml          # 部署（Terraform + CF Worker + D1 + Telegram webhook）
│   ├── sync-github-app-webhook-secret.yml # 同步 GitHub App webhook secret
│   ├── templates.yml                      # 同步范本
│   ├── skills.yml                         # 安装技能
│   ├── remove-skill.yml                   # 移除技能
│   ├── clear-memory.yml                   # 清除记忆
│   ├── autoupdate.yml                     # 更新核心（版本比对）
│   ├── check-env-permissions.yml          # 环境变数检测
│   ├── issue-1.yml                        # 执行小龙虾任务 #1
│   └── lib/{worker-name.sh, inject-workflow-env.sh}
└── templates/
    ├── .githubclaw-init                   # 初始化标记档
    └── default/                           # runtime 预设范本（Pi Coding Agent）
```

## ⚙️ 设定（若换帐号 / repo 名 / core 网域要改这些）

这些 upstream 引用已从官方 `duotify/*` 改成我方预设值：

| 用途 | 目前值 | 出现档案 |
|---|---|---|
| Toolkit 来源 repo | `jeffsia-blacksmith/altShiftClawToolkit` | `skills.yml`, `templates.yml`, `deploy-lobster-burger.yml`, `issue-1.yml` |
| Core package 网域 | `jeffsia-blacksmith.github.io/altShiftClawCore` | `deploy-lobster-burger.yml`, `autoupdate.yml` |

换值：
```bash
cd installer/workflows
grep -rl 'jeffsia-blacksmith/altShiftClawToolkit' . | xargs sed -i '' 's#jeffsia-blacksmith/altShiftClawToolkit#<新 owner>/<新 repo>#g'
grep -rl 'jeffsia-blacksmith.github.io/altShiftClawCore' . | xargs sed -i '' 's#jeffsia-blacksmith.github.io/altShiftClawCore#<新 pages 网域>#g'
```

## 注意

- `deploy-lobster-burger.yml` 会抓 `worker-package.zip`（来自 altShiftClawCore GitHub Pages）并依赖 `Terraform/` output 名称 —— 部署前必须先建好 `altShiftClawCore` 并发布（见 05 待办）。
- `actions/error-handler-action@v1`、`update-comment-action@v1`（`issue-1.yml` 用）需 `altShiftClawToolkit` repo 已打 `v1` tag 才引用得到。
