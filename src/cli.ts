#!/usr/bin/env node

import { Command } from 'commander';
import {
  createEvaluateCommand,
  createGateCommand,
  createCompareCommand,
  createCostCommand,
  createReportCommand,
  createJudgeCommand,
  createMcpServerCommand,
} from './cli/commands/index.js';

const program = new Command();

program
  .name('rag-eval-pack')
  .description('RAG evaluation metrics with LLM-as-judge, cost accounting, and CI gates')
  .version('0.1.0');

program.addCommand(createEvaluateCommand());
program.addCommand(createGateCommand());
program.addCommand(createCompareCommand());
program.addCommand(createCostCommand());
program.addCommand(createReportCommand());
program.addCommand(createJudgeCommand());
program.addCommand(createMcpServerCommand());

program.parse();
