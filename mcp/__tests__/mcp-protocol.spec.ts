import { handleMcpMessage, SUPPORTED_PROTOCOL_VERSIONS } from '../mcp-protocol';
import { McpTool, McpToolError } from '../mcp.types';

describe('handleMcpMessage', () => {
  const echo: McpTool = {
    name: 'echo',
    description: 'Echoes input and user',
    inputSchema: { type: 'object', properties: {} },
    handler: jest.fn(async (input, ctx) => ({ input, userId: ctx.userId })),
  };
  const failing = (error: Error): McpTool => ({ ...echo, name: 'fail', handler: jest.fn().mockRejectedValue(error) });
  const call = (message: any, tools: McpTool[] = [echo]) => handleMcpMessage(message, tools, { userId: 7 });

  it('negotiates a known protocol version and falls back to the newest', async () => {
    const known = await call({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } });
    expect(known).toMatchObject({ id: 1, result: { protocolVersion: '2025-03-26', capabilities: { tools: {} } } });

    const unknown: any = await call({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } });
    expect(unknown.result.protocolVersion).toBe(SUPPORTED_PROTOCOL_VERSIONS[0]);
  });

  it('returns nothing for notifications', async () => {
    expect(await call({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeNull();
  });

  it('answers ping and lists tools as read-only', async () => {
    expect(await call({ jsonrpc: '2.0', id: 1, method: 'ping' })).toEqual({ jsonrpc: '2.0', id: 1, result: {} });
    expect(await call({ jsonrpc: '2.0', id: 2, method: 'tools/list' })).toEqual({
      jsonrpc: '2.0',
      id: 2,
      result: {
        tools: [
          { name: 'echo', description: 'Echoes input and user', inputSchema: echo.inputSchema, annotations: { readOnlyHint: true } },
        ],
      },
    });
  });

  it('calls a tool as the context user and returns JSON text', async () => {
    const response: any = await call({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'echo', arguments: { a: 1 } } });
    expect(response.result.isError).toBe(false);
    expect(JSON.parse(response.result.content[0].text)).toEqual({ input: { a: 1 }, userId: 7 });
  });

  it('shows McpToolError messages but hides other errors', async () => {
    const shown: any = await call({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'fail' } }, [failing(new McpToolError('No active game'))]);
    expect(shown.result).toEqual({ content: [{ type: 'text', text: 'No active game' }], isError: true });

    const hidden: any = await call({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'fail' } }, [failing(new Error('SQL broke'))]);
    expect(hidden.result).toEqual({ content: [{ type: 'text', text: 'Internal error' }], isError: true });
  });

  it('rejects unknown tools, unknown methods and malformed messages', async () => {
    expect(await call({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'nope' } })).toMatchObject({ error: { code: -32602 } });
    expect(await call({ jsonrpc: '2.0', id: 7, method: 'resources/list' })).toMatchObject({ error: { code: -32601 } });
    expect(await call({ id: 8, method: 'ping' })).toMatchObject({ id: 8, error: { code: -32600 } });
  });
});
