/**
 * MCP server factory.
 *
 * Shared by both transports (stdio in index.ts, Streamable HTTP in http.ts)
 * so tool registration lives in exactly one place.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import pkg from "../package.json" with { type: "json" };
import { registerAuthTools } from "./tools/auth.js";
import { registerWikiTools } from "./tools/wiki.js";
import { registerDocTools } from "./tools/doc.js";
import { registerTodoTools } from "./tools/todo.js";

export const VERSION: string = pkg.version;

export function createServer(): McpServer {
  const server = new McpServer({
    name: "lark-mcp-server",
    version: VERSION,
  });

  registerAuthTools(server);
  registerWikiTools(server);
  registerDocTools(server);
  registerTodoTools(server);

  return server;
}
