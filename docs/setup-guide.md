# CodeGraph 永久能力：新项目部署指南

> 把「代码库地图优先」的工作方式注册到**每一个**项目中。
>
> ⚠️ **重要**：使用本地 fork 的 CodeGraph 源码（`https://github.com/othercat/codegraph`），
> 而非官方 npm 包。Windows 环境下官方包缺少 better-sqlite3 fallback，会导致
> `codegraph init` 报 `no such module: fts5`。

---

## 前置条件

确保本地 CodeGraph 源码已构建：

```bash
# 在你的环境中，<workspace_root> 可能不同
# 例如 Windows: C:\Workspace   或   macOS/Linux: ~/Workspace
cd <workspace_root>/KnowledgeRoots/colbymchenry/codegraph

# 构建本地版本（需要 Node.js 20~24）
npm ci
npm run build

# 全局链接，让其他项目能用 npx codegraph 调用
npm link

# 验证
node dist/bin/codegraph.js status
```

> 在你的环境中，路径可能是：
> - **Windows (3060 主机)**：`C:\Workspace\KnowledgeRoots\colbymchenry\codegraph`
> - **macOS/Linux**：`~/Workspace/KnowledgeRoots/colbymchenry/codegraph`
> - **WSL2**：`/mnt/c/Workspace/KnowledgeRoots/colbymchenry/codegraph`

---

## 方案一：全自动部署（推荐）

运行本地脚本，一键在新项目中建立 `.ai/` 体系并接入 CodeGraph。

### Windows (PowerShell)

```powershell
# 1. 进入你的新项目
cd C:\path\to\your\project

# 2. 运行本地部署脚本
#    修改下面的路径为你实际的 Workspace 路径
& "C:\Workspace\KnowledgeRoots\colbymchenry\codegraph\scripts\init-ai-memory.ps1"

# 3. 检查 CodeGraph
npx codegraph status --json .
```

### macOS / Linux / WSL2 (Bash)

```bash
# 1. 进入你的新项目
cd /path/to/your/project

# 2. 运行本地部署脚本
#    修改下面的路径为你实际的 Workspace 路径
bash ~/Workspace/KnowledgeRoots/colbymchenry/codegraph/scripts/init-ai-memory.sh

# 3. 检查 CodeGraph
npx codegraph status --json .
```

脚本会完成以下工作：
- 创建 `.ai/` 目录和 7 个核心文件
- 按需建立项目索引：已有索引只 `codegraph sync .`，未初始化才 `codegraph init .`
- 更新 `.gitignore`

---

## 方案二：手动复制（适合想自定义的项目）

### Step 1：复制模板文件

从本地 CodeGraph 仓库复制以下文件到你的新项目：

```
<workspace_root>/KnowledgeRoots/colbymchenry/codegraph/  →  你的新项目
├── docs/permanent-capability-template.md   (参考用，不需要复制)
├── docs/setup-guide.md                     (参考用，不需要复制)
├── .ai/repo_map.md                         → 你的项目/.ai/repo_map.md
├── .ai/handover.md                         → 你的项目/.ai/handover.md
├── .ai/claude_rules.md                     → 你的项目/.ai/claude_rules.md
├── .ai/codex_rules.md                      → 你的项目/.ai/codex_rules.md
├── .ai/token_saving_rules.md               → 你的项目/.ai/token_saving_rules.md
├── .ai/task_log.md                         → 你的项目/.ai/task_log.md
├── .ai/decisions.md                        → 你的项目/.ai/decisions.md
└── .ai/MEMORY.md                           → 你的项目/.ai/MEMORY.md
```

### Step 2：填写项目信息

把 `.ai/repo_map.md` 中的占位符替换为实际项目信息：
- 项目目标
- 技术栈
- 关键目录
- 核心入口
- 构建/测试命令

### Step 3：安装 CodeGraph

```bash
# 确保本地 CodeGraph 已构建并 link（见"前置条件"）
# 然后进入你的新项目
cd /path/to/your/project

# 接入你的 AI Agent
codegraph install

# 按需建立索引，避免反复重建
codegraph status --json .
codegraph sync .       # 仅当 pendingChanges 有新增/修改/删除时运行
codegraph init .       # 仅在未初始化/无 .codegraph/ 时运行；init 会建立初始索引
```

### Step 4：更新 .gitignore

```gitignore
# CodeGraph local index
.codegraph/

# AI temporary files
.ai/tmp/
.ai/cache/
.ai/session_*.md
```

### Step 5：提交 .ai/ 到 git

```bash
git add .ai/ .gitignore
git commit -m "chore: add .ai/ permanent capability template"
```

---

## 方案三：只给 AI 发指令（最快，但不持久）

如果你只是临时想让 AI 遵循规则，不需要建立 `.ai/` 文件，直接发这个指令：

