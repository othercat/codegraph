# AGENTS.md

This file describes the CodeGraph repository. Current user instructions and the actual host/tool availability take precedence over historical environment examples.

## Project Overview

CodeGraph is a local-first code intelligence library + CLI + MCP server. It parses any supported codebase with tree-sitter, stores symbols/edges/files in SQLite (FTS5), and exposes a knowledge graph to AI agents (Codex, Cursor, Codex CLI, opencode) over MCP. Per-project data lives in `.codegraph/`. Extraction is deterministic — derived from AST, not LLM-summarized.

Distributed as `@colbymchenry/codegraph` on npm; same binary serves as installer, indexer, and MCP server.

## Build, Test, Run

```bash
npm run build           # tsc + copy schema.sql and *.wasm into dist/; chmods dist/bin/codegraph.js
npm run dev             # tsc --watch
npm run clean           # rm -rf dist

npm test                # vitest run (all)
npm run test:watch
npm run test:eval       # only __tests__/evaluation/
npm run eval            # build then run __tests__/evaluation/runner.ts via tsx

npm run cli             # build then run the local dist binary

# Single test file / pattern
npx vitest run __tests__/installer-targets.test.ts
npx vitest run __tests__/extraction.test.ts -t "TypeScript"
```

`copy-assets` (called from `build`) copies `src/db/schema.sql` and all `src/extraction/wasm/*.wasm` files into `dist/`. **Any new SQL or grammar wasm must be copied or it won't ship.**

Node engines: `>=18.0.0 <25.0.0`. There is a hard exit on Node 25.x (see `src/bin/node-version-check.ts`).

## Architecture

### Layered pipeline

```
files → ExtractionOrchestrator (tree-sitter) → DB (nodes/edges/files)
              ↓
       ReferenceResolver (imports, name-matching, framework patterns)
              ↓
       GraphQueryManager / GraphTraverser (callers, callees, impact)
              ↓
       ContextBuilder (markdown/JSON for AI consumption)
```

The public API surface is `src/index.ts` — the `CodeGraph` class wires all the layers and re-exports types. Library users only touch this file; the MCP server and CLI also drive it.

### Module layout

- `src/index.ts` — `CodeGraph` class: `init`/`open`/`close`, `indexAll`, `sync`, `searchNodes`, `getCallers`/`getCallees`, `getImpactRadius`, `buildContext`, `watch`/`unwatch`.
- `src/db/` — `DatabaseConnection`, `QueryBuilder` (prepared statements), `schema.sql`. Backed by `better-sqlite3` (native) when available, transparently falls back to `node-sqlite3-wasm`. `codegraph status` surfaces which backend is live; wasm is the slow path.
- `src/extraction/` — `ExtractionOrchestrator`, tree-sitter wrappers, per-language extractors under `languages/` (one file per language), plus standalone extractors for non-tree-sitter formats (`svelte-extractor.ts`, `vue-extractor.ts`, `liquid-extractor.ts`, `dfm-extractor.ts` for Delphi). `parse-worker.ts` runs heavy parsing off the main thread.
- `src/resolution/` — `ReferenceResolver` orchestrates `import-resolver.ts` (with `path-aliases.ts` for tsconfig path aliases + cargo workspace member globs), `name-matcher.ts`, and `frameworks/` (Express, Laravel, Rails, FastAPI, Django, Flask, Spring, Gin, Axum, ASP.NET, Vapor, React Router, SvelteKit, Vue/Nuxt, Cargo workspaces). Frameworks emit `route` nodes and `references` edges.
- `src/graph/` — `GraphTraverser` (BFS/DFS, impact radius, path finding) and `GraphQueryManager` (high-level queries).
- `src/context/` — `ContextBuilder` + formatter for markdown/JSON output.
- `src/search/` — full-text query parser and helpers for FTS5.
- `src/sync/` — `FileWatcher` (native FSEvents/inotify/RDCW) with debounce + filter, and git-hook helpers.
- `src/mcp/` — MCP server (`MCPServer`, `tools.ts`, `transport.ts`). `server-instructions.ts` is what the server returns in the MCP `initialize` response — keep it in sync with the user-facing tool guidance.
- `src/installer/` — see below.
- `src/bin/codegraph.ts` — CLI (commander). Subcommands: `install`, `init`, `uninit`, `index`, `sync`, `status`, `query`, `files`, `context`, `affected`, `serve --mcp`.
- `src/ui/` — terminal UI (shimmer progress, worker).

