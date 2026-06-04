# CodeGraph 永久能力模板：代码库地图优先

> **一句话目标**：不要让 AI 每次都像第一次见到这个项目。
>
> **适用对象**：Claude Code、Codex CLI、Cursor、OpenCode，以及任何支持 MCP 或 CLI 的 AI 编程 Agent。
>
> **核心原则**：MCP 是入口，CLI 是手动挡，`.ai/` 是长期记忆。

---

## 快速开始（复制即用）

把下面这段放到你的项目里，AI 就会自动遵守「代码库地图优先」规则。

### Claude Code

```bash
# 1. 在项目根目录创建 .ai/ 目录
mkdir -p .ai

# 2. 复制本模板中的内容到以下文件
# .ai/repo_map.md      ← 项目结构、技术栈、核心调用链
# .ai/handover.md      ← 当前状态、已知坑
# .ai/claude_rules.md  ← Agent 规则（开工九步）
# .ai/token_saving_rules.md  ← Token 红线
# .ai/task_log.md      ← 任务日志
# .ai/decisions.md     ← 架构决策

# 3. 使用本地 fork 的 CodeGraph（Windows 需要源码中的 better-sqlite3 fallback）
#    在你的环境中，<workspace_root> 可能不同（如 C:\Workspace 或 ~/Workspace）
cd <workspace_root>/KnowledgeRoots/colbymchenry/codegraph
npm run build                                 # 构建本地版本
npm link                                      # 全局链接，让 npx 能找到

# 4. 回到你的项目，接入 Claude Code MCP
npx codegraph install                         # 写入 ~/.claude/mcp.json
npx codegraph init .                          # 初始化索引
npx codegraph index .                         # 索引项目
```

### Codex CLI

```bash
# 1. 使用本地 fork 的 CodeGraph（Windows 需要源码中的 better-sqlite3 fallback）
#    在你的环境中，<workspace_root> 可能不同（如 C:\Workspace 或 ~/Workspace）
cd <workspace_root>/KnowledgeRoots/colbymchenry/codegraph
npm run build                                      # 构建本地版本
npm link                                           # 全局链接

# 2. 接入 Codex
codegraph install  # 自动写入 ~/.codex/config.toml

# 3. 在项目根目录创建 AGENTS.md
cat > AGENTS.md << 'EOF'
# Permanent Instruction: Repo Map First

You must use a Repo Map First workflow for every software project.

Before exploring the repository with grep/find/read, first check whether a
CodeGraph/MCP/code-index tool is available. If available, use it to query
symbols, callers, callees, imports, routes, related files, and impact ranges.

If CodeGraph is not available, use the project's `.ai/repo_map.md`,
`.ai/handover.md`, and `.ai/task_log.md` first. If these files do not exist,
create them.

Do not blindly scan the entire repository. Do not perform broad grep/read loops
unless structural lookup failed and you explain why.

For every task:
1. Read `.ai/handover.md`, `.ai/repo_map.md`, and `.ai/codex_rules.md` first.
2. Query the code graph before reading many files.
3. Produce a candidate file list with reasons.
4. Read the minimum necessary files.
5. Explain the evidence chain before patching.
6. Make the smallest safe patch.
7. Run the smallest relevant test.
8. Update `.ai/task_log.md` and `.ai/handover.md`.
EOF

# 4. 初始化索引
codegraph init .
codegraph index .
```

---

## 项目初始化流程（每个新项目必须执行）

### Step 1：检查 CodeGraph 可用性

```bash
# CLI 检查
codegraph status

# 如果未安装（使用本地 fork，Windows 需要 better-sqlite3 fallback）
# 先确保本地 CodeGraph 已构建并 link：
#   cd <workspace_root>/KnowledgeRoots/colbymchenry/codegraph
#   npm run build && npm link
codegraph install                     # 自动接入支持的 Agent
codegraph init .
codegraph index .

# 如果已安装但索引过期
codegraph sync
```

### Step 2：建立 `.ai/` 长期记忆目录

```text
.ai/
  repo_map.md          ← 项目结构、技术栈、核心模块、关键调用链
  handover.md          ← 当前目标、已完成、未完成、关键文件、已知坑
  task_log.md          ← 任务过程记录
  decisions.md         ← 架构决策记录（ADR 格式）
  token_saving_rules.md  ← Token 节省红线
  claude_rules.md      ← Claude Code 项目级规则
  codex_rules.md       ← Codex 项目级规则
  MEMORY.md            ← 索引：快速查阅目录
```

