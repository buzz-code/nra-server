import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod';
import { buildMcpServer } from '../mcp-server.factory';
import { McpTool, McpToolError } from '../mcp.types';

describe('buildMcpServer', () => {
  const echo: McpTool = {
    name: 'echo',
    description: 'Echoes input and user',
    inputSchema: { word: z.string().optional() },
    handler: async (input, ctx) => ({ input, userId: ctx.userId }),
  };
  const failing = (error: Error): McpTool => ({ ...echo, name: 'fail', handler: async () => Promise.reject(error) });

  const connect = async (tools: McpTool[], instructions?: string) => {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await buildMcpServer(tools, { userId: 7 }, instructions).connect(serverSide);
    const client = new Client({ name: 'test', version: '1' });
    await client.connect(clientSide);
    return client;
  };

  it('lists tools as read-only and runs them as the context user', async () => {
    const client = await connect([echo]);
    const { tools } = await client.listTools();
    expect(tools).toEqual([expect.objectContaining({ name: 'echo', annotations: { readOnlyHint: true } })]);

    const result: any = await client.callTool({ name: 'echo', arguments: { word: 'hi' } });
    expect(JSON.parse(result.content[0].text)).toEqual({ input: { word: 'hi' }, userId: 7 });
  });

  it('sends the app instructions and a tool\'s own annotations', async () => {
    const writer: McpTool = { ...echo, name: 'write', annotations: { destructiveHint: true } };
    const client = await connect([writer], 'Use write carefully');
    expect(client.getInstructions()).toBe('Use write carefully');
    const { tools } = await client.listTools();
    expect(tools[0].annotations).toEqual({ destructiveHint: true });
  });

  it('rejects input that does not match the schema', async () => {
    const client = await connect([echo]);
    const result: any = await client.callTool({ name: 'echo', arguments: { word: 5 } }).catch((e) => ({ isError: true, message: e.message }));
    expect(result.isError).toBe(true);
  });

  it('shows McpToolError messages but hides other errors', async () => {
    const shown: any = await (await connect([failing(new McpToolError('No active game'))])).callTool({ name: 'fail', arguments: {} });
    expect(shown).toMatchObject({ content: [{ type: 'text', text: 'No active game' }], isError: true });

    const hidden: any = await (await connect([failing(new Error('SQL broke'))])).callTool({ name: 'fail', arguments: {} });
    expect(hidden).toMatchObject({ content: [{ type: 'text', text: 'Internal error' }], isError: true });
  });
});