### NodeKind / EdgeKind

Defined in `src/types.ts`. Both extractors and resolvers must use these exact strings.

- **NodeKind**: `file`, `module`, `class`, `struct`, `interface`, `trait`, `protocol`, `function`, `method`, `property`, `field`, `variable`, `constant`, `enum`, `enum_member`, `type_alias`, `namespace`, `parameter`, `import`, `export`, `route`, `component`.
- **EdgeKind**: `contains`, `calls`, `imports`, `exports`, `extends`, `implements`, `references`, `type_of`, `returns`, `instantiates`, `overrides`, `decorates`.

### Multi-agent installer

`src/installer/` is the entry point for `codegraph install` (and the bare `codegraph`/`npx @colbymchenry/codegraph` invocation). Architecture:

- `targets/registry.ts` lists every supported agent.
- `targets/types.ts` defines the `AgentTarget` interface — adding another supported agent is **one new file in `targets/` + one entry in `registry.ts`**. Each target owns its config-file location and MCP-server JSON/TOML/JSONC writing. (Targets no longer write an instructions file — see below.)
- Supported targets come from `targets/registry.ts`; do not infer the current set from an old four-target list.
- `targets/toml.ts` is a hand-rolled TOML serializer scoped to `[mcp_servers.codegraph]` (used by Codex). Sibling tables and `[[array_of_tables]]` are preserved verbatim. No new dependency.
- opencode reads `opencode.jsonc` by default; the installer prefers existing `.jsonc`, falls back to `.json`, and creates `.jsonc` for greenfield installs. Edits are surgical via `jsonc-parser` so user comments and formatting survive install/re-install/uninstall round-trips.
- `instructions-template.ts` no longer holds an instructions body — it exports only the `<!-- CODEGRAPH_START -->`/`<!-- CODEGRAPH_END -->` markers. The installer **stopped writing** a `## CodeGraph` block into each agent's instructions file (`AGENTS.md` / `~/.codex/AGENTS.md` / `~/.config/opencode/AGENTS.md` / `~/.gemini/GEMINI.md` / `.cursor/rules/codegraph.mdc` / Kiro steering doc) because it duplicated the MCP `initialize` instructions verbatim (issue #529). Each target's `install` (self-heal on upgrade) and `uninstall` use the markers to **strip** a block a previous install left behind. `server-instructions.ts` is the single source of truth for agent-facing guidance.
- All installer changes need matching coverage in `__tests__/installer-targets.test.ts` — there are ~47 parameterized contract tests covering install idempotency, sibling preservation, uninstall reverses install, byte-equal re-runs returning `unchanged`, and partial-state recovery for Codex.

### Cursor MCP working-directory quirk

Cursor launches MCP subprocesses with the wrong cwd and doesn't pass `rootUri` in `initialize`. The installer injects `--path` into Cursor's MCP args — absolute path for local installs, `${workspaceFolder}` for global installs. If you touch Cursor wiring, preserve this.

### MCP server instructions

`src/mcp/server-instructions.ts` is sent back to the agent in the MCP `initialize` response. This is the *first* thing every agent sees about how to use the tools, and as of issue #529 it is the **single source of truth** for agent-facing tool guidance — the installer no longer writes a duplicate `## CodeGraph` instructions block into `AGENTS.md` / `AGENTS.md` / `.cursor/rules/codegraph.mdc`. Edit tool guidance here and nowhere else.

## Retrieval quality and performance

- Optimize answer sufficiency, wall-clock latency and tool calls. The product target
  is one explore call for small repos and 3–5 for large repos with minimal fallback
  reads; this is a benchmark target, not a ban on evidence gathering during development.
- Improve the tools agents already call. `codegraph_explore` accepts precise symbol
  names, qualified methods and type hints, and leads with the connecting flow.
  Preserve overload disambiguation, named-file ordering and the limit of one unnamed
  bridge. `codegraph_node` supplies bodies, overloads and caller/callee trails.
