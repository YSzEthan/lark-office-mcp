#!/usr/bin/env node
/**
 * Lark MCP Server
 *
 * MCP server for Lark/Feishu API integration:
 * - Wiki: Read, write, search wiki documents
 * - Documents: Create, read, update, delete documents
 * - Tasks: Manage todos and tasklists
 *
 * Uses User Access Token (OAuth 2.0) for authentication.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerAuthTools } from "./tools/auth.js";
import { registerWikiTools } from "./tools/wiki.js";
import { registerDocTools } from "./tools/doc.js";
import { registerTodoTools } from "./tools/todo.js";

// Create MCP server instance
const server = new McpServer({
  name: "lark-mcp-server",
  version: "3.27.0",
});

// Register all tools
registerAuthTools(server);
registerWikiTools(server);
registerDocTools(server);
registerTodoTools(server);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Lark MCP Server v3.27.0 started");
}

main().catch((err) => {
  console.error("Server startup failed:", err);
  process.exit(1);
});
