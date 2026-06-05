import type { Edge, FileRecord, GraphStats, Node, NodeKind, SearchOptions, SearchResult, Subgraph } from '../types';
import type { PendingFile } from '../sync';
import { isGeneratedFile } from '../extraction/generated-detection';

const RUST_PATH_PREFIXES = new Set(['crate', 'super', 'self']);

export interface LocalQuerySource {
  getProjectRoot(): string;
  searchNodes(query: string, options?: SearchOptions): SearchResult[];
  getNodesByName(name: string): Node[];
  getCallers(nodeId: string, maxDepth?: number): Array<{ node: Node; edge: Edge }>;
  getCallees(nodeId: string, maxDepth?: number): Array<{ node: Node; edge: Edge }>;
  getImpactRadius(nodeId: string, maxDepth?: number): Subgraph;
  getFiles(): FileRecord[];
  getStats(): GraphStats;
  getChangedFiles(): { added: string[]; modified: string[]; removed: string[] };
  getLastIndexedAt(): number | null;
  getBackend(): string;
  getJournalMode(): string;
  getPendingFiles?(): PendingFile[];
}

export interface SymbolMatchResult {
  nodes: Node[];
  note: string;
}

export interface RelatedSymbolResult {
  symbol: string;
  matches: Node[];
  nodes: Node[];
  note: string;
}

export interface ImpactQueryResult {
  symbol: string;
  depth: number;
  matches: Node[];
  subgraph: Subgraph;
  note: string;
}

export interface FileQueryOptions {
  path?: string;
  pattern?: string;
}

export interface LocalIndexStatus {
  initialized: true;
  projectPath: string;
  lastIndexed: number | null;
  fileCount: number;
  nodeCount: number;
  edgeCount: number;
  dbSizeBytes: number;
  backend: string;
  journalMode: string;
  nodesByKind: GraphStats['nodesByKind'];
  edgesByKind: GraphStats['edgesByKind'];
  filesByLanguage: GraphStats['filesByLanguage'];
  languages: string[];
  pendingChanges: { added: number; modified: number; removed: number };
  pendingFiles: PendingFile[];
}

export interface LocalQueryApi {
  searchSymbols(query: string, options?: { limit?: number; kind?: NodeKind; kinds?: NodeKind[] }): SearchResult[];
  findSymbolMatches(symbol: string): Node[];
  findAllSymbols(symbol: string): SymbolMatchResult;
  findCallers(symbol: string, options?: { limit?: number }): RelatedSymbolResult;
  findCallees(symbol: string, options?: { limit?: number }): RelatedSymbolResult;
  analyzeImpact(symbol: string, options?: { depth?: number }): ImpactQueryResult;
  listFiles(options?: FileQueryOptions): FileRecord[];
  getIndexStatus(): LocalIndexStatus;
}

export function createLocalQueryApi(cg: LocalQuerySource): LocalQueryApi {
  return new CodeGraphLocalQueryApi(cg);
}

export function lastQualifierPart(symbol: string): string {
  const parts = symbol.split(/::|[./]/).filter((p) => p.length > 0);
  return parts[parts.length - 1] ?? symbol;
}

export function normalizeFileFilter(pathFilter?: string): string {
  return pathFilter
    ? pathFilter
        .replace(/\\/g, '/')
        .replace(/^(?:\.?\/+)+/, '')
        .replace(/^\.$/, '')
        .replace(/\/+$/, '')
    : '';
}

export function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');
  return new RegExp(escaped);
}

export function rankGeneratedFilesLast<T extends { node: Node }>(results: T[]): T[] {
  return [...results].sort((a, b) => {
    const aGen = isGeneratedFile(a.node.filePath) ? 1 : 0;
    const bGen = isGeneratedFile(b.node.filePath) ? 1 : 0;
    return aGen - bGen;
  });
}

export function matchesSymbol(node: Node, symbol: string): boolean {
  if (node.name === symbol) return true;
  if (node.kind === 'file' && node.name.replace(/\.[^.]+$/, '') === symbol) return true;

  if (!/[.\\/]|::/.test(symbol)) return false;
  const parts = symbol.split(/::|[./]/).filter((p) => p.length > 0);
  if (parts.length < 2) return false;

  const lastPart = parts[parts.length - 1]!;
  if (node.name !== lastPart) return false;

  const colonSuffix = parts.join('::');
  if (node.qualifiedName.includes(colonSuffix)) return true;

  const containerHints = parts.slice(0, -1).filter((p) => !RUST_PATH_PREFIXES.has(p));
  if (containerHints.length === 0) return false;

  const segments = node.filePath.split('/').filter((s) => s.length > 0);
  return containerHints.every((hint) =>
    segments.some((seg) => seg === hint || seg.replace(/\.[^.]+$/, '') === hint)
  );
}

class CodeGraphLocalQueryApi implements LocalQueryApi {
  constructor(private readonly cg: LocalQuerySource) {}

  searchSymbols(query: string, options: { limit?: number; kind?: NodeKind; kinds?: NodeKind[] } = {}): SearchResult[] {
    const kinds = options.kinds ?? (options.kind ? [options.kind] : undefined);
    return rankGeneratedFilesLast(this.cg.searchNodes(query, {
      limit: options.limit,
      kinds,
    }));
  }

