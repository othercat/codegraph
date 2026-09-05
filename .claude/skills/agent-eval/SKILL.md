---
name: agent-eval
description: Benchmark CodeGraph retrieval quality on a real codebase by comparing agent behavior with vs without CodeGraph. Use when the user runs /agent-eval or asks to test, benchmark, audit, or validate a codegraph version (the local dev build or a published npm version) against a language's repo.
---

# CodeGraph Quality Audit

Measures how much CodeGraph helps an agent versus plain grep/read, for a chosen
codegraph version on a chosen real-world repo. Drives the harness in
`scripts/agent-eval/`.

## Prerequisites
- `tmux` 3+, a logged-in `claude` CLI, `node`, `git` (macOS/Linux).
- Run from the codegraph repo root.

## Workflow

Reuse version, language, repository, question and harness choices already supplied
by the user. Read the sibling `corpus.json` for available samples; bundle only the
remaining material questions instead of asking four times. Resolve VERSION to
`local`, `latest` or the requested version, and MODE to `headless`, `tmux` or `all`.

The existing harness runs paid Claude sessions, includes permission-bypass flags,
rebuilds corpus indexes and may change the global CodeGraph install. Before running,
ensure these effects and the cost/target scope are explicitly authorized. A generic
instruction audit does not authorize this benchmark. Complete local inspection and
deterministic checks first when approval is still needed; do not run examples blindly.

**Step 5 — run.** Launch in the background (sets the version, clones if missing,
wipes + re-indexes, runs the chosen arms — several minutes):
```bash
scripts/agent-eval/audit.sh <VERSION> <repo-name> <repo-url> "<question>" <MODE>
```

**Step 6 — report.** When the job finishes, read the log and report per arm:
- Headless (`parse-run.mjs`): total tool calls, file `Read`s, Grep/Bash,
  codegraph-tool calls, duration, **total cost**.
- Interactive (`parse-session.mjs`): the `VERDICT: codegraph_explore used Nx |
  Read N | Grep/Bash N` and `TOKENS:` lines.

Lead with cost + tool/Read counts — they are the reliable signals; raw token
in/out are confounded by subagent delegation and prompt caching. State whether
codegraph reduced effort and whether both arms reached a correct answer.

## Notes
- The index is rebuilt every run (`audit.sh` wipes `.codegraph`) — different
  versions extract differently, so an index must be served by the same binary
  that built it.
- `audit.sh` temporarily mutates the global `codegraph` install for the test,
  then restores your dev link via `local-install.sh`.
- Corpus repos are cloned to `/tmp/codegraph-corpus` (reused if already present).
- Add or edit repos in `corpus.json` (fields: `name`, `repo`, `size`, `files`,
  `question`).
