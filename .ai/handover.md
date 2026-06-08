# Handover: CodeGraph

## 2026-06-05 本次交接更新：本地查询 API 已落地

- 已新增 `src/query/local-api.ts`，作为标准本地查询 API：集中 search、symbol matching、callers/callees/impact 聚合、files 过滤、status 健康摘要、`findAffectedTests` 和 `buildTaskContext`。
- `src/bin/codegraph.ts` 的 `status/query/files/callers/callees/impact/context/affected` 全部改为调用本地 API；CLI 是本地主路径，不需要 MCP 才能查询。
- `src/mcp/tools.ts` 的对应 tools 已改为调用同一 API；MCP 现在主要承担参数校验、输出格式、staleness/worktree notice 和 explore/node 的 MCP 专用渲染。
- `src/mcp/server-instructions.ts` 已写入 fallback 规则：MCP `Transport closed` 先视为 transport/adapter 故障；先跑 `codegraph status --json <project>`；若 `initialized=true` 且 `pendingChanges` 三项为 0，索引健康，走本地库/API 或 CLI，不运行 `codegraph index`，不删除 `.codegraph/`。
- 验证通过：`npm run build`；本地 API/MCP fallback/MCP files/staleness 相关 vitest；CLI `query`/`files`/`context`/`affected` smoke；`codegraph status --json .` 显示 pending 为 0。
- 下一步建议：如需继续推进，可考虑把 MCP tools 中的 `explore` 和 `node` 也逐步收束到本地 API，但应保持小步测试驱动，避免顺手重构 MCP 的大块渲染逻辑。

## 给 CC / Claude Code 的使用说明：MCP 不可用时不要损失 CodeGraph 能力

本节是给 Claude Code/CC 直接读取的操作规则。当前 CodeGraph 架构已经从“依赖 MCP Server 才能查询”调整为“标准本地核心库/API + CLI 为主路径，MCP Server 是兼容适配器”。

### 核心判断

- `.codegraph/` SQLite 索引、本地库/API、CLI 才是 CodeGraph 查询能力的主路径。
- MCP 只是把同一套能力暴露给支持 MCP 的 Agent；MCP 失败不等于 CodeGraph 索引坏。
- 如果 MCP 工具不可见、MCP server 断开、或出现 `Transport closed`，先视为 transport/adaptor 层故障。
- 不要因为 MCP 失败就运行 `codegraph index`，也不要删除 `.codegraph/`。

### CC 启动守卫

每次进入项目或开始任务时，先运行：

```bash
codegraph status --json .
```

按结果处理：

- `initialized=true` 且 `pendingChanges.added/modified/removed` 全为 0：索引健康，直接继续。
- `initialized=true` 且存在 pending changes：只运行 `codegraph sync .`。
- `initialized=false` 或 `.codegraph/` 缺失：运行 `codegraph init .`。`init` 会建立初始索引，不要紧接着再运行 `index`。
- 只有索引损坏、schema/提取器重大变更、或用户明确要求强制重建时，才运行 `codegraph index .` 或删除 `.codegraph/`。

### MCP 失败时的 fallback

如果 CC 无法调用 CodeGraph MCP，或 MCP 报 `Transport closed`：

1. 运行 `codegraph status --json <project>`。
2. 如果 `initialized=true` 且 `pendingChanges.added=0`、`pendingChanges.modified=0`、`pendingChanges.removed=0`，判定本地索引健康。
3. 改用 CLI 查询；不要重建索引。

常用 CLI 查询：

```bash
codegraph query <symbol-or-keyword> --path <project> --limit 10
codegraph files --path <project> --filter <path-or-name>
codegraph callers <symbol> --path <project>
codegraph callees <symbol> --path <project>
codegraph impact <symbol> --path <project>
codegraph status --json <project>
```

### CC 工作流

1. 先读 `.ai/handover.md`、`.ai/repo_map.md`、`.ai/codex_rules.md`、`.ai/token_saving_rules.md`、`.ai/task_log.md`。
2. 运行 `codegraph status --json .`，按上面的启动守卫处理。
3. 找代码、理解流程、追踪调用链、分析影响时，先用 MCP 或 CLI 的 CodeGraph 查询。
4. 在读取文件前先列 `Candidate Files` 和 `Evidence Chain`。
5. 只读取关键文件/片段，做最小 patch，跑最小相关验证。
6. 任务结束更新 `.ai/task_log.md` 和 `.ai/handover.md`。

### 优先级说明

如果旧文档里仍出现“每次 `init + index`”或“CLI fallback 最后必须 index”之类说法，以本节为准：默认路径是 `status -> sync/init`，`index` 只用于强制重建或确认损坏。

## 当前目标

已完成的：为 CodeGraph 自身项目建立「代码库地图优先」的永久能力体系，并把 Codex 全局 Repo Map First 规则与 CodeGraph MCP 配置接入到 `~/.codex/`。

