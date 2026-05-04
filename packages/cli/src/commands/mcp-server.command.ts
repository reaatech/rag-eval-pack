import { startMcpServer } from '@reaatech/rag-eval-mcp-server';
import { Command } from 'commander';

export function createMcpServerCommand(): Command {
  const command = new Command('mcp-server');
  command.description('Start the rag-eval-pack MCP server on stdio');

  command.action(async () => {
    await startMcpServer();
  });

  return command;
}
