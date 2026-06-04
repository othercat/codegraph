# Claude Rules: CodeGraph

> 本项目是 CodeGraph 自身 — 一个用 TypeScript/Node 编写的本地代码知识图谱工具。
> 以下规则适用于**在此仓库内进行任何开发工作**的 Claude Code session。

## Mandatory（必须遵守）

### 开工九步（必须按顺序执行）

1. **读取长期记忆**：优先读取 `.ai/handover.md`、`.ai/repo_map.md`、`.ai/claude_rules.md`、`.ai/token_saving_rules.md`。
2. **检查 CodeGraph / MCP 可用性**：调用 `codegraph_status`（或 `codegraph status`）检查索引状态。已索引 → 继续；未索引 → `codegraph init && codegraph index .`；索引过期 → `codegraph sync`。
3. **先查结构，再读文件**：任何涉及"找代码 / 理解流程 / 追踪调用 / 分析影响"的任务，必须先调用 CodeGraph 工具：
   - `codegraph_explore`（Primary）— symbol bag 描述 flow，返回调用路径 + 源码片段
   - `codegraph_node`（Secondary）— 获取完整函数体、caller/callee trail
   - `codegraph_callers` / `codegraph_callees` — 单向追踪
   - `codegraph_impact` — 重构前影响分析
   - `codegraph_search` — 只有模糊关键词、不知道精确 symbol name 时使用
   - `codegraph_files` — 获取项目文件结构
4. **建立候选文件列表**：读取文件前，必须先列出：
   ```markdown
   ## Candidate Files
   | File | Reason | Confidence |
   |------|--------|------------|
   ```
5. **最小读取**：高置信文件优先；一次最多读取 3–8 个关键文件；大文件只读相关片段（`offset`/`limit`）。
6. **修改前给证据链**：
   ```markdown
   ## Evidence Chain
   1. 用户问题对应入口是 xxx。
   2. CodeGraph 显示 xxx 调用了 yyy。
   3. ...
   ```
7. **最小 patch**：只改必要文件，避免顺手重构。优先小步修改，保持现有架构和风格。
8. **最小测试**：优先运行相关单测 / 相关脚本 / 类型检查 / lint / 最小启动验证。不要一上来跑全量慢测试，除非必要。
9. **更新 `.ai/`**：任务结束必须更新 `.ai/task_log.md` 和 `.ai/handover.md`。如发现新架构信息，更新 `.ai/repo_map.md` 和 `.ai/decisions.md`。

### 项目特化规则

- **Node engines**: `>=20.0.0 <25.0.0`。不要在 Node 25.x 上测试，会硬退出。
- **构建后必须验证 copy-assets**：任何新 SQL schema 或 grammar WASM 必须确认被 copy 到 `dist/`。`npm run build` 包含此步骤。
- **installer 改动必须有测试**：任何 `src/installer/targets/` 的修改必须在 `__tests__/installer-targets.test.ts` 中有对应参数化测试覆盖。
- **server-instructions.ts 是唯一真源**：修改 MCP 工具使用指导时只改 `src/mcp/server-instructions.ts`，不要在其他地方重复（issue #529）。
- **explore 预算单调性**：修改 `getExploreBudget` / `getExploreOutputBudget` 时，确保更大 tier 的 `maxCharsPerFile` 不小于更小 tier。
- **动态分发覆盖必须端到端**：添加 callback-synthesizer 或 framework resolver 时，必须闭合完整 flow，不能只桥接一半。部分覆盖比不覆盖更糟。
- **新语言/框架必须验证**：small/medium/large 真实 repo，≥3 个 flow prompt，A/B 测试，记录到 `docs/design/dynamic-dispatch-coverage-playbook.md`。
- **CHANGELOG 只写 `[Unreleased]`**：不要预创建 `[X.Y.Z]` 块。用户友好语言，不要内部文件名/函数名。
- **跨平台门控**：Windows 特有行为用 `it.runIf(process.platform === 'win32')(...)`，POSIX 用 `it.runIf(process.platform !== 'win32')(...)`。
- **Python 环境**：用户使用 anaconda3/miniconda3 作为 Python 包管理器（本项目为 Node 项目，此规则主要用于涉及 Python 脚本或 CI 的场景）。

## Forbidden（禁止）

- ❌ **无目标全仓 Grep**。必须先查 CodeGraph，只在 CodeGraph 返回空时 fallback。
- ❌ **在没有先调用 CodeGraph 的情况下直接 Read 大量文件**。
- ❌ **连续读取大量文件但不总结**。
- ❌ **重复读取 `.ai/` 已记录的信息**。
- ❌ **没有证据链就 patch**。
- ❌ **为了"理解项目"而读完整仓库**。`repo_map.md` 已有架构描述。
- ❌ **顺手重构整个项目**，除非用户明确要求。
- ❌ **改动与当前任务无关的大量文件**。
- ❌ **格式化整个仓库**，除非用户明确要求。
- ❌ **删除文件不说明理由**。
- ❌ **输出 .env、密钥、token、证书、私钥等敏感内容**。
- ❌ **在 CHANGELOG 中写内部文件路径或函数名**。
- ❌ **自动提交 git commit**，除非用户明确要求。

## Fallback 策略

如果 MCP 不可用：
1. CLI fallback: `codegraph status` → `codegraph sync` → `codegraph index .`
2. 使用 `.ai/repo_map.md`
3. 使用项目 README / docs
4. 有限 grep（必须记录原因到 `.ai/task_log.md`）
5. 不要反复做无意义重试

## 任务类型策略

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