- In `src/mcp/tools.ts`, keep call/output budgets monotonic with repo size, especially
  `maxCharsPerFile`. Call tiers are 1/2/3/4/5 for the documented file-count ranges;
  use current code and tests for exact thresholds. Product output should guide users
  to sufficient graph context, not send them to reread source already returned.
- Synthesized edges need `provenance: heuristic`, `metadata.synthesizedBy` and the
  `registeredAt` wiring site. Cover complete flows across relevant dispatch boundaries,
  avoid node explosion, and do not invent edges for unsupported dynamic behavior.
- For a new language/framework, retain small/medium/large corpus coverage with at
  least three flow prompts and deterministic extraction/precision probes. When paid
  A/B evaluation is authorized, use at least two runs per arm plus a control repo.
  Report correctness, duration, tool/Read/Grep counts and cost; sum per-turn usage
  instead of mistaking a last-turn usage field for the whole run. Do not infer gains
  from one run or promote partial coverage as end-to-end support.
- Before running the A/B scripts, check their actual CLI, billed-session budget,
  permission flags, index deletion targets and global install effects. These require
  the scope described in the evaluation Skill; documentation changes do not trigger them.

Detailed methods and dated benchmark results live in
[call sequence analysis](docs/benchmarks/call-sequence-analysis.md),
[dynamic-dispatch playbook](docs/design/dynamic-dispatch-coverage-playbook.md) and
[callback synthesis](docs/design/callback-edge-synthesis.md). Historical results
describe their recorded build and harness, not the current checkout's acceptance.

## Tests

Tests live in `__tests__/` and mirror the module they cover. Notable ones beyond the obvious:

- `installer-targets.test.ts` — parameterized contract suite across registered agent targets (see installer notes above).
- `evaluation/` — `runner.ts` + `test-cases.ts` exercise codegraph against synthetic projects and score the results; run via `npm run eval` (builds first). Not part of `npm test`.
- `sqlite-backend.test.ts` — covers native + wasm backend selection and fallback.
- `pr19-improvements.test.ts`, `frameworks-integration.test.ts` — regression coverage for specific past PRs/incidents; don't rename these, the names anchor to git history.

Tests create temp dirs with `fs.mkdtempSync` and clean up in `afterEach`. They write real files and exercise real SQLite — there is no DB mocking.

### Windows-gated tests

Behavior that differs by platform (path resolution, drive letters, `SENSITIVE_PATHS`, `%APPDATA%` config dirs, CRLF) must be gated, not assumed. Use `it.runIf(process.platform === 'win32')(...)` for Windows-only assertions and `it.runIf(process.platform !== 'win32')(...)` for POSIX-only ones — e.g. `/etc` is sensitive on POSIX but resolves to `C:\etc` (non-existent) on Windows, so an ungated `/etc` assertion fails on Windows. Validate the Windows side for real (see below); don't merge a Windows-gated test you haven't seen run.

## Cross-platform validation

Detect the actual host before platform-sensitive checks. Local tests validate that host only. The Docker/Parallels notes below describe the upstream maintainer environment; use available CI or an explicitly authorized host for other platforms and report untested coverage.

### Linux (Docker)

When asked to test or validate on Linux, use **Docker** — there's no Linux box, but Docker runs on the macOS host. Build a throwaway image from the repo and run the suite inside it:

