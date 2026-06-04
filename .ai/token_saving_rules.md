# Token Saving Rules: CodeGraph

## 强制规则

1. **不允许无目标全仓 grep。** 任何涉及"找代码 / 理解流程 / 追踪调用 / 分析影响"的任务，必须先调用 CodeGraph 工具（`codegraph_explore` / `codegraph_node` / `codegraph_callers` / `codegraph_callees` / `codegraph_impact`）。只有在 CodeGraph 返回 "not found" 或空结果时才允许 fallback。

2. **不允许一次性 Read 超过 8 个文件**，除非用户明确要求。高置信文件优先，大文件只读相关函数/片段（用 `Read` 的 `offset`/`limit`）。

3. **修改前必须先列出候选文件和理由。** 格式：
   ```markdown
   ## Candidate Files
   | File | Reason | Confidence |
   |------|--------|------------|
   ```

4. **修改前必须说明证据链。** 格式：
   ```markdown
   ## Evidence Chain
   1. 用户问题对应入口是 xxx。
   2. CodeGraph 显示 xxx 调用了 yyy。
   3. ...
   ```

5. **已经记录在 `.ai/` 的信息不得重复探索。** 任务开始前先读 `.ai/handover.md`、`.ai/repo_map.md`、`.ai/task_log.md`。

6. **不要因为"理解项目"而读完整仓库。** 项目的架构和核心调用链已经记录在 `repo_map.md` 中。

7. **不要读取或输出 `.env`、密钥、token、证书、私钥等敏感内容。** 遇到只说明存在即可。

8. **大文件只读相关片段。** 超过 200 行的文件，先用 CodeGraph 定位到具体 symbol/函数位置，再读对应 offset/limit。

## Explore 预算规则

| 项目规模（files）| explore 调用次数 | 每调用 maxCharsPerFile |
|---|---|---|
| <500 | 1 | 3800 |
| <5000 | 2 | 6500 |
| <15000 | 3 | 7000 |
| <25000 | 4 | 7000 |
| ≥25000 | 5 | 7000 |

**关键约束：更大 tier 的 `maxCharsPerFile` 绝不能小于更小 tier。**

Explore 输出**绝不能告诉 Agent "use Read"** — 应引导到另一次 `codegraph_explore`，并把返回的 source 当作 "already Read"。

## 效率目标

| 指标 | 目标 |
|------|------|
| explore 次数 | <500 文件→1次，<5000→2次，<15000→3次，≥15000→4-5次 |
| Read/Grep 次数 | 功能性问题应趋近于 0 |
| 每次 session 复用 | 必须读取 `.ai/` 已有信息，不得重复 |

## 允许的行为

- ✅ 为了确认具体实现读取关键文件（3-8 个）
- ✅ 索引缺失时做有限 grep（必须记录原因到 `task_log.md`）
- ✅ 复杂重构前做更完整的 impact analysis（`codegraph_impact`）
- ✅ 发现 `.ai/` 过期时主动更新它
- ✅ CodeGraph 明确返回 "not found" 时 fallback 到有限 grep