当前补充：GitHub CLI 已以便携方式安装到 `~/.local/gh/bin`；Codex 全局规则和仓库模板已改为“按需索引启动守卫”，避免每次进入项目都重建索引。

2026-06-05 补充：Codex 侧已观察到“CLI 索引健康，但 MCP 查询某个 symbol 时出现 `Transport closed`”的风险。新的架构判断是：CodeGraph 应以标准本地核心库/API 与 CLI 作为主入口，MCP server 降级为兼容适配器。MCP transport 失败时，不应判断为索引损坏，也不应自动重建索引；应先用 `codegraph status --json <project>` 判断 `.codegraph/` 状态，再走本地库/CLI fallback。

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
- [x] GitHub CLI 登录验证通过：`gh auth status` 显示已登录 `othercat`
- [x] 更新 `~/.codex/AGENTS.md`：启动时先 `codegraph status --json .`，已有索引只按需 `sync`，未初始化才 `init`
- [x] 更新 `docs/permanent-capability-template.md` 和 `docs/setup-guide.md`：移除默认 `init + index` 重建式流程
- [x] 验证：`git diff --check` 无 whitespace error，`npm run build` 成功
- [x] 提交并推送未跟踪内容：项目级 `AGENTS.md` 和 `.agents/` 技能目录
- [ ] 验证下次 session 是否自动先读 `.ai/`
- [ ] 重启 Codex agent 后验证 `codegraph_*` MCP 工具是否出现在工具列表
- [x] 本地提交并推送本次修正：`docs: add Codex on-demand CodeGraph indexing`

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

新的产品/架构判断：CodeGraph 的真正能力边界应在 `.codegraph` SQLite 索引、`src/index.ts` 公共 API、数据库/图查询核心模块和 CLI 上；MCP 只是把这套能力暴露给支持 MCP 的 Agent。后续不要把”Agent 能否通过 MCP 连接成功”等同于”CodeGraph 能否查询成功”。

**2026-06-05 验证结论**：本地查询 API (`src/query/local-api.ts`) + CLI 主路径 + MCP 适配器模式已完整落地：
- CLI 的 status/query/files/callers/callees/impact 全部调用 `createLocalQueryApi(cg)`。
- MCP tools 的 search/callers/callees/impact/files/status/findSymbolMatches/findAllSymbols 全部调用同一本地 API。
- `server-instructions.ts` 已记录 `Transport closed` fallback 规则。
- `src/index.ts` 已导出 `createLocalQueryApi` 和相关类型。
- 相关测试（21 tests across 4 files）全部通过。

需要关注 `.ai/` 的维护：这些文件必须随项目演化而更新，否则会迅速过时变成噪音。每次任务结束时更新 `task_log.md` 和 `handover.md` 是关键。

## 下一步建议

1. ✅ 已完成：本地查询 API (`src/query/local-api.ts`) + CLI 主路径 + MCP 适配器模式已落地，MCP tools 已复用同一套标准本地查询 API。
2. ✅ 已完成：MCP `Transport closed` fallback 规则已写入 `server-instructions.ts` 和 `.ai/handover.md`。
3. **推广到所有项目**：把”本地 API + CLI 为主路径，MCP 为适配器”的 fallback 规则写入 Claude Code 全局 `~/.claude/CLAUDE.md`，使所有项目在遇到 MCP `Transport closed` 时都能自动走 CLI fallback，而不是误判索引损坏。
4. 新 session 进入项目后，继续验证是否自动先读 `.ai/`，并确认 CodeGraph startup guard 仍按 `status -> sync/init` 执行。
5. 如需使用 gh 创建 PR 或调用 GitHub API，先运行 `gh auth status` 确认登录状态。

## 已知坑

- **Node.js 22.x Windows 缺少 FTS5**：`node:sqlite`（SQLite 3.47.2）编译选项中没有 `ENABLE_FTS5`。已在 `sqlite-adapter.ts` 中添加 better-sqlite3 fallback 自动检测和切换。
- **PowerShell 执行策略**：`npm` 命令在 PowerShell 中可能因 `.ps1` 脚本被禁止而报错。解决：`Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`。
- **bash PATH 不同步**：nvm-windows 的 Node 路径不会自动进入 bash。临时解决：`export PATH="$PATH:/c/nvm4w/nodejs"`。
- Node 25.x 硬退出：`src/bin/node-version-check.ts`
- Windows 特有失败：`security.test.ts > symlink resistance`（需要提权）、`mcp-initialize.test.ts` / `mcp-roots.test.ts`（afterEach EPERM，子进程持有文件句柄）
- 构建时必须 `copy-assets`：新 SQL 或 grammar WASM 必须 copy 否则不 ship
- `--init` 对进程生命周期测试是 load-bearing（Docker 中必须加）
- MCP `Transport closed` 是适配/传输层故障信号，不等于 `.codegraph/` 索引坏；先查 `codegraph status --json`，索引健康时走本地库/CLI fallback，不要自动 `index` 或删除 `.codegraph/`
- `.ai/` 文件如果过时会成为误导信息，必须勤更新
