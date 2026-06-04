# Repo Map: CodeGraph

## 项目目标

CodeGraph 是一个**本地优先**的代码智能库 + CLI + MCP 服务器。它用 tree-sitter 解析代码，将 symbols / edges / files 存入 SQLite (FTS5)，通过 MCP 暴露知识图谱给 AI Agent（Claude Code、Cursor、Codex CLI、OpenCode 等）。

核心价值：让 AI Agent **先查结构地图，再读最小必要文件**，减少无目标全仓 grep/read，降低 token 消耗和工具调用次数。

官方 benchmark 口径（7 个真实项目）：平均约 16% cheaper、47% fewer tokens、22% faster、58% fewer tool calls。

## 技术栈

| 层面 | 技术 |
|------|------|
| 语言 | TypeScript (target ES2020+) |
| 运行时 | Node.js >=20.0.0 <25.0.0（硬退出在 25.x） |
| 解析器 | tree-sitter (web-tree-sitter + tree-sitter-wasms) |
| 数据库 | SQLite，驱动：better-sqlite3（native，优先）/ node-sqlite3-wasm（fallback） |
| FTS | FTS5 |
| CLI | commander |
| UI | @clack/prompts |
| 测试 | vitest |
| 构建 | tsc + 自定义 copy-assets |
| 分发 | npm（thin-installer + per-platform bundle） |

## 关键目录

```
src/
  index.ts              # 公共 API — CodeGraph 类，库用户唯一入口
  types.ts              # NodeKind / EdgeKind 枚举，全局类型定义
  bin/
    codegraph.ts        # CLI 入口（commander），子命令：install/init/uninit/index/sync/status/query/files/context/affected/serve
    node-version-check.ts  # Node 25.x 硬退出检查
  db/
    DatabaseConnection.ts  # SQLite 连接管理（native/wasm 自动选择）
    QueryBuilder.ts        # 预编译语句构建
    schema.sql             # 数据库 schema（FTS5 + nodes/edges/files 表）
  extraction/
    ExtractionOrchestrator.ts  # 解析调度主控
    parse-worker.ts            # 重解析走子线程
    languages/                 # 各语言提取器（一语言一文件）
    wasm/                      # tree-sitter grammar WASM 文件
    svelte-extractor.ts
    vue-extractor.ts
    liquid-extractor.ts
    dfm-extractor.ts           # Delphi
  resolution/
    ReferenceResolver.ts       # 引用解析总控
    import-resolver.ts         # import/require 路径解析
    path-aliases.ts            # tsconfig path aliases + cargo workspace globs
    name-matcher.ts            # 名称匹配
    callback-synthesizer.ts    # 回调/动态分发边合成
    frameworks/                # 各框架路由/引用解析（Express/Laravel/Rails/FastAPI/Django/Flask/Spring/Gin/Axum/ASP.NET/Vapor/ReactRouter/SvelteKit/Vue/Nuxt/Cargo）
  graph/
    GraphTraverser.ts      # BFS/DFS、impact radius、path finding
    GraphQueryManager.ts   # 高层查询封装
  context/
    ContextBuilder.ts      # markdown/JSON 输出格式化
  search/
    full-text query parser + FTS5 helpers
  sync/
    FileWatcher.ts         # 原生 FSEvents/inotify/RDCW + debounce + filter
    git-hook helpers
  mcp/
    MCPServer.ts           # MCP 服务器主控
    tools.ts               # MCP tools 定义（codegraph_explore / codegraph_node / codegraph_callers / codegraph_callees / codegraph_impact / codegraph_files / codegraph_search）
    transport.ts           # 传输层
    server-instructions.ts # MCP initialize 响应中的 agent 指导（工具使用方式的唯一真源）
  installer/
    targets/
      registry.ts          # 支持的 Agent 列表
      types.ts             # AgentTarget 接口
      claude.ts            # Claude Code 目标
      cursor.ts            # Cursor 目标
      codex.ts             # Codex CLI 目标
      opencode.ts          # OpenCode 目标
      toml.ts              # 手写 TOML 序列化器（Codex 用）
    instructions-template.ts  # 仅保留 <!-- CODEGRAPH_START/END --> 标记，用于清理旧版残留
  ui/
    terminal UI（shimmer progress, worker）
__tests__/
  各类测试文件（与 src/ 镜像）
  evaluation/
    runner.ts + test-cases.ts  # 合成项目评测（npm run eval）
  integration/               # 集成测试
```

## 核心入口

| 入口 | 文件 | 说明 |
|------|------|------|
| 库 API | `src/index.ts` | `CodeGraph` 类：init/open/close, indexAll, sync, searchNodes, getCallers/getCallees, getImpactRadius, buildContext, watch/unwatch |
| CLI | `src/bin/codegraph.ts` | commander 子命令 |
| MCP Server | `src/mcp/MCPServer.ts` | serve --mcp |
| 安装器 | `src/installer/targets/` | codegraph install 入口 |