### Step 3：生成 `repo_map.md`

每次进入新项目，AI 应该优先提取以下信息填入 `repo_map.md`：

```markdown
# Repo Map

## 项目目标
（一句话描述这个项目是做什么的）

## 技术栈
| 层面 | 技术 |
|------|------|
| 语言 | |
| 运行时 | |
| 框架 | |
| 数据库 | |
| 测试 | |
| 构建 | |

## 关键目录
```
（列出核心目录和用途）
```

## 核心入口
| 入口 | 文件 | 说明 |
|------|------|------|
| | | |

## 构建/运行/测试命令
```bash
```

## 重要调用链
```
（核心流程的调用链）
```

## 高风险区域
| 区域 | 风险 | 注意事项 |
|------|------|----------|
| | | |

## 最近一次 CodeGraph 状态
（由 `codegraph status` 输出更新）
```

---

## 强制工作流程（开工九步）

以后 AI 接到任何开发任务时，必须按这个顺序执行：

```text
Step 1：读取长期记忆
    → .ai/handover.md → .ai/repo_map.md → .ai/*_rules.md → .ai/token_saving_rules.md

Step 2：检查 CodeGraph/MCP 可用性
    → codegraph status → 必要时 codegraph sync

Step 3：先查结构，再读文件
    → codegraph_explore (Primary) → codegraph_node (Secondary)
    → codegraph_callers / codegraph_callees / codegraph_impact

Step 4：建立候选文件列表
    → 读取文件前必须列出 Candidate Files 表格

Step 5：最小读取
    → 一次最多 3-8 个关键文件，大文件只读片段

Step 6：修改前给证据链
    → 必须说明 Evidence Chain

Step 7：最小 patch
    → 只改必要文件，避免顺手重构

Step 8：最小测试
    → 运行相关单测 / 类型检查 / lint，不要一上来跑全量

Step 9：更新 `.ai/`
    → 更新 .ai/task_log.md 和 .ai/handover.md
```

---

## Token 节省红线

```text
禁止：
❌ 无目标全仓 grep
❌ 在没有先调用 CodeGraph 的情况下直接 Read 大量文件
❌ 连续读取大量文件但不总结
❌ 重复读取 .ai/ 已记录的信息
❌ 没有证据链就 patch
❌ 为了"理解项目"而读完整仓库

允许：
✅ 为了确认具体实现读取关键文件（3-8 个）
✅ 索引缺失时做有限 grep（必须记录原因到 task_log.md）
✅ 复杂重构前做更完整的 impact analysis
✅ 发现 .ai/ 过期时主动更新它
```

---

## 各平台文件位置对照表

| 平台 | 全局规则文件 | 项目级规则文件 | MCP 配置位置 |
|------|-------------|---------------|-------------|
| **Claude Code** | `~/.claude/CLAUDE.md` | `.ai/claude_rules.md` + `CLAUDE.md` | `~/.claude/mcp.json` |
| **Codex CLI** | `~/.codex/AGENTS.md` | `AGENTS.md` 或 `.ai/codex_rules.md` | `~/.codex/config.toml` |
| **OpenCode** | `~/.config/opencode/AGENTS.md` | `.ai/opencode_rules.md` | `~/.config/opencode/opencode.jsonc` |
| **Cursor** | — | `.cursor/rules/*.mdc` | `.cursor/mcp.json` |

> **注意**：CodeGraph 安装器（`codegraph install`）会自动写入以上所有平台的 MCP 配置，不需要手动编辑。

---

## 给 Codex 的永久提示词（写入 AGENTS.md）

```markdown
# Permanent Instruction: Repo Map First

You must use a Repo Map First workflow for every software project.

Before exploring the repository with grep/find/read, first check whether a
CodeGraph/MCP/code-index tool is available. If available, use it to query
symbols, callers, callees, imports, routes, related files, and impact ranges.

If CodeGraph is not available, use the project's `.ai/repo_map.md`,
`.ai/handover.md`, and `.ai/task_log.md` first. If these files do not exist,
create them.

Do not blindly scan the entire repository. Do not perform broad grep/read loops
unless structural lookup failed and you explain why.

For every task:
1. Read `.ai/handover.md`, `.ai/repo_map.md`, and `.ai/codex_rules.md` first.
2. Query the code graph before reading many files.
3. Produce a candidate file list with reasons.
4. Read the minimum necessary files.
5. Explain the evidence chain before patching.
6. Make the smallest safe patch.
7. Run the smallest relevant test.
8. Update `.ai/task_log.md` and `.ai/handover.md`.

Your goal is not only to finish the current task, but also to improve the
permanent project memory so future sessions spend fewer tokens.
```