  findSymbolMatches(symbol: string): Node[] {
    const isQualified = /[.\\/]|::/.test(symbol);

    if (!isQualified) {
      const exact = this.cg.getNodesByName(symbol);
      if (exact.length > 0) {
        return [...exact].sort((a, b) => (isGeneratedFile(a.filePath) ? 1 : 0) - (isGeneratedFile(b.filePath) ? 1 : 0));
      }
      const fuzzy = this.cg.searchNodes(symbol, { limit: 10 });
      return fuzzy[0] ? [fuzzy[0].node] : [];
    }

    const limit = 50;
    let results = this.cg.searchNodes(symbol, { limit });
    if (results.length === 0) {
      const tail = lastQualifierPart(symbol);
      if (tail && tail !== symbol) results = this.cg.searchNodes(tail, { limit });
    }

    if (results.length === 0) return [];

    const exactMatches = results.filter((r) => matchesSymbol(r.node, symbol));
    if (exactMatches.length === 0) return [];

    return rankGeneratedFilesLast(exactMatches).map((r) => r.node);
  }

  findAllSymbols(symbol: string): SymbolMatchResult {
    let results = this.cg.searchNodes(symbol, { limit: 50 });

    if (results.length === 0 && /[.\\/]|::/.test(symbol)) {
      const tail = lastQualifierPart(symbol);
      if (tail && tail !== symbol) results = this.cg.searchNodes(tail, { limit: 50 });
    }

    if (results.length === 0) {
      return { nodes: [], note: '' };
    }

    const exactMatches = results.filter((r) => matchesSymbol(r.node, symbol));

    if (exactMatches.length <= 1) {
      const node = exactMatches[0]?.node ?? results[0]!.node;
      return { nodes: [node], note: '' };
    }

    const ranked = rankGeneratedFilesLast(exactMatches);
    const locations = ranked.map((r) =>
      `${r.node.kind} at ${r.node.filePath}:${r.node.startLine}`
    );
    const note = `\n\n> **Note:** Aggregated results across ${ranked.length} symbols named "${symbol}": ${locations.join(', ')}`;
    return { nodes: ranked.map((r) => r.node), note };
  }

  findCallers(symbol: string, options: { limit?: number } = {}): RelatedSymbolResult {
    const allMatches = this.findAllSymbols(symbol);
    const seen = new Set<string>();
    const nodes: Node[] = [];

    for (const node of allMatches.nodes) {
      for (const caller of this.cg.getCallers(node.id)) {
        if (!seen.has(caller.node.id)) {
          seen.add(caller.node.id);
          nodes.push(caller.node);
        }
      }
    }

    return {
      symbol,
      matches: allMatches.nodes,
      nodes: nodes.slice(0, options.limit ?? 20),
      note: allMatches.note,
    };
  }

  findCallees(symbol: string, options: { limit?: number } = {}): RelatedSymbolResult {
    const allMatches = this.findAllSymbols(symbol);
    const seen = new Set<string>();
    const nodes: Node[] = [];

    for (const node of allMatches.nodes) {
      for (const callee of this.cg.getCallees(node.id)) {
        if (!seen.has(callee.node.id)) {
          seen.add(callee.node.id);
          nodes.push(callee.node);
        }
      }
    }

    return {
      symbol,
      matches: allMatches.nodes,
      nodes: nodes.slice(0, options.limit ?? 20),
      note: allMatches.note,
    };
  }

  analyzeImpact(symbol: string, options: { depth?: number } = {}): ImpactQueryResult {
    const depth = options.depth ?? 2;
    const allMatches = this.findAllSymbols(symbol);
    const mergedNodes = new Map<string, Node>();
    const mergedEdges: Edge[] = [];
    const seenEdges = new Set<string>();

    for (const node of allMatches.nodes) {
      const impact = this.cg.getImpactRadius(node.id, depth);
      for (const [id, n] of impact.nodes) {
        mergedNodes.set(id, n);
      }
      for (const edge of impact.edges) {
        const key = `${edge.source}->${edge.target}:${edge.kind}`;
        if (!seenEdges.has(key)) {
          seenEdges.add(key);
          mergedEdges.push(edge);
        }
      }
    }

    return {
      symbol,
      depth,
      matches: allMatches.nodes,
      subgraph: {
        nodes: mergedNodes,
        edges: mergedEdges,
        roots: allMatches.nodes.map((node) => node.id),
      },
      note: allMatches.note,
    };
  }

  listFiles(options: FileQueryOptions = {}): FileRecord[] {
    const normalizedFilter = normalizeFileFilter(options.path);
    let files = normalizedFilter
      ? this.cg.getFiles().filter((f) => f.path === normalizedFilter || f.path.startsWith(normalizedFilter + '/'))
      : this.cg.getFiles();

    if (options.pattern) {
      const regex = globToRegex(options.pattern);
      files = files.filter((f) => regex.test(f.path));
    }

    return [...files].sort((a, b) => a.path.localeCompare(b.path));
  }

  getIndexStatus(): LocalIndexStatus {
    const stats = this.cg.getStats();
    const changes = this.cg.getChangedFiles();
    const pendingFiles = this.cg.getPendingFiles?.() ?? [];

    return {
      initialized: true,
      projectPath: this.cg.getProjectRoot(),
      lastIndexed: this.cg.getLastIndexedAt(),
      fileCount: stats.fileCount,
      nodeCount: stats.nodeCount,
      edgeCount: stats.edgeCount,
      dbSizeBytes: stats.dbSizeBytes,
      backend: this.cg.getBackend(),
      journalMode: this.cg.getJournalMode(),
      nodesByKind: stats.nodesByKind,
      edgesByKind: stats.edgesByKind,
      filesByLanguage: stats.filesByLanguage,
      languages: Object.entries(stats.filesByLanguage)
        .filter(([, count]) => count > 0)
        .map(([language]) => language),
      pendingChanges: {
        added: changes.added.length,
        modified: changes.modified.length,
        removed: changes.removed.length,
      },
      pendingFiles,
    };
  }
}
