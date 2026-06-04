/**
 * SQLite Adapter
 *
 * Thin wrapper over Node's built-in `node:sqlite` (`DatabaseSync`), exposed
 * through a small better-sqlite3-shaped interface so the rest of the codebase
 * is storage-agnostic.
 *
 * CodeGraph ships with a bundled Node runtime, so `node:sqlite` (real SQLite,
 * with WAL + FTS5) is always available — there is no native build step and no
 * wasm fallback. When run from source instead, it requires Node >= 22.5.
 */

export interface SqliteStatement {
  run(...params: any[]): { changes: number; lastInsertRowid: number | bigint };
  get(...params: any[]): any;
  all(...params: any[]): any[];
  /**
   * Lazily yield result rows one at a time instead of materializing the whole
   * set with `all()`. Use for unbounded scans (e.g. every function/method node)
   * so memory stays O(1) in the row count rather than O(rows) — see #610, where
   * `all()`-ing every symbol on a dense project spiked the heap into an OOM.
   */
  iterate(...params: any[]): IterableIterator<any>;
}

export interface SqliteDatabase {
  prepare(sql: string): SqliteStatement;
  exec(sql: string): void;
  pragma(str: string, options?: { simple?: boolean }): any;
  transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T;
  close(): void;
  readonly open: boolean;
}

/**
 * The active SQLite backend. `node:sqlite` is preferred (no native build),
 * but falls back to `better-sqlite3` when the bundled SQLite lacks FTS5
 * (e.g. Node.js 22.x on Windows — see sqlite-adapter.ts comments).
 */
export type SqliteBackend = 'node-sqlite' | 'better-sqlite3';

/**
 * Wraps Node's built-in `node:sqlite` (`DatabaseSync`) to match the
 * better-sqlite3 interface the rest of the code expects.
 *
 * node:sqlite is real SQLite compiled into Node, so it supports WAL, FTS5,
 * mmap, and `@named` params natively — the only shims needed are the
 * better-sqlite3 conveniences node:sqlite omits: a `.pragma()` helper, a
 * `.transaction()` helper, and `open` (node:sqlite exposes `isOpen`).
 */
class NodeSqliteAdapter implements SqliteDatabase {
  private _db: any;

  constructor(dbPath: string) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseSync } = require('node:sqlite');
    this._db = new DatabaseSync(dbPath);
  }

  get open(): boolean {
    return this._db.isOpen;
  }

  prepare(sql: string): SqliteStatement {
    // node:sqlite matches better-sqlite3's calling convention (variadic
    // positional args, or a single object for @named params), so params forward
    // through unchanged.
    const stmt = this._db.prepare(sql);
    return {
      run(...params: any[]) {
        const r = stmt.run(...params);
        return {
          changes: Number(r?.changes ?? 0),
          lastInsertRowid: r?.lastInsertRowid ?? 0,
        };
      },
      get(...params: any[]) {
        return stmt.get(...params);
      },
      all(...params: any[]) {
        return stmt.all(...params);
      },
      iterate(...params: any[]) {
        return stmt.iterate(...params);
      },
    };
  }

  exec(sql: string): void {
    this._db.exec(sql);
  }

  pragma(str: string, options?: { simple?: boolean }): any {
    const trimmed = str.trim();
    // Write pragma ("key = value"): node:sqlite is real SQLite, so every pragma
    // (WAL, mmap, synchronous, …) applies as-is.
    if (trimmed.includes('=')) {
      this._db.exec(`PRAGMA ${trimmed}`);
      return;
    }
    // Read pragma. Default: the row object (e.g. { journal_mode: 'wal' }).
    // `{ simple: true }` returns just the single column value, like better-sqlite3.
    const row = this._db.prepare(`PRAGMA ${trimmed}`).get();
    if (options?.simple) {
      return row && typeof row === 'object' ? Object.values(row)[0] : row;
    }
    return row;
  }

  transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T {
    return (...args: any[]) => {
      this._db.exec('BEGIN');
      try {
        const result = fn(...args);
        this._db.exec('COMMIT');
        return result;
      } catch (error) {
        this._db.exec('ROLLBACK');
        throw error;
      }
    };
  }

  close(): void {
    // node:sqlite's DatabaseSync.close() throws if already closed; make it
    // idempotent to match better-sqlite3 (callers may close more than once).
    if (this._db.isOpen) this._db.close();
  }
}

/**
 * Wraps `better-sqlite3` to match the same interface.
 *
 * Used as a fallback when `node:sqlite` is missing FTS5 (observed on Node.js
 * 22.x Windows builds where SQLite is compiled without ENABLE_FTS5).
 */
class BetterSqlite3Adapter implements SqliteDatabase {
  private _db: any;
  private _open: boolean;

  constructor(dbPath: string, BetterSqlite3: any) {
    this._db = new BetterSqlite3(dbPath);
    this._open = true;
  }

  get open(): boolean {
    return this._open;
  }

  prepare(sql: string): SqliteStatement {
    const stmt = this._db.prepare(sql);
    return {
      run(...params: any[]) {
        const r = stmt.run(...params);
        return {
          changes: Number(r?.changes ?? 0),
          lastInsertRowid: r?.lastInsertRowid ?? 0,
        };
      },
      get(...params: any[]) {
        return stmt.get(...params);
      },
      all(...params: any[]) {
        return stmt.all(...params);
      },
      iterate(...params: any[]) {
        return stmt.iterate(...params);
      },
    };
  }

  exec(sql: string): void {
    this._db.exec(sql);
  }

  pragma(str: string, options?: { simple?: boolean }): any {
    return this._db.pragma(str, options);
  }

  transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T {
    return this._db.transaction(fn);
  }

  close(): void {
    if (this._open) {
      this._db.close();
      this._open = false;
    }
  }
}

/**
 * Detect whether `node:sqlite` supports FTS5 by opening a temporary
 * in-memory database and attempting to create a virtual FTS5 table.
 */
function nodeSqliteSupportsFts5(): boolean {
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE VIRTUAL TABLE _fts5_probe USING fts5(content)');
    db.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a database connection.
 *
 * Prefers `node:sqlite` (Node 22.5+, no native build), but falls back to
 * `better-sqlite3` when the bundled SQLite lacks FTS5 (observed on Windows).
 *
 * Returns the active backend alongside the db so each `DatabaseConnection` can
 * report it per-instance — MCP can open multiple project DBs in one process, so
 * a process-global would race.
 */
export function createDatabase(dbPath: string): { db: SqliteDatabase; backend: SqliteBackend } {
  if (nodeSqliteSupportsFts5()) {
    try {
      return { db: new NodeSqliteAdapter(dbPath), backend: 'node-sqlite' };
    } catch (error) {
      // node:sqlite available but failed to open the real DB — fall through
    }
  }

  // Fallback to better-sqlite3
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BetterSqlite3 = require('better-sqlite3');
    return { db: new BetterSqlite3Adapter(dbPath, BetterSqlite3), backend: 'better-sqlite3' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(
      'Failed to open SQLite.\n' +
      'CodeGraph requires either:\n' +
      '  - node:sqlite with FTS5 support (Node.js 22.5+ on most platforms), or\n' +
      '  - better-sqlite3 (npm install better-sqlite3).\n' +
      `Underlying error: ${msg}`
    );
  }
}