```markdown
请按"代码库地图优先"流程工作：

1. 先检查 CodeGraph 是否可用（`codegraph status --json .`），不可用则说明原因。
2. 如果项目已有索引，只在有变更时运行 `codegraph sync .`；如果没有索引，才运行 `codegraph init .`。
3. 如果可用，用 CodeGraph 查询 symbol、调用链、相关文件来定位问题。
4. 如果没有 CodeGraph，先搜索项目结构，理解核心模块和入口。
5. 读取文件前先列出候选文件和理由。
6. 一次最多读 3-8 个文件，大文件只读相关片段。
7. 修改前说明证据链。
8. 只做最小必要修改。
9. 修改后运行最小相关测试验证。

禁止无目标全仓 grep。
```

---

## 各平台配置速查

### Claude Code

**全局规则**（已配置，所有项目自动生效）：
- 文件：`~/.claude/CLAUDE.md`
- 状态：✅ 已包含"开工九步"和 CodeGraph 使用规范

**项目级规则**（每个项目单独配置）：
- 文件：`.ai/claude_rules.md`
- 作用：在全局规则基础上叠加项目特化约束

### Codex CLI

**全局规则**（已配置，所有项目自动生效）：
- 文件：`~/.codex/AGENTS.md`
- 状态：✅ 已包含"代码库地图优先"永久提示词

**项目级规则**（每个项目单独配置）：
- 文件：`AGENTS.md`（项目根目录）或 `.ai/codex_rules.md`
- 作用：覆盖/补充全局规则

### Cursor

**项目级规则**（Cursor 不支持全局规则）：
- 文件：`.cursor/rules/codegraph.mdc`
- 安装（需先本地构建 CodeGraph，见"前置条件"）：
  ```bash
  codegraph install  # 自动写入 .cursor/mcp.json
  ```

### OpenCode

**全局规则**：
- 文件：`~/.config/opencode/AGENTS.md`
- 安装（需先本地构建 CodeGraph，见"前置条件"）：
  ```bash
  codegraph install  # 自动写入 ~/.config/opencode/opencode.jsonc
  ```

---

## 验证是否生效

下次进入任何项目时，观察 AI 是否自动：

1. ✅ 先读取 `.ai/handover.md` 和 `.ai/repo_map.md`
2. ✅ 检查 `codegraph status`
3. ✅ 优先调用 `codegraph_explore` 而不是 grep
4. ✅ 列出 Candidate Files 后再读取
5. ✅ 修改前给 Evidence Chain
6. ✅ 任务结束更新 `.ai/task_log.md`

如果 AI 没有自动遵循，直接发这条指令提醒：

```
请遵守 Repo Map First 规则：先读 .ai/，再查 CodeGraph，最后才读文件。
```

---

## 常见问题

**Q：为什么不能用 `npm install -g @colbymchenry/codegraph` 安装？**
A：官方 npm 包的 `node:sqlite` 在 Windows 上缺少 FTS5 支持，会导致 `codegraph init` 失败。本地 fork 已添加 better-sqlite3 fallback 修复此问题。

**Q：我的项目不是 Node 项目，能用 CodeGraph 吗？**
A：可以。CodeGraph 支持 30+ 种语言（Python、Go、Rust、Java、C/C++ 等）。安装只需要 Node.js 运行时来运行 CodeGraph 本身，与你的项目语言无关。

**Q：团队项目中，`.ai/` 文件应该提交到 git 吗？**
A：建议提交核心文件（repo_map.md、decisions.md、token_saving_rules.md），不提交临时文件（.ai/tmp/、task_log.md 可选）。

**Q：Codex 和 Claude Code 同时使用时，规则会冲突吗？**
A：不会。Codex 读取 `AGENTS.md` / `~/.codex/AGENTS.md`，Claude Code 读取 `CLAUDE.md` / `~/.claude/CLAUDE.md`。两套规则内容一致，只是存放位置不同。

**Q：已有项目如何补建 `.ai/`？**
A：直接进入项目根目录，执行方案一的全自动部署脚本，或手动复制模板文件后运行启动守卫：先 `codegraph status --json .`，已有索引则 `codegraph sync .`，没有索引才 `codegraph init .`。

**Q：如何避免每次打开 Codex 都重建索引？**
A：把 `codegraph status --json .` 当作启动守卫。`pendingChanges` 全为 0 时不要运行任何索引命令；有变更时运行 `codegraph sync .`；只有未初始化或 `.codegraph/` 不存在时才运行 `codegraph init .`。`codegraph index .` 只用于用户明确要求强制重建、索引损坏、或 schema/提取器重大变化后的维护场景。

**Q：CodeGraph 安装后没有生效？**
A：检查 MCP 配置是否正确写入：
- Claude Code：`~/.claude/mcp.json` 中应有 codegraph 条目
- Codex：`~/.codex/config.toml` 中应有 `[mcp_servers.codegraph]`
- 重启 AI Agent 或重新加载配置

**Q：换了一台机器，Workspace 路径不一样怎么办？**
A：只需要修改路径中的 `<workspace_root>` 部分。CodeGraph 源码目录结构（`KnowledgeRoots/colbymchenry/codegraph`）保持不变。例如：
- 原机器：`C:\Workspace\KnowledgeRoots\colbymchenry\codegraph`
- 新机器：`D:\Projects\KnowledgeRoots\colbymchenry\codegraph`
