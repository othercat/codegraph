/**
 * SQLite backend reporting.
 *
 * node:sqlite (Node's built-in real SQLite) is the preferred backend, but
 * falls back to better-sqlite3 when the bundled SQLite lacks FTS5 (observed
 * on Node.js 22.x Windows builds). Tests accept either backend.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseConnection } from '../src/db';
import { CodeGraph } from '../src';

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

const expectedBackend = nodeSqliteSupportsFts5() ? 'node-sqlite' : 'better-sqlite3';

describe('DatabaseConnection — backend reporting', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-backend-'));
  });

  afterEach(() => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports the expected backend in WAL for an initialized DB', () => {
    const conn = DatabaseConnection.initialize(path.join(dir, 'test.db'));
    expect(conn.getBackend()).toBe(expectedBackend);
    expect(conn.getJournalMode()).toBe('wal');
    conn.close();
  });

  it('CodeGraph.getBackend() delegates to the underlying DatabaseConnection', async () => {
    fs.writeFileSync(path.join(dir, 'x.ts'), `export function x(): void {}\n`);
    const cg = await CodeGraph.init(dir, { index: true });
    try {
      expect(cg.getBackend()).toBe(expectedBackend);
    } finally {
      cg.destroy();
    }
  });
});
