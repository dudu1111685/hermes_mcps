import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ZodRawShape, ZodTypeAny, z } from 'zod';
import { WAHAApiError } from '../client.js';

export interface ToolAnnotations {
  /** Tool only reads state, never modifies it */
  readOnlyHint?: boolean;
  /** Tool may perform irreversible destructive updates */
  destructiveHint?: boolean;
  /** Calling repeatedly with same args has no additional effect */
  idempotentHint?: boolean;
  /** Tool interacts with external entities (always true here — WhatsApp) */
  openWorldHint?: boolean;
}

type InferArgs<Shape extends ZodRawShape> = z.objectOutputType<Shape, ZodTypeAny>;

/**
 * Handler returns either a plain string (wrapped as a text block)
 * or a full CallToolResult for tools that need rich content (images, etc).
 */
export interface ToolDefinition<Shape extends ZodRawShape> {
  name: string;
  description: string;
  schema: Shape;
  annotations?: ToolAnnotations;
  handler: (args: InferArgs<Shape>) => Promise<string | CallToolResult>;
}

function errorResult(error: unknown): CallToolResult {
  let text: string;
  if (error instanceof WAHAApiError) {
    text = error.statusCode === 404
      ? `${error.message}\nHint: the resource (session/chat/message) may not exist — verify IDs with the relevant list tool.`
      : error.message;
  } else {
    text = (error as Error)?.message ?? String(error);
  }
  return { content: [{ type: 'text', text: `Error: ${text}` }], isError: true };
}

/**
 * Central tool registration: try/catch, MCP annotations, and string→content wrapping
 * in one place so individual tools stay declarative.
 */
export function defineTool<Shape extends ZodRawShape>(
  server: McpServer,
  def: ToolDefinition<Shape>,
): void {
  server.registerTool(
    def.name,
    {
      description: def.description,
      inputSchema: def.schema,
      annotations: { openWorldHint: true, ...def.annotations },
    },
    (async (args: InferArgs<Shape>): Promise<CallToolResult> => {
      try {
        const result = await def.handler(args);
        if (typeof result === 'string') {
          return { content: [{ type: 'text', text: result }] };
        }
        return result;
      } catch (error) {
        return errorResult(error);
      }
    }) as never,
  );
}
