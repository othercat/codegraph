# Decisions: CodeGraph

## ADR-001: 建立 .ai/ 长期记忆目录

### 背景

CodeGraph 项目推广"代码库地图优先"和".ai/ 长期记忆"给所有用户项目，但自身仓库却没有 `.ai/` 目录。这导致每次 AI session 进入本项目时都从零开始理解架构，重复消耗 token，且无法复用上一次 session 的沉淀。

### 决策

在 CodeGraph 项目根目录建立完整的 `.ai/` 体系，包含：

```text
.ai/
  repo_map.md          # 项目结构、技术栈、核心模块、关键调用链
  handover.md          # 当前目标、已完成、未完成、关键文件、已知坑
  task_log.md          # 任务过程记录
  decisions.md         # 架构决策记录（本文件）
  token_saving_rules.md  # Token 节省红线
  claude_rules.md      # 项目级 Agent 规则
```

### 替代方案

- **方案 A（不建立 .ai/）**：继续使用全局 `~/.claude/CLAUDE.md` 中的通用规则。缺点：项目特化信息无法沉淀，每次 session 重复理解架构。
- **方案 B（建立但不提交 git）**：只作为本地临时文件。缺点：换机器/换环境后丢失，团队协作无法共享。
- **方案 C（建立并提交 git）**✅：将核心 `.ai/*.md` 提交到仓库，成为项目的一部分。优点：跨 session 复用、跨机器同步、团队成员共享。

### 影响

- 所有未来进入本项目的 Claude Code session 会优先读取 `.ai/` 文件，减少初始 token 消耗。
- `.ai/` 文件需要随项目演化而更新，否则会变成过时噪音。
- 需要在 `.gitignore` 中考虑是否忽略部分临时文件（如 `.ai/tmp/`、`.ai/cache/`）。

### 回滚方式

- 删除 `.ai/` 目录即可回滚到无长期记忆状态。
- 不影响任何业务代码或构建流程。

---

## ADR-002: 项目级规则与全局规则的关系

### 背景

用户全局 `~/.claude/CLAUDE.md` 已包含通用的"开工九步"和 CodeGraph 使用规范。本项目需要更特化的规则（如 Node 版本约束、installer 测试要求、explore 预算单调性等）。

### 决策

- **全局规则**（`~/.claude/CLAUDE.md`）：定义通用流程和最低标准，适用于所有项目。
- **项目规则**（`.ai/claude_rules.md`）：在全局规则基础上叠加项目特化约束，优先级更高。
- Claude Code session 应先读全局规则，再读项目规则；项目规则中明确引用了全局规则中的"开工九步"，不做重复，只做补充。

### 影响

- 全局规则修改时，项目规则不需要同步修改（除非涉及项目特化部分）。
- 项目规则可以作为其他 CodeGraph 用户项目的参考模板。

---

## ADR-003: Python 包管理器声明

### 背景

用户明确要求："注意我用 anaconda3/miniconda3 作为我的 python 包管理器。"

### 决策

在 `.ai/claude_rules.md` 中记录此偏好。CodeGraph 是 Node 项目，Python 规则主要影响：
1. 涉及 Python 脚本的 CI/构建流程（如 `scripts/` 中的某些脚本）。
2. 与其他 Python 项目交互时的环境管理建议。
3. 不涉及本项目的核心构建（`npm ci` / `npm run build`）。

### 影响

- 如果未来 CodeGraph 需要 Python 辅助工具（如 benchmark 分析脚本），应优先使用 anaconda3/miniconda3 环境。

---

## ADR-004: Windows Node.js 22.x 的 node:sqlite 缺少 FTS5 — better-sqlite3 fallback

### 背景

在 Windows 上安装 Node.js v22.14.0（LTS）后，`codegraph init` 失败：`no such module: fts5`。

诊断：
- `node:sqlite` 的 SQLite 版本是 3.47.2
- `PRAGMA compile_options` 显示编译选项中有 `ENABLE_MATH_FUNCTIONS`、`ENABLE_SESSION` 等，但**没有 `ENABLE_FTS5`**
- Linux/macOS 的 Node 22.x 通常包含 FTS5，Windows 构建是例外
- CodeGraph 的核心功能（全文搜索）依赖 FTS5

### 决策

在 `src/db/sqlite-adapter.ts` 中添加运行时检测 + better-sqlite3 fallback：

1. **`nodeSqliteSupportsFts5()`**：打开 `:memory:` 数据库，尝试 `CREATE VIRTUAL TABLE ... USING fts5`，成功返回 true，失败返回 false。
2. **`BetterSqlite3Adapter`**：包装 better-sqlite3 API，实现与 `NodeSqliteAdapter` 相同的 `SqliteDatabase` 接口。
3. **`createDatabase()`**：先检测 FTS5 支持，支持则使用 `node:sqlite`；不支持则 require better-sqlite3 并创建 `BetterSqlite3Adapter`。

同时修复了两个硬编码 backend 的 bug：
- `src/bin/codegraph.ts` 的 status 命令
- `src/mcp/tools.ts` 的 MCP status 工具

### 替代方案

- **方案 A（要求用户换平台）**：让用户在 WSL2 或 Linux 上开发。缺点：放弃 Windows 原生开发体验。
- **方案 B（降级 Node 版本）**：尝试 Node 23.x 或 24.x，看是否修复了 FTS5。风险：不确定哪个版本修复，且 CodeGraph 限制 Node <25。
- **方案 C（修改 schema 去掉 FTS5）**：放弃全文搜索功能。缺点：严重功能退化。
- **方案 D（better-sqlite3 fallback）**✅：运行时自动检测并切换，对用户透明，无需修改 schema 或放弃功能。

### 影响

- `better-sqlite3` 需要加入 `package.json` dependencies（`npm install better-sqlite3` 已自动完成）。
- `package-lock.json` 已更新。
- Windows 用户现在可以正常从源码运行 CodeGraph，无需 WSL2。
- `node:sqlite` 仍然是首选（无 native build，启动更快），fallback 只在需要时触发。
- 需要更新 CHANGELOG 记录这个修复。

### 回滚方式

- 删除 `BetterSqlite3Adapter` 类和 `nodeSqliteSupportsFts5()` 函数，恢复 `createDatabase()` 为纯 `node:sqlite`。
- 卸载 better-sqlite3：`npm uninstall better-sqlite3`。