- `FROM node:22-bookworm`; `COPY` the repo with a `.dockerignore` excluding `node_modules`/`dist`/`.git`/`.codegraph`; `RUN npm ci && npm run build`. Don't reuse the Mac `node_modules` — `esbuild`/`rollup` ship platform-specific binaries.
- Run with **`docker run --rm --init`**. The `--init` is load-bearing for any process-lifecycle test (daemon reaping, the #277 PPID watchdog, idle-timeout): without a zombie-reaping PID 1, a SIGKILL'd/exited process lingers as a zombie and `process.kill(pid, 0)` still reports it *alive*, so exit-detection assertions false-fail even though the process did exit.
- Linux is where the inotify watch budget actually bites: count a process's watches via `/proc/<pid>/fdinfo/*` (sum `^inotify ` lines on the fd whose `readlink` is `anon_inode:inotify`).

### Windows (Parallels VM + SSH)

For Windows-specific behavior, validate on an available Windows host. The following Parallels setup is a historical upstream example, not permission to read connection secrets, connect to a remote machine, install software or use those addresses.

- Connect / run from the Mac host: `ssh <user>@<guest_ip> "..."`. For multi-line work, pipe PowerShell over stdin and **refresh PATH from the registry** first (sshd's session has a stale PATH after winget installs):
  ```
  ssh colby@10.211.55.3 "powershell -NoProfile -ExecutionPolicy Bypass -Command -" <<'PS'
  $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
  Set-Location C:\dev\codegraph
  PS
  ```
- Clone fresh into a **Windows-local** path (`C:\dev\codegraph`) and `npm ci` there — never run npm against the shared Mac repo, since `esbuild`/`rollup` ship platform-specific binaries.
- Guest toolchain (winget): Node LTS, Git, and the **VC++ ARM64 redistributable** (required by `@rollup/rollup-win32-arm64-msvc`, which vitest pulls in).
- Inspect an explicitly requested contributor ref in an isolated checkout when needed; preserve dirty work and never force-checkout over it.
- Known pre-existing Windows failures (they reproduce on `main`, unrelated to your change — confirm against `origin/main` before blaming your PR, and don't let them mask new regressions): `security.test.ts > Session marker symlink resistance > does not follow a pre-planted symlink` (symlink creation needs privileges on Windows); and the `mcp-initialize.test.ts` / `mcp-roots.test.ts` suites, which fail in `afterEach` with `EPERM` removing the temp dir because a spawned `serve --mcp` (its `--liftoff-only` re-exec grandchild) still holds the cwd / SQLite file open — a Windows file-locking quirk, not a logic bug.

## Releases

Released to npm and mirrored as [GitHub Releases](https://github.com/colbymchenry/codegraph/releases). `CHANGELOG.md` is the source of truth; GitHub Release notes are extracted from it.

### Writing changelog entries

**Default: write entries under `## [Unreleased]`** — that's the section reserved for work landing between releases. **Don't pre-create a `## [X.Y.Z]` block** for the next release: the Release workflow's first step is `scripts/prepare-release.mjs`, which automatically promotes everything under `[Unreleased]` into a new `## [X.Y.Z] - <YYYY-MM-DD>` block at release time (or merges into a pre-existing `[X.Y.Z]` block if one exists — but you don't need one). Pre-staging is what caused the v0.9.5 sparse-release-notes incident: a sparse `[0.9.5]` block hand-added before the rest of the work landed got picked by the extractor over the much-larger `[Unreleased]` section above it. Don't do that.

Formatting rules for any entry (anywhere — `[Unreleased]` or otherwise):

1. **Write friendly, user-facing notes — not engineer-facing ones.** Group under `### New Features` and `### Fixes` (sentence-case). Surface `### Breaking Changes` and `### Security` as their own sections **only when the release has them**; fold improvement-flavored changes into New Features. Omit empty sections. (This replaces the old Keep-a-Changelog `Added/Changed/Fixed/Removed/Deprecated` grouping: the GitHub Release page extracts each version block **verbatim** via `scripts/extract-release-notes.mjs`, and the old dense, implementation-focused entries rendered as an unreadable wall of text — so the whole CHANGELOG was rewritten to this format and every published release re-noted to match.)
2. **One plain-language sentence per bullet:** what changed and why it matters to a user. Lead with the capability, or with the symptom that's now fixed.
3. **Strip the internals.** No internal file paths (`src/...`), no internal symbol / function / class names, no benchmark numbers / percentages / node-or-edge counts. **Keep:** language & framework names (Go, Spring, NestJS, …), things a user types or sets (`codegraph install`, `codegraph_explore`, the `CODEGRAPH_*` env vars), agent / IDE names (Codex, Cursor, opencode, Kiro, …), and a brief `Thanks @user` when a contributor is credited.
4. Issue / PR references in entries are by number (`(#403)` etc.); the GitHub renderer auto-links them in the published release notes.
5. **Don't add a `[X.Y.Z]: https://...` link reference yourself** — `prepare-release.mjs` appends it automatically when it promotes the version (idempotent: a re-run is a no-op if it already exists).

Multi-word headings like `### New Features` are safe on the normal release path: `prepare-release.mjs` **Case A** moves the whole `[Unreleased]` body verbatim into `[X.Y.Z]`. (Only its rarely-used **Case B** *merge* splits sub-sections with a single-word `^### (\w+)$` regex that wouldn't match them — and Case B fires only if a `[X.Y.Z]` block was pre-created, which rule above already forbids.)

### Release flow (the user runs these)

Releases are built and published by the **GitHub Actions "Release" workflow**
(`.github/workflows/release.yml`). It runs `scripts/prepare-release.mjs` to
promote `[Unreleased]` into `[<version>]` (and auto-commit + push that
CHANGELOG change back to `main` so on-disk truth matches the published
notes), then bundles a Node runtime per platform (`scripts/build-bundle.sh`)
and publishes both the GitHub Release and the npm thin-installer
(`scripts/pack-npm.sh`: a shim package + per-platform packages).
Publishing manually is **wrong** now — a plain `npm publish` ships the root
package (non-bundled), which breaks anyone on Node < 22.5.

**Codex does NOT bump the version unless explicitly asked.** The maintainer
typically does it themselves — often by editing `package.json` directly via
the GitHub web UI. Don't proactively commit a version bump as part of
unrelated work, and don't propose one when summarizing a PR.

When the maintainer DOES bump the version, the only edit strictly required is
to `package.json` — the workflow's "Sync package-lock.json" step detects a
mismatch between `package.json` and `package-lock.json`, runs
`npm install --package-lock-only --ignore-scripts` to rewrite the lock file's
version fields (top-level + `packages.""`), and auto-commits + pushes the
result back to `main` with `[skip ci]`. So a GitHub-web-UI single-file edit to
`package.json` is enough to kick off a clean release. (If they edit both files
locally, that's fine too — the sync step no-ops.)

Once `package.json` is at the target version on `main`, trigger
**Actions → Release → Run workflow** (on `main`). The workflow:

1. Syncs `package-lock.json` to `package.json`'s version if they've drifted; commits + pushes that change.
2. Runs `prepare-release.mjs <X.Y.Z>` → promotes `[Unreleased]` → `[X.Y.Z] - <today>` in `CHANGELOG.md`, appends the link reference, commits + pushes the move with `[skip ci]`.
3. Builds every platform bundle on one runner, generates `SHA256SUMS`.
4. Creates the GitHub Release with notes from the freshly-promoted `[X.Y.Z]` block.
5. Publishes the npm shim + per-platform packages. Requires the `NPM_TOKEN` repo secret.

**Do not run `npm publish`, `git push`, or `git tag` yourself** — these are
publish actions on shared state. Write the files, hand the user the commands.

## House rules

- Any change to `src/installer/` (especially `targets/`) needs corresponding test coverage and a CHANGELOG entry — installer regressions break every new install silently.
- When changing what the MCP tools do or how agents should use them, edit `src/mcp/server-instructions.ts` — it is the **single source of truth** for agent-facing tool guidance (issue #529). The installer no longer writes a duplicate instructions block into `AGENTS.md` / `AGENTS.md` / `GEMINI.md` / `.cursor/rules/codegraph.mdc` / Kiro steering, so there's nothing to keep in sync anymore. (The repo's own checked-in `.cursor/rules/codegraph.mdc` is dogfooding config — update it too if you use Cursor on this repo, but it ships nowhere.)
- CodeGraph provides **code context**, not product requirements. For new features, derive UX, edge cases and acceptance criteria from the request and project context; ask only for material missing decisions.
- **When the user references issues, PR comments, or external reports, anchor them to a date and version before drawing conclusions.** Check the comment's `createdAt` against:
  - The **last released version** — `grep -m1 '^## \[' CHANGELOG.md` shows the top-of-file version (older releases follow). A comment dated before the latest `## [X.Y.Z] - YYYY-MM-DD` is reacting to *released* state — work that's only on `main` or on an unmerged branch doesn't apply.
  - The **last main commit** — `git log --first-parent main -1 --format='%ai %h %s'`. A comment after the last release but before a fix on main may already be addressed there but unreleased.
  - The **current branch's tip** — your own unmerged work obviously can't be what the comment is reacting to.
  Always disambiguate "released," "merged-but-unreleased," and "in-progress" before agreeing that a user-reported problem is unfixed (or that a fix is incomplete). A user saying "your fix only covers X" about a recent PR is usually pointing at the *released* shortcomings — your in-flight branch may already address them but they have no way to know that.
