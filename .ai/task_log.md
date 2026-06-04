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

---

## 2026-06-04 后续任务：测试修复 + CHANGELOG + git 提交

### 过程记录

1. **更新 CHANGELOG.md**：在 `[Unreleased] > ### Fixes` 下添加了 Windows FTS5 fallback 的条目。
2. **修复 `sqlite-backend.test.ts`**：添加 `nodeSqliteSupportsFts5()` 运行时检测，测试根据环境动态期望 `node-sqlite` 或 `better-sqlite3`。
3. **修复 `node-sqlite-backend.test.ts`**：扩展 `nodeSqliteAvailable` 为 `backendAvailable`（检测 FTS5 + better-sqlite3），断言使用动态 `expectedBackend`。
4. **修复 `frameworks-integration.test.ts`**：JVM FQN imports 的 3 个测试缺少 `cg.close()`，在 Windows + better-sqlite3 下导致 `afterEach` 的 `fs.rmSync` 报 `EBUSY`。
5. **修复 `resolution.test.ts`**：C/C++ e2e 测试中直接 `DatabaseConnection.open()` 了一个新连接但没有 `db.close()`，导致 Windows 文件锁定。
6. **运行完整测试**：
   - 之前：14 失败（8 个与本次修改相关 + 6 个已知预存在）
   - 之后：6 失败（全部来自 `mcp-initialize.test.ts` / `mcp-roots.test.ts`，CLAUDE.md 已记录为 Windows 预存在）
   - 修复了 8 个测试失败
7. **构建**：`npm run build` 成功
8. **git**：用户要求不自动提交，变更已 staged，等待手动提交

### 待提交的文件

```
M CHANGELOG.md
M __tests__/frameworks-integration.test.ts
M __tests__/node-sqlite-backend.test.ts
M __tests__/resolution.test.ts
M __tests__/sqlite-backend.test.ts
```

---

## 2026-06-04 创建通用永久能力模板（给 Codex / 其他项目复用）

### 用户需求

> 我如果要在 Codex 或者 CC 其他项目用这个项目的能力，要怎么用？最好是形成一个 MD 文件我给 Codex 和 CC 的项目读取。最好也要让 Codex 形成永久能力。

### 完成内容

1. **创建 `docs/permanent-capability-template.md`** — 完整通用模板，包含：
   - 快速开始（Claude Code / Codex 双平台）
   - 项目初始化流程
   - 强制工作流程（开工九步）
   - Token 节省红线
   - 各平台文件位置对照表（Claude Code / Codex / Cursor / OpenCode）
   - 给 Codex 的永久提示词（AGENTS.md 格式）
   - 给 Claude Code 的永久提示词（CLAUDE.md 格式）
   - 任务类型策略速查表
   - 项目启动指令模板
   - 每次任务指令模板
   - .gitignore 建议

2. **创建 `docs/setup-guide.md`** — 新项目部署指南，包含：
   - 方案一：全自动部署（脚本，推荐）
   - 方案二：手动复制（适合自定义）
   - 方案三：只给 AI 发指令（最快但不持久）
   - 各平台配置速查（Claude Code / Codex / Cursor / OpenCode）
   - 验证是否生效的方法
   - FAQ

3. **创建 `~/.codex/AGENTS.md`** — Codex 全局永久规则，包含开工九步 + Token 红线 + 任务模板。Codex 每次启动都会读取。

4. **创建 `.ai/codex_rules.md`** — CodeGraph 项目的 Codex 专用规则（与 `claude_rules.md` 对应）。

5. **注册全局 memory** — `permanent-capability-template.md` 记录模板文件位置和使用方式。

### 新增文件

| 文件 | 说明 |
|------|------|
| `docs/permanent-capability-template.md` | 完整通用模板（~350 行） |
| `docs/setup-guide.md` | 新项目部署指南 |
| `.ai/codex_rules.md` | CodeGraph 项目的 Codex 规则 |
| `~/.codex/AGENTS.md` | Codex 全局永久提示词 |
| `~/.claude/projects/.../memory/permanent-capability-template.md` | 全局 memory |

### 重要修正（用户反馈）

**问题**：模板中所有安装指令都指向官方 npm 包 / GitHub 原始链接，但 Windows 上官方包缺少 FTS5 支持，必须使用本地 fork 的源码。

**修改**：
1. `docs/permanent-capability-template.md`：Claude Code / Codex 安装指令全部改为本地源码构建（`npm run build` + `npm link`），使用 `<workspace_root>/KnowledgeRoots/colbymchenry/codegraph` 路径。
2. `docs/setup-guide.md`：
   - 添加"前置条件"章节（先构建本地 CodeGraph）
   - 方案一：去掉 raw.githubusercontent.com 下载，改为本地脚本路径
   - 方案二 Step 3：去掉 `npm install -g @colbymchenry/codegraph`
   - 新增 FAQ：解释为什么不能用官方 npm 包
   - 新增 FAQ：换机器时 Workspace 路径不一样怎么办
3. `~/.codex/AGENTS.md`：安装指令改为本地源码构建，添加 better-sqlite3 fallback 说明。

### 全局配置状态

| 平台 | 文件 | 状态 |
|------|------|------|
| Claude Code | `~/.claude/CLAUDE.md` | ✅ 已有开工九步 |
| Codex | `~/.codex/AGENTS.md` | ✅ 本次新建 |

### 待提交

```
M  .ai/handover.md
M  .ai/task_log.md
A  .ai/codex_rules.md
A  docs/permanent-capability-template.md
A  docs/setup-guide.md
```

---

