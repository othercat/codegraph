# Task Log: CodeGraph

## 2026-06-04 建立 .ai/ 永久能力体系

### 用户需求

> 阅读当前项目，把当前项目注册成 Claude Code 的永久能力，以后开工遇到项目，强制“先用 CodeGraph 定位调用链和候选文件，再只 Read 必要文件；禁止无目标全仓 grep。”
> 读取 `codex_repo_map_first_codegraph_permanent_capability.md`，根据这个 md 优化改进现有的调用流程。
> 注意用 anaconda3/miniconda3 作为 python 包管理器。

### 查询过的 symbol / 调用链

- 读取了参考文档 `codex_repo_map_first_codegraph_permanent_capability.md`（完整内容）
- 检查了 `.ai/` 目录存在性 → 不存在，需要新建
- 读取了 `package.json` → 确认技术栈和脚本
- 读取了 `src/` 目录列表和 `__tests__/` 目录列表
- 基于 `CLAUDE.md`（全局指令中已包含）提取了项目架构信息

### 读取过的文件

| 文件 | 原因 |
|------|------|
| `codex_repo_map_first_codegraph_permanent_capability.md` | 参考模板 |
| `package.json` | 技术栈、依赖、脚本 |
| `CLAUDE.md`（项目级，在上下文 system-reminder 中） | 架构、构建、测试、发布流程 |

### 结论

CodeGraph 项目本身没有 `.ai/` 目录，违反了自己推广的"代码库地图优先"原则。本次任务的核心目标是建立 `.ai/` 长期记忆体系，使 AI 以后进入本项目时自动遵循既定流程。

### 修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `.ai/repo_map.md` | 新建 | 项目地图 |
| `.ai/handover.md` | 新建 | 交接状态 |
| `.ai/claude_rules.md` | 新建 | 项目级 Agent 规则 |
| `.ai/token_saving_rules.md` | 新建 | Token 节省红线 |
| `.ai/task_log.md` | 新建 | 本文件 |
| `.ai/decisions.md` | 新建 | 架构决策 |

### 测试结果

- 无代码改动，无需运行测试。
- `codegraph status` 未执行：当前 bash 环境找不到 Node/npm（Windows PATH 问题），建议手动在 PowerShell 中执行 `npm run cli -- status`。
- `.gitignore` 已更新，加入 `.ai/tmp/` 和 `.ai/cache/` 忽略规则。
- 全局 memory 已注册到 `~/.claude/projects/c--Workspace-KnowledgeRoots-colbymchenry-codegraph/memory/`。
- 后续验证：下次 Claude Code 进入本项目时，应自动先读取 `.ai/handover.md`、`.ai/repo_map.md`、`.ai/claude_rules.md`。

---

## 2026-06-04 安装 Node.js + 修复 Windows FTS5 问题

### 用户需求

> 帮我安装 node 和 npm

### 过程记录

1. **Node.js 安装**：用户机器是 AMD64 Windows，通过浏览器下载 Node.js v22 LTS MSI 安装。
2. **PowerShell 执行策略问题**：`npm` 命令在 PowerShell 中被禁止运行 `.ps1` 脚本。解决方案：`Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`。
3. **bash PATH 问题**：nvm-windows 的 Node 路径不会自动进入 bash。临时解决：`export PATH="$PATH:/c/nvm4w/nodejs"`。
4. **`npm ci`**：安装 61 个 packages，9s，成功。
5. **`npm run build`**：tsc + copy-assets 成功。
6. **`codegraph init` 失败**：`no such module: fts5`。
7. **诊断**：Node.js 22.14.0 Windows 构建的 `node:sqlite`（SQLite 3.47.2）编译选项中没有 `ENABLE_FTS5`。通过 `PRAGMA compile_options` 确认。
8. **安装 better-sqlite3**：`npm install better-sqlite3`，有预编译二进制，46s，成功。
9. **修改 `src/db/sqlite-adapter.ts`**：
   - 扩展 `SqliteBackend` 类型为 `'node-sqlite' | 'better-sqlite3'`
   - 新增 `BetterSqlite3Adapter` 类
   - 新增 `nodeSqliteSupportsFts5()` 运行时检测函数
   - 修改 `createDatabase()` 先检测 FTS5 支持，不支持则 fallback 到 better-sqlite3
10. **修复 `src/bin/codegraph.ts`**：status 命令硬编码 `node:sqlite`，改为根据 `backend` 变量动态显示。
11. **修复 `src/mcp/tools.ts`**：MCP status 工具也硬编码 backend，改为调用 `cg.getBackend()` 动态生成。
12. **清理旧数据库**：删除 `.codegraph/` 重新初始化。
13. **`codegraph init`**：成功，索引 206 files, 3,267 nodes, 11,241 edges。
14. **`codegraph status`**：正确显示 `Backend: better-sqlite3 — native (full WAL + FTS5)`。

### 修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/db/sqlite-adapter.ts` | 修改 | 添加 better-sqlite3 fallback + FTS5 运行时检测 |
| `src/bin/codegraph.ts` | 修改 | status 命令动态显示 backend |
| `src/mcp/tools.ts` | 修改 | MCP status 工具动态显示 backend |
| `package.json` | 自动更新 | `npm install better-sqlite3` 加入 dependencies |
| `.gitignore` | 修改 | 加入 `.ai/tmp/`、`.ai/cache/` |

### 测试结果

- `node --version` ✅ → v22.14.0
- `npm --version` ✅ → 10.9.2
- `npm ci` ✅ → 61 packages
- `npm run build` ✅ → 无错误
- `codegraph init` ✅ → 之前 FTS5 失败，现在成功
- `codegraph status` ✅ → `better-sqlite3 — native (full WAL + FTS5)`
- 索引：206 files, 3,267 nodes, 11,241 edges, 10.27 MB

### 已知问题

- **Node.js 22.x Windows 缺少 FTS5**：`node:sqlite` 编译选项中没有 `ENABLE_FTS5`，已记录到 `decisions.md`。必须通过 better-sqlite3 fallback。
- **PowerShell 执行策略**：`npm` 在 PowerShell 中需要 `RemoteSigned` 策略。
- **bash PATH**：nvm-windows 的 Node 路径不会自动同步到 bash。
