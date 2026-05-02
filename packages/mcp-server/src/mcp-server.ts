#!/usr/bin/env node

/**
 * rag-eval-pack MCP Server
 *
 * Provides three-layer MCP tools for RAG evaluation:
 * - rag_eval.judge.* - Atomic evaluation operations
 * - rag_eval.suite.* - Orchestrated evaluation runs
 * - rag_eval.gate.* - CI-style pass/fail gates
 *
 * NOTE: This server uses in-memory state for run tracking and configuration.
 * In production deployments, consider persisting state to a database or file system.
 * Server restarts will lose all active run state and stored configurations.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createGateTools, handleGateTool } from './tools/gate/index.js';
import { createJudgeTools, handleJudgeTool } from './tools/judge/index.js';
import { createSuiteTools, handleSuiteTool } from './tools/suite/index.js';

export function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'rag-eval-pack',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [...createJudgeTools(), ...createSuiteTools(), ...createGateTools()],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name.startsWith('rag_eval.judge.')) {
      return handleJudgeTool(name, args ?? {});
    }

    if (name.startsWith('rag_eval.suite.')) {
      return handleSuiteTool(name, args ?? {});
    }

    if (name.startsWith('rag_eval.gate.')) {
      return handleGateTool(name, args ?? {});
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}

export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('rag-eval-pack MCP server running on stdio');
}

const isDirectExecution = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isDirectExecution) {
  startMcpServer().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