## 2026-06-04 Codex 全局 Repo Map First 能力验证与 MCP 接入

### 用户需求

> 建立 Codex 永久能力，适用于全部项目：先检查 CodeGraph，可用后用 CodeGraph 查询 symbol/调用链/相关文件，读取文件前列候选文件，修改前说明证据链，只做最小修改并运行最小相关测试，禁止无目标全仓 grep。

### 过程记录

1. 按 Repo Map First 流程读取 `.ai/handover.md`、`.ai/repo_map.md`、`.ai/codex_rules.md`、`.ai/token_saving_rules.md`、`.ai/task_log.md`。
2. 首次执行 `codegraph status` 失败：当前 PowerShell PATH 中没有 `codegraph`。
3. 按要求使用本地 fork 源码构建并链接：刷新 Machine/User PATH 后执行 `npm run build` 和 `npm link`。
4. 再次执行 `codegraph status` 成功：当前项目索引 up to date，backend 为 `better-sqlite3 - native (full WAL + FTS5)`。
5. 检查 `~/.codex/AGENTS.md`：全局 Repo Map First 永久规则已存在，包含本地源码构建、候选文件、证据链、最小读取和最小测试等要求。
6. 检查 `~/.codex/config.toml`：此前没有 `[mcp_servers.codegraph]`。
7. 执行 `codegraph install --target codex --location global -y`，为 Codex 写入全局 CodeGraph MCP 配置。

### 修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `~/.codex/config.toml` | 修改 | 添加 `[mcp_servers.codegraph]`，command 为 `codegraph`，args 为 `["serve", "--mcp"]` |
| `.ai/task_log.md` | 修改 | 记录本次全局能力验证与 MCP 接入 |
| `.ai/handover.md` | 修改 | 更新当前状态 |

### 验证结果

- `codegraph status` ✅：206 files, 3,267 nodes, 11,048 edges，索引 up to date。
- `Select-String ~/.codex/config.toml` ✅：确认存在 `[mcp_servers.codegraph]`、`command = "codegraph"`、`args = ["serve", "--mcp"]`。

### 后续注意

- 需要重启 Codex agent 后，新的 CodeGraph MCP server 配置才会在工具列表中生效。
- 当前 session 可以使用 CLI fallback；新 session 应优先使用 MCP 暴露的 `codegraph_*` 工具。

---

## 2026-06-04 GitHub CLI 安装 + Codex 按需索引启动守卫

### 用户需求

1. 安装 GitHub CLI。
2. 让所有 Codex 项目开始前自动用 CodeGraph 建立索引，但避免反复重建索引。
3. 提交相关 repo 变更到远程仓库，并写清楚描述。

### 过程记录

1. 按 Repo Map First 流程读取 `.ai/handover.md`、`.ai/repo_map.md`、`.ai/codex_rules.md`、`.ai/token_saving_rules.md`、`.ai/task_log.md`，并执行 `codegraph status`。
2. 检查 `gh --version` 发现 GitHub CLI 不可用；`winget install GitHub.cli` 因 winget 源数据缺失失败。
3. 改用 GitHub CLI 官方 release zip，安装 `gh` v2.93.0 到 `~/.local/gh/bin`，并把该目录追加到 User PATH。
4. `gh auth status` 显示尚未登录；普通 `git push` 仍可尝试使用现有 git 凭据，PR/gh API 操作需要用户后续运行 `gh auth login`。
5. 用 CodeGraph 查询 `Codex` 和 `install`，确认产品级 Codex 安装入口在 `src/installer/targets/codex.ts`，但该 target 按 issue #529 不再写 AGENTS 指南，因此本次不改安装器代码。
6. 更新 `~/.codex/AGENTS.md`：把 Step 2 改成启动守卫，先 `codegraph status --json .`，已有索引只在有 `pendingChanges` 时 `codegraph sync .`，未初始化才 `codegraph init .`。
7. 更新 `docs/permanent-capability-template.md` 和 `docs/setup-guide.md`：把旧的 `codegraph init . && codegraph index .` 流程改为按需索引，明确 `codegraph index .` 只用于强制重建/索引损坏/重大 schema 或提取器变更。

### 修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `~/.codex/AGENTS.md` | 修改 | Codex 全局按需索引启动守卫 |
| `docs/permanent-capability-template.md` | 修改 | 通用模板改为 status/sync/init 条件流程 |
| `docs/setup-guide.md` | 修改 | 新项目部署指南改为按需索引，新增避免重复重建 FAQ |
| `.ai/task_log.md` | 修改 | 记录本次任务 |
| `.ai/handover.md` | 修改 | 更新当前状态 |

### 提交范围说明

本次计划提交 repo 内相关文件：`.ai/handover.md`、`.ai/task_log.md`、`docs/permanent-capability-template.md`、`docs/setup-guide.md`。

未跟踪的 `AGENTS.md` 和 `.agents/` 暂不纳入本次提交，因为它们不是本轮创建/修改的文件，且范围可能需要用户单独确认。

### 验证结果

- `gh --version` ✅：v2.93.0。
- `codegraph status --json` ✅：initialized=true，pendingChanges added/modified/removed 均为 0。
- `git diff --check` ✅：无 whitespace error（仅 CRLF 提示）。
- `npm run build` ✅：tsc + copy-assets 成功。
- `git commit` ✅：创建本地提交 `docs: add Codex on-demand CodeGraph indexing`。
- `git push origin main` ✅：重试后成功推送 `main -> main`。注意：`gh auth status` 仍显示尚未登录；普通 git push 已可用，但 PR/gh API 操作仍需要用户运行 `gh auth login`。
