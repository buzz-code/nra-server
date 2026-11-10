import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod';
import { buildMcpServer } from '../mcp-server.factory';
import { McpPrompt, McpTool, McpToolError } from '../mcp.types';

describe('buildMcpServer', () => {
  const echo: McpTool = {
    name: 'echo',
    description: 'Echoes input and user',
    inputSchema: { word: z.string().optional() },
    handler: async (input, ctx) => ({ input, userId: ctx.userId }),
  };
  const failing = (error: Error): McpTool => ({ ...echo, name: 'fail', handler: async () => Promise.reject(error) });

  const connect = async (tools: McpTool[], instructions?: string, prompts?: McpPrompt[]) => {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await buildMcpServer(tools, { userId: 7 }, instructions, prompts).connect(serverSide);
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

  it('lists prompts and builds their message from the arguments', async () => {
    const greet: McpPrompt = {
      name: 'greet',
      title: 'Greet',
      description: 'Says hello',
      argsSchema: { who: z.string(), tone: z.string().optional() },
      build: ({ who, tone }) => `Say hello to ${who}${tone ? ` (${tone})` : ''}`,
    };
    const client = await connect([echo], undefined, [greet]);
    const { prompts } = await client.listPrompts();
    expect(prompts).toEqual([expect.objectContaining({
      name: 'greet', title: 'Greet', description: 'Says hello',
      arguments: [expect.objectContaining({ name: 'who', required: true }), expect.objectContaining({ name: 'tone', required: false })],
    })]);
    const { messages } = await client.getPrompt({ name: 'greet', arguments: { who: 'Dana' } });
    expect(messages).toEqual([{ role: 'user', content: { type: 'text', text: 'Say hello to Dana' } }]);
  });
});