## 配置文件

| 文件 | 用途 |
|------|------|
| `package.json` | 版本、脚本、依赖、engines |
| `tsconfig.json` | TypeScript 编译配置 |
| `src/db/schema.sql` | SQLite schema（构建时 copy 到 dist/） |
| `vitest.config.ts` | 测试配置 |
| `.codegraph/` | 项目本地索引（运行期生成，gitignore） |

## 构建/运行/测试命令

```bash
# 构建
npm run build           # tsc + copy schema.sql + *.wasm → dist/，chmod bin
npm run dev             # tsc --watch
npm run clean           # rm -rf dist

# 测试
npm test                # vitest run（全部）
npm run test:watch
npm run test:eval       # 仅 __tests__/evaluation/
npm run eval            # build → runner.ts via tsx

# CLI 运行
npm run cli             # build → 运行 dist/bin/codegraph.js

# 单文件/模式测试
npx vitest run __tests__/installer-targets.test.ts
npx vitest run __tests__/extraction.test.ts -t "TypeScript"
```

## 重要调用链

### 索引流程

```
files → ExtractionOrchestrator (tree-sitter) → DB (nodes/edges/files)
              ↓
       ReferenceResolver (imports, name-matching, framework patterns)
              ↓
       GraphQueryManager / GraphTraverser (callers, callees, impact)
              ↓
       ContextBuilder (markdown/JSON for AI consumption)
```

### MCP 工具调用链

```
Agent → MCP transport → MCPServer → tools.ts → GraphQueryManager / GraphTraverser / ContextBuilder
                                      ↓
                              server-instructions.ts（initialize 响应）
```

### 安装器流程

```
codegraph install → targets/registry.ts → 各 target (claude/cursor/codex/opencode)
                                          → 写入对应 Agent 的 MCP 配置
                                          → 清理旧版 instructions block（不再写入新 block）
```

### 探索流程（agent 最常用）

```
codegraph_explore (symbol bag) → buildFlowFromNamedSymbols → 返回调用路径 + 源码片段
                                 ↓
                        歧义消解：segment/co-naming 区分；overload-aware
```

## NodeKind / EdgeKind

提取器和解析器必须使用的精确字符串：

- **NodeKind**: `file`, `module`, `class`, `struct`, `interface`, `trait`, `protocol`, `function`, `method`, `property`, `field`, `variable`, `constant`, `enum`, `enum_member`, `type_alias`, `namespace`, `parameter`, `import`, `export`, `route`, `component`
- **EdgeKind**: `contains`, `calls`, `imports`, `exports`, `extends`, `implements`, `references`, `type_of`, `returns`, `instantiates`, `overrides`, `decorates`

## 高风险区域

| 区域 | 风险 | 注意事项 |
|------|------|----------|
| `src/installer/targets/` | 任何改动影响所有 Agent 安装 | 必须加 `installer-targets.test.ts` 参数化测试覆盖；这是 0.7.x 多 Agent  rollout 的关键路径 |
| `src/mcp/server-instructions.ts` | Agent 使用工具的指导唯一真源 | 修改后影响所有接入 Agent 的行为；issue #529 后不再在其他地方重复 |
| `src/mcp/tools.ts` | explore 预算函数 | `getExploreBudget` 和 `getExploreOutputBudget` 的两个预算必须随 repo size 单调递增；maxCharsPerFile 大 tier 不能小于小 tier |
| `src/resolution/callback-synthesizer.ts` | 动态分发边合成 | 部分覆盖比不覆盖更糟；必须端到端闭合完整 flow 再 ship |
| `src/extraction/languages/` | 新增语言支持 | 必须做 small/medium/large 真实 repo 验证，≥3 个 flow prompt，A/B 测试 |
| `CHANGELOG.md` | 发布流程 | 默认写入 `[Unreleased]` 下，不要预创建 `[X.Y.Z]` 块；`prepare-release.mjs` 会自动提升 |
| 跨平台 | Windows/Linux/macOS 差异 | 路径解析、驱动号、敏感路径、`%APPDATA%`、CRLF；必须平台门控测试 |

## 不要随意修改的文件

- `src/db/schema.sql` — 修改后影响所有新创建的索引；旧索引需要重建
- `src/types.ts` — NodeKind/EdgeKind 是全局契约，修改影响所有提取器和解析器
- `src/mcp/server-instructions.ts` — 单点真源，agent-facing guidance
- `CHANGELOG.md` 中的已发布版本块 — 只改 `[Unreleased]`

## 最近一次 CodeGraph 状态

（由每次 session 结束时的 `codegraph status` 输出更新）
