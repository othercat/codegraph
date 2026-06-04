# Handover: CodeGraph

## 当前目标

已完成的：为 CodeGraph 自身项目建立「代码库地图优先」的永久能力体系，并把 Codex 全局 Repo Map First 规则与 CodeGraph MCP 配置接入到 `~/.codex/`。

当前补充：GitHub CLI 已以便携方式安装到 `~/.local/gh/bin`；Codex 全局规则和仓库模板已改为“按需索引启动守卫”，避免每次进入项目都重建索引。

## 已完成

### .ai/ 永久能力体系（任务 1）

- [x] 读取参考文档 `codex_repo_map_first_codegraph_permanent_capability.md`
- [x] 确认项目无 `.ai/` 目录，建立完整 `.ai/` 体系
- [x] 创建 `repo_map.md` — 项目结构、技术栈、核心模块、关键调用链
- [x] 创建 `handover.md` — 交接状态
- [x] 创建 `claude_rules.md` — 项目级 Agent 规则（含开工九步 + 项目特化约束）
- [x] 创建 `token_saving_rules.md` — Token 节省红线
- [x] 创建 `task_log.md` — 任务日志
- [x] 创建 `decisions.md` — 架构决策（ADR-001/002/003）
- [x] 创建 `MEMORY.md` — 项目记忆索引
- [x] 更新 `.gitignore` — 加入 `.ai/tmp/`、`.ai/cache/` 忽略
- [x] 注册全局 memory — `codegraph-project-overview.md` + `claude-codegraph-workflow.md`

### Node.js 安装 + Windows FTS5 修复（任务 2）

- [x] 安装 Node.js v22.14.0（通过官网 MSI）
- [x] 解决 PowerShell 执行策略问题
- [x] `npm ci` 安装依赖
- [x] `npm run build` 构建成功
- [x] 诊断 `codegraph init` FTS5 失败原因：Node.js 22.x Windows 的 `node:sqlite` 缺少 `ENABLE_FTS5`
- [x] 安装 `better-sqlite3`（预编译二进制，无需编译工具）
- [x] 修改 `src/db/sqlite-adapter.ts`：添加 `BetterSqlite3Adapter` + `nodeSqliteSupportsFts5()` 检测 + `createDatabase()` fallback
- [x] 修改 `src/bin/codegraph.ts`：修复 status 命令硬编码 backend 的 bug
- [x] 修改 `src/mcp/tools.ts`：修复 MCP status 工具硬编码 backend 的 bug
- [x] `codegraph init` 成功：206 files, 3,267 nodes, 11,241 edges
- [x] `codegraph status` 成功：正确显示 `better-sqlite3 — native (full WAL + FTS5)`

## 未完成

- [x] 用户手动提交 git commit（c9f3471，已推送）
- [x] 创建通用永久能力模板（docs/permanent-capability-template.md + setup-guide.md）
- [x] 注册 Codex 全局永久能力（~/.codex/AGENTS.md）
- [x] **修正**：所有安装指令改为本地 fork 源码（`npm run build` + `npm link`），不再指向官方 npm 包 / 原始链接
- [x] 验证本地 `codegraph status` 可用：索引 up to date，backend 为 `better-sqlite3 - native (full WAL + FTS5)`
- [x] 注册 Codex 全局 CodeGraph MCP：`~/.codex/config.toml` 已包含 `[mcp_servers.codegraph]`
- [x] 安装 GitHub CLI v2.93.0：`~/.local/gh/bin/gh.exe`，并加入 User PATH
- [x] 更新 `~/.codex/AGENTS.md`：启动时先 `codegraph status --json .`，已有索引只按需 `sync`，未初始化才 `init`
- [x] 更新 `docs/permanent-capability-template.md` 和 `docs/setup-guide.md`：移除默认 `init + index` 重建式流程
- [x] 验证：`git diff --check` 无 whitespace error，`npm run build` 成功
- [ ] 验证下次 session 是否自动先读 `.ai/`
- [ ] 重启 Codex agent 后验证 `codegraph_*` MCP 工具是否出现在工具列表
- [ ] GitHub CLI 登录：`gh auth status` 当前显示未登录，PR/gh API 操作前需要 `gh auth login`
- [x] 本地提交本次修正：`docs: add Codex on-demand CodeGraph indexing`
- [ ] 推送本次修正：当前被 GitHub HTTPS 凭据阻塞，`git push origin main` 返回 `Invalid username or token`

## 关键文件

| 文件 | 作用 |
|------|------|
| `CLAUDE.md` | 项目级开发者指南（架构、构建、测试、发布、MCP 设计） |
| `src/mcp/server-instructions.ts` | MCP 给 Agent 的工具使用指导（唯一真源） |
| `src/mcp/tools.ts` | MCP tools 实现 |
| `src/index.ts` | 公共 API — CodeGraph 类 |
| `src/db/sqlite-adapter.ts` | SQLite 后端适配（node:sqlite / better-sqlite3 fallback） |
| `src/bin/codegraph.ts` | CLI 入口（status 命令 backend 显示） |
| `src/installer/targets/` | 多 Agent 安装器 |
| `__tests__/installer-targets.test.ts` | 安装器参数化契约测试 |
| `.ai/repo_map.md` | 项目地图 |
| `.ai/claude_rules.md` | 项目级规则 |
| `.ai/token_saving_rules.md` | Token 红线 |

## 当前判断

CodeGraph 项目本身对自己的 dogfooding 已完成初步建立。`.ai/` 体系现在包含 7 个文件，覆盖了项目地图、规则、日志、决策、记忆索引。

需要关注 `.ai/` 的维护：这些文件必须随项目演化而更新，否则会迅速过时变成噪音。每次任务结束时更新 `task_log.md` 和 `handover.md` 是关键。

## 下一步建议

1. 重启 Codex agent，让 `~/.codex/config.toml` 中的 CodeGraph MCP server 生效
2. 新 session 进入项目后，验证是否自动先读 `.ai/`
3. 验证 `codegraph_*` MCP 工具是否出现在工具列表；若未出现，先用 CLI fallback：`codegraph status` / `codegraph sync`
4. 如需使用 gh 创建 PR 或调用 GitHub API，先运行 `gh auth login`
5. 修复 GitHub 凭据后重新运行 `git push origin main`
6. 后续任务中继续验证 `.ai/` 体系有效性

## 已知坑

- **Node.js 22.x Windows 缺少 FTS5**：`node:sqlite`（SQLite 3.47.2）编译选项中没有 `ENABLE_FTS5`。已在 `sqlite-adapter.ts` 中添加 better-sqlite3 fallback 自动检测和切换。
- **PowerShell 执行策略**：`npm` 命令在 PowerShell 中可能因 `.ps1` 脚本被禁止而报错。解决：`Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`。
- **bash PATH 不同步**：nvm-windows 的 Node 路径不会自动进入 bash。临时解决：`export PATH="$PATH:/c/nvm4w/nodejs"`。
- Node 25.x 硬退出：`src/bin/node-version-check.ts`
- Windows 特有失败：`security.test.ts > symlink resistance`（需要提权）、`mcp-initialize.test.ts` / `mcp-roots.test.ts`（afterEach EPERM，子进程持有文件句柄）
- 构建时必须 `copy-assets`：新 SQL 或 grammar WASM 必须 copy 否则不 ship
- `--init` 对进程生命周期测试是 load-bearing（Docker 中必须加）
- `.ai/` 文件如果过时会成为误导信息，必须勤更新
