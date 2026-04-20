import { Command } from 'commander';
import { startMcpServer } from '../../mcp-server/mcp-server.js';

export function createMcpServerCommand(): Command {
  const command = new Command('mcp-server');
  command.description('Start the rag-eval-pack MCP server on stdio');

  command.action(async () => {
    await startMcpServer();
  });

  return command;
}
