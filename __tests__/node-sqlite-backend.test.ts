/**
 * node:sqlite backend (issue #238 follow-up).
 *
 * node:sqlite (Node's built-in real SQLite) is the preferred backend, with
 * better-sqlite3 fallback when FTS5 is missing. This drives a real index +
 * queries through whichever backend is active, so WAL, FTS5 search, and
 * @named-param writes are all exercised end-to-end.
 *
 * Skipped on Node < 22.5 where node:sqlite doesn't exist, or when neither
 * node:sqlite with FTS5 nor better-sqlite3 is available.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import CodeGraph from '../src';

function nodeSqliteSupportsFts5(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE VIRTUAL TABLE _fts5_probe USING fts5(content)');
    db.close();
    return true;
  } catch {
    return false;
  }
}

function betterSqlite3Available(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('better-sqlite3');
    return true;
  } catch {
    return false;
  }
}

const expectedBackend = nodeSqliteSupportsFts5() ? 'node-sqlite' : 'better-sqlite3';
const backendAvailable = nodeSqliteSupportsFts5() || betterSqlite3Available();

describe.skipIf(!backendAvailable)('active sqlite backend — real index + queries', () => {
  let dir: string;
  let cg: CodeGraph;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-nodesqlite-'));
    fs.writeFileSync(path.join(dir, 'a.ts'), 'export function helper(): number { return 1; }\n');
    fs.writeFileSync(
      path.join(dir, 'b.ts'),
      "import { helper } from './a';\nexport function main(): number { return helper(); }\n"
    );
    cg = await CodeGraph.init(dir, { index: true });
  });

  afterAll(() => {
    cg?.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('uses the expected backend', () => {
    expect(cg.getBackend()).toBe(expectedBackend);
  });

  it('runs in WAL mode — the whole reason it beats the wasm fallback', () => {
    expect(cg.getJournalMode()).toBe('wal');
  });

  it('indexed the project (write path: @named-param INSERTs via node:sqlite)', () => {
    const stats = cg.getStats();
    expect(stats.fileCount).toBe(2);
    expect(stats.nodeCount).toBeGreaterThan(0);
  });

  it('FTS5 search returns the indexed symbol (read path)', () => {
    const results = cg.searchNodes('helper');
    const names = results.map(r => r.node.name);
    expect(names).toContain('helper');
  });

  it('graph traversal resolves the cross-file caller', () => {
    const helper = cg.searchNodes('helper').find(r => r.node.name === 'helper');
    expect(helper).toBeTruthy();
    const callers = cg.getCallers(helper!.node.id);
    expect(callers.map(c => c.node.name)).toContain('main');
  });
});
