# Codex Rules: 代码库地图优先

> 本项目使用 CodeGraph 作为代码知识图谱工具。
> 以下规则适用于在此仓库中进行任何开发工作的 Codex session。

## Mandatory（必须遵守）

### 开工九步（必须按顺序执行）

1. **读取长期记忆**：优先读取 `.ai/handover.md`、`.ai/repo_map.md`、`.ai/codex_rules.md`、`.ai/token_saving_rules.md`。
2. **检查 CodeGraph / MCP 可用性**：调用 `codegraph status` 检查索引状态。已索引 → 继续；未索引 → `codegraph init && codegraph index .`；索引过期 → `codegraph sync`。
3. **先查结构，再读文件**：任何涉及"找代码 / 理解流程 / 追踪调用 / 分析影响"的任务，必须先调用 CodeGraph 工具：
   - `codegraph_explore`（Primary）— symbol bag 描述 flow
   - `codegraph_node`（Secondary）— 获取完整函数体、caller/callee trail
   - `codegraph_callers` / `codegraph_callees` — 单向追踪
   - `codegraph_impact` — 重构前影响分析
   - `codegraph_search` — 模糊关键词
4. **建立候选文件列表**：读取文件前，必须先列出 Candidate Files 表格
5. **最小读取**：高置信文件优先；一次最多读取 3–8 个关键文件；大文件只读相关片段
6. **修改前给证据链**
7. **最小 patch**：只改必要文件，避免顺手重构
8. **最小测试**：优先运行相关单测 / 脚本 / 类型检查 / lint
9. **更新 `.ai/`**：任务结束必须更新 `.ai/task_log.md` 和 `.ai/handover.md`

### 项目特化规则

- Node engines: `>=20.0.0 <25.0.0`。不要在 Node 25.x 上测试，会硬退出。
- 构建后必须验证 copy-assets：任何新 SQL schema 或 grammar WASM 必须确认被 copy 到 `dist/`
- installer 改动必须有测试：`__tests__/installer-targets.test.ts` 参数化测试覆盖
- server-instructions.ts 是唯一真源：修改 MCP 工具使用指导时只改这里
- explore 预算单调性：更大 tier 的 `maxCharsPerFile` 不能小于更小 tier
- 动态分发覆盖必须端到端：不能只桥接一半
- 新语言/框架必须验证：small/medium/large 真实 repo，≥3 flow prompt，A/B 测试
- CHANGELOG 只写 `[Unreleased]`：不要预创建 `[X.Y.Z]` 块
- 跨平台门控：Windows 特有行为用 `it.runIf(process.platform === 'win32')(...)`
- Python 环境：anaconda3/miniconda3

## Forbidden（禁止）

- ❌ 无目标全仓 Grep
- ❌ 没有证据链就 patch
- ❌ 重复读取 `.ai/` 已记录的信息
- ❌ 为了"理解项目"而读完整仓库
- ❌ 顺手重构整个项目
- ❌ 改动与任务无关的文件
- ❌ 格式化整个仓库
- ❌ 删除文件不说明理由
- ❌ 输出 .env、密钥、token 等敏感内容
- ❌ 在 CHANGELOG 中写内部文件名/函数名
- ❌ 自动提交 git commit

## Fallback 策略

如果 MCP 不可用：
1. CLI fallback: `codegraph status` → `codegraph sync` → `codegraph index .`
2. 使用 `.ai/repo_map.md`
3. 使用项目 README / docs
4. 有限 grep（记录原因到 `.ai/task_log.md`）
5. 不要反复做无意义重试
