# Actions

此目录收录 altShiftClawToolkit Issue 处理流水线所使用的 Composite GitHub Actions。每个 Action 皆可独立被其他 Workflow 引用。

## Actions 一览

| Action | 用途 |
|---|---|
| [`commit-push-issue-branch-action`](commit-push-issue-branch-action/) | 将 Issue Workflow 产生的变更提交并 force-push 至对应的 `issue-<N>` branch |
| [`error-handler-action`](error-handler-action/) | 解析 Copilot CLI JSONL 日志、辨识错误类型，并将摘要写入结果档 |
| [`update-comment-action`](update-comment-action/) | 将结果档内容更新（PATCH）至指定的 GitHub Issue 留言 |
