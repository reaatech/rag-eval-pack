#!/usr/bin/env node

import { startMcpServer } from './mcp-server.js';

startMcpServer().catch((error) => {
  console.error('Fatal error starting rag-eval-pack MCP server:', error);
  process.exit(1);
});
