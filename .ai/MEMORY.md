# 项目记忆索引

## 核心文件（每次 session 必读）

- [Handover](handover.md) — 当前状态、目标、已知坑
- [Repo Map](repo_map.md) — 项目结构、技术栈、核心模块、关键调用链
- [Claude Rules](claude_rules.md) — 项目级 Agent 规则（开工九步、项目特化约束）
- [Token Saving Rules](token_saving_rules.md) — Token 节省红线

## 过程文件（按任务更新）

- [Task Log](task_log.md) — 历次任务的过程记录
- [Decisions](decisions.md) — 架构决策记录（ADR 格式）

## 快速参考

| 问题 | 查阅 |
|------|------|
| 项目是什么？ | repo_map.md → 项目目标 |
| 怎么构建/测试？ | repo_map.md → 构建/运行/测试命令 |
| 核心模块在哪？ | repo_map.md → 关键目录 |
| 这次任务该做什么？ | handover.md → 当前目标 / 下一步建议 |
| 上次做了什么？ | task_log.md |
| 有什么已知坑？ | handover.md → 已知坑 / repo_map.md → 高风险区域 |
| 修改前要注意什么？ | claude_rules.md → Mandatory / Forbidden |
| 架构决策怎么来的？ | decisions.md |