---

## 给 Claude Code 的永久提示词（写入 CLAUDE.md 或 ~/.claude/CLAUDE.md）

```markdown
# Global Claude Code Instructions

## 代码库地图优先（Repo Map First）

以后处理任何项目，不要一上来全仓 grep / find / Read。

必须优先使用 CodeGraph/MCP/代码索引工具来定位：
- symbol / class / function
- callers / callees
- imports / exports
- routes / related files / impact range

如果 CodeGraph 不可用，先读取项目里的：
- `.ai/handover.md`
- `.ai/repo_map.md`
- `.ai/claude_rules.md`
- `.ai/task_log.md`

如果这些文件不存在，就创建它们。

## 开工九步

1. 读取 `.ai/` 长期记忆
2. 检查 CodeGraph/MCP 是否可用
3. 先查结构关系，再读代码文件
4. 列出候选文件和理由
5. 只读取最小必要文件集
6. 修改前说明证据链
7. 只做最小安全 patch
8. 运行最小相关测试
9. 任务结束后更新 `.ai/task_log.md` 和 `.ai/handover.md`

## Token 节省红线

- 不允许无目标全仓 grep
- 不允许一次性 Read 超过 8 个文件
- 修改前必须先列出候选文件和理由
- 优先查询 CodeGraph / repo map
- 大文件只读取相关片段
- 已经记录在 `.ai/` 的信息不得重复探索

目标不是只完成当前任务，而是让这个项目以后越来越省 Token、
越来越容易继续。
```

---

## 任务类型策略速查表

### Bug 修复
```text
error/log → symbol search → callers/callees → candidate files → minimal read → evidence → patch → test
```

### 新功能开发
```text
similar feature → module pattern → files to extend → minimal design → patch → test → docs
```

### 重构
```text
impact analysis → risk list → small refactor plan → patch in phases → test each phase
```

### 新增语言/框架支持
```text
语法定义 → extractor → resolver → tests → benchmark (small/medium/large repo, ≥3 flows) → docs
```

---

## 项目启动模板（给 AI 的第一次指令）

新项目第一次让 AI 接手时，直接发：

```markdown
请先为这个项目建立"代码库地图优先"的永久能力：

1. 检查 CodeGraph/MCP/CLI 是否可用。
2. 如果可用，初始化或同步项目索引。
3. 创建 `.ai/` 目录。
4. 生成 `.ai/repo_map.md`、`.ai/handover.md`、`.ai/claude_rules.md`、`.ai/token_saving_rules.md`。
5. 以后所有任务都必须先使用 CodeGraph 或 `.ai/`，禁止无目标全仓 grep。
6. 当前先不要改业务代码，只建立项目理解和长期规则。
```

---

## 每次任务提示模板

```markdown
请按"Repo Map First"流程处理这个任务：

任务：xxx

要求：
1. 先读取 `.ai/handover.md`、`.ai/repo_map.md`、`.ai/claude_rules.md`。
2. 优先使用 CodeGraph/MCP 查询 symbol、调用链、相关文件。
3. 先列出候选文件和理由，再读取文件。
4. 只做最小必要修改。
5. 修改前说明证据链。
6. 修改后运行最小相关测试。
7. 最后更新 `.ai/task_log.md` 和 `.ai/handover.md`。
```

---

## .gitignore 建议

```gitignore
# CodeGraph local index
.codegraph/

# AI working memory: temporary/session files (core .ai/*.md are committed)
.ai/tmp/
.ai/cache/
.ai/session_*.md
```

是否提交 `.ai/`：
- **个人项目**：建议提交核心 `.ai/*.md`
- **团队项目**：只提交共识型文档（repo_map.md / decisions.md）
- **商业项目**：注意不要写入密钥、客户隐私等敏感信息

---

## 最终原则

```text
不要让 AI 每次都像第一次见到这个项目。

CodeGraph / MCP 负责实时结构查询。
.ai/ 负责长期项目记忆。
AI Agent 负责基于结构和记忆做最小、安全、可验证的修改。

每个项目都应该有代码地图。
每个 Agent 都应该先问地图，再读文件。
每次任务都应该沉淀经验。
每次 session 都应该比上一次更省 Token。
```
