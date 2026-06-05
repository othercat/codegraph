import { describe, it, expect } from 'vitest';
import { SERVER_INSTRUCTIONS } from '../src/mcp/server-instructions';

describe('MCP server instructions fallback guidance', () => {
  it('treats transport failures as adapter failures when the local index is healthy', () => {
    expect(SERVER_INSTRUCTIONS).toContain('Transport closed');
    expect(SERVER_INSTRUCTIONS).toContain('codegraph status --json <project>');
    expect(SERVER_INSTRUCTIONS).toMatch(/initialized=true/);
    expect(SERVER_INSTRUCTIONS).toMatch(/pending.*0/);
    expect(SERVER_INSTRUCTIONS).toMatch(/CLI/);
    expect(SERVER_INSTRUCTIONS).toMatch(/do not run `codegraph index`/i);
    expect(SERVER_INSTRUCTIONS).toMatch(/do not delete `.codegraph\/`/i);
  });
});
