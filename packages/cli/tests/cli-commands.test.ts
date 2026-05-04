import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCompareCommand } from '../src/commands/compare.command.js';
import { createCostCommand } from '../src/commands/cost.command.js';
import { createEvaluateCommand } from '../src/commands/evaluate.command.js';
import { createGateCommand } from '../src/commands/gate.command.js';
import { createJudgeCommand } from '../src/commands/judge.command.js';
import { createReportCommand } from '../src/commands/report.command.js';

describe('CLI Commands', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'rag-eval-pack-cli-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('createEvaluateCommand', () => {
    it('should create evaluate command with correct options', () => {
      const cmd = createEvaluateCommand();
      expect(cmd.name()).toBe('evaluate');
      expect(cmd.description()).toBeTruthy();
    });

    it('should write one file per requested output format', async () => {
      const datasetPath = join(tempDir, 'samples.jsonl');
      const outputPath = join(tempDir, 'results.json');
      writeFileSync(
        datasetPath,
        JSON.stringify({
          query: 'What is the refund policy?',
          context: ['Refunds are processed within 14 days of purchase.'],
          ground_truth: 'Refunds are processed within 14 days of purchase.',
          generated_answer: 'Refunds are processed within 14 days of purchase.',
        }),
      );

      const command = createEvaluateCommand();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await command.parseAsync(
        [
          'node',
          'evaluate',
          '--dataset',
          datasetPath,
          '--output',
          outputPath,
          '--format',
          'json,markdown',
          '--no-judge',
        ],
        { from: 'node' },
      );

      expect(JSON.parse(readFileSync(outputPath, 'utf-8')).run_id).toBeDefined();
      expect(readFileSync(join(tempDir, 'results.md'), 'utf-8')).toContain(
        '# RAG Evaluation Report',
      );
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('createGateCommand', () => {
    it('should create gate command with correct options', () => {
      const cmd = createGateCommand();
      expect(cmd.name()).toBe('gate');
      expect(cmd.description()).toBeTruthy();
    });
  });

  describe('createCompareCommand', () => {
    it('should create compare command with correct options', () => {
      const cmd = createCompareCommand();
      expect(cmd.name()).toBe('compare');
      expect(cmd.description()).toBeTruthy();
    });
  });

  describe('createCostCommand', () => {
    it('should create cost command with correct options', () => {
      const cmd = createCostCommand();
      expect(cmd.name()).toBe('cost');
      expect(cmd.description()).toBeTruthy();
    });
  });

  describe('createReportCommand', () => {
    it('should create report command with correct options', () => {
      const cmd = createReportCommand();
      expect(cmd.name()).toBe('report');
      expect(cmd.description()).toBeTruthy();
    });

    it('should accept YAML gate files when generating reports', async () => {
      const resultsPath = join(tempDir, 'results.json');
      const gatesPath = join(tempDir, 'gates.yaml');
      const outputPath = join(tempDir, 'report.md');

      writeFileSync(
        resultsPath,
        JSON.stringify({
          run_id: 'run-1',
          dataset: 'test',
          config: { metrics: ['faithfulness'] },
          samples: [],
          metrics: {
            overall_score: 0.9,
            avg_faithfulness: 0.9,
            avg_relevance: 0.9,
            avg_context_precision: 0.9,
            avg_context_recall: 0.9,
            cost_per_sample: 0.01,
            total_samples: 1,
          },
          total_cost: 0.01,
          cost_breakdown: { total: 0.01, by_metric: {}, by_provider: {}, per_sample: [] },
          duration_ms: 5,
          completed_at: '2026-04-20T00:00:00.000Z',
        }),
      );
      writeFileSync(
        gatesPath,
        `gates:\n  - name: min-faithfulness\n    type: threshold\n    metric: avg_faithfulness\n    operator: ">="\n    threshold: 0.85\n`,
      );

      const command = createReportCommand();
      vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await command.parseAsync(
        ['node', 'report', '--results', resultsPath, '--gates', gatesPath, '--output', outputPath],
        { from: 'node' },
      );

      expect(readFileSync(outputPath, 'utf-8')).toContain('| min-faithfulness | ✅ Pass |');
    });
  });

  describe('createJudgeCommand', () => {
    it('should create judge command with correct options', () => {
      const cmd = createJudgeCommand();
      expect(cmd.name()).toBe('judge');
      expect(cmd.description()).toBeTruthy();
    });
  });
});
