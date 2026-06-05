import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import CodeGraph from '../src/index';
import { createLocalQueryApi } from '../src/query/local-api';

describe('local query API', () => {
  let tempDir: string;
  let cg: CodeGraph;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-local-query-'));
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, 'src', 'flow.ts'),
      [
        'export function leaf() { return 1; }',
        'export function caller() { return leaf(); }',
        '',
      ].join('\n'),
    );

    cg = await CodeGraph.init(tempDir, {
      config: { include: ['**/*.ts'], exclude: [] },
    });
    await cg.indexAll();
  });

  afterEach(() => {
    if (cg) cg.destroy();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('answers symbol and graph queries through one local API surface', () => {
    const api = createLocalQueryApi(cg);

    const search = api.searchSymbols('leaf', { limit: 5 });
    expect(search.map((r) => r.node.name)).toContain('leaf');

    const callers = api.findCallers('leaf', { limit: 5 });
    expect(callers.nodes.map((n) => n.name)).toContain('caller');

    const callees = api.findCallees('caller', { limit: 5 });
    expect(callees.nodes.map((n) => n.name)).toContain('leaf');
  });

  it('normalizes file filters and reports index health without using MCP', () => {
    const api = createLocalQueryApi(cg);

    const files = api.listFiles({ path: '/src', includeMetadata: true });
    expect(files.map((f) => f.path)).toEqual(['src/flow.ts']);

    const status = api.getIndexStatus();
    expect(status.initialized).toBe(true);
    expect(status.pendingChanges).toEqual({ added: 0, modified: 0, removed: 0 });
    expect(status.fileCount).toBe(1);
    expect(status.backend).toBeTruthy();
  });
});
