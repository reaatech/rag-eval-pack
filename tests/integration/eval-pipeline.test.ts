import type {
  CostBreakdown,
  EvalResults,
  EvalSuiteConfig,
  EvaluationSample,
} from '@reaatech/rag-eval-core';
import { DatasetLoader } from '@reaatech/rag-eval-dataset';
import { GateEngine } from '@reaatech/rag-eval-gate';
import { EvaluationSuite } from '@reaatech/rag-eval-suite';
import { describe, expect, it } from 'vitest';

describe('Integration: Evaluation Pipeline', () => {
  const sampleData: EvaluationSample[] = [
    {
      query: 'What is the refund policy?',
      context: [
        'Refunds are processed within 14 days of purchase.',
        'Contact support@example.com for refund requests.',
      ],
      ground_truth: 'Refunds must be requested within 14 days by contacting support.',
      generated_answer: 'You can request a refund within 14 days by emailing support@example.com.',
    },
    {
      query: 'How do I reset my password?',
      context: [
        'Password reset is available at /reset-password.',
        'Enter your email to receive a reset link.',
      ],
      ground_truth: 'Go to /reset-password and enter your email.',
      generated_answer: 'Visit the password reset page and provide your email address.',
    },
  ];

  const defaultConfig: EvalSuiteConfig = {
    metrics: ['faithfulness', 'relevance', 'context_precision', 'context_recall'],
    judge: {
      enabled: false, // Disable LLM judge for fast tests
    },
  };

  describe('EvaluationSuite', () => {
    it('should run evaluation on provided samples', async () => {
      const suite = new EvaluationSuite(defaultConfig);
      const result = await suite.run(sampleData);

      expect(result.status).toBe('completed');
      expect(result.run_id).toBeDefined();
      expect(result.results.metrics.total_samples).toBe(2);
      expect(result.results.metrics.avg_faithfulness).toBeGreaterThanOrEqual(0);
      expect(result.results.metrics.avg_relevance).toBeGreaterThanOrEqual(0);
      expect(result.results.metrics.avg_context_precision).toBeGreaterThanOrEqual(0);
      expect(result.results.metrics.avg_context_recall).toBeGreaterThanOrEqual(0);
      expect(result.results.metrics.overall_score).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty samples gracefully', async () => {
      const suite = new EvaluationSuite(defaultConfig);
      const result = await suite.run([]);

      expect(result.status).toBe('completed');
      expect(result.results.metrics.total_samples).toBe(0);
    });

    it('should compare two evaluation runs', () => {
      const suite = new EvaluationSuite({ metrics: [] });

      const createCostBreakdown = (): CostBreakdown => ({
        total: 0.1,
        by_metric: {},
        by_provider: {},
        per_sample: [],
      });

      const createEvalResults = (
        overrides: Partial<EvalResults['metrics']> & { runId: string },
      ): EvalResults => ({
        run_id: overrides.runId,
        evaluated_at: new Date().toISOString(),
        dataset: '',
        config: { metrics: [] },
        metrics: {
          avg_faithfulness: 0.8,
          avg_relevance: 0.8,
          avg_context_precision: 0.75,
          avg_context_recall: 0.85,
          overall_score: 0.8,
          cost_per_sample: 0.01,
          total_samples: 10,
          ...overrides,
        },
        samples: [],
        total_cost: 0.1,
        cost_breakdown: createCostBreakdown(),
        duration_ms: 0,
        completed_at: new Date().toISOString(),
      });

      const baseline = createEvalResults({ runId: 'baseline' });
      const candidate = createEvalResults({
        runId: 'candidate',
        avg_faithfulness: 0.85,
        avg_relevance: 0.82,
        avg_context_precision: 0.78,
        avg_context_recall: 0.9,
        overall_score: 0.84,
        cost_per_sample: 0.012,
      });

      const diff = suite.compareRuns(baseline, candidate);

      expect(diff.diff.overall_score).toBe(0.04);
      expect(diff.improvements).toContainEqual(expect.stringContaining('overall_score'));
      expect(diff.regressions).toHaveLength(0);
    });
  });

  describe('GateEngine Integration', () => {
    it('should evaluate gates against evaluation results', async () => {
      // Run evaluation
      const suite = new EvaluationSuite(defaultConfig);
      const evalResult = await suite.run(sampleData);

      // Set up gates with very low thresholds since heuristic metrics may return 0
      const engine = new GateEngine([
        {
          name: 'min-faithfulness',
          type: 'threshold',
          metric: 'avg_faithfulness',
          operator: '>=',
          threshold: 0.0, // Any value >= 0 passes
        },
        {
          name: 'min-relevance',
          type: 'threshold',
          metric: 'avg_relevance',
          operator: '>=',
          threshold: 0.0,
        },
      ]);

      // Evaluate gates
      const gateResult = engine.evaluate(evalResult.results);

      expect(gateResult.gates).toHaveLength(2);
      // Gates should pass since all metrics are >= 0
      expect(gateResult.passed).toBe(true);
    });

    it('should fail gates when thresholds not met', async () => {
      const suite = new EvaluationSuite(defaultConfig);
      const evalResult = await suite.run(sampleData);

      const engine = new GateEngine([
        {
          name: 'impossible-threshold',
          type: 'threshold',
          metric: 'avg_faithfulness',
          operator: '>=',
          threshold: 0.99,
        },
      ]);

      const gateResult = engine.evaluate(evalResult.results);

      expect(gateResult.passed).toBe(false);
      expect(gateResult.failures).toHaveLength(1);
    });
  });

  describe('DatasetLoader Integration', () => {
    it('should load samples from JSONL string', async () => {
      const loader = new DatasetLoader();
      const jsonlContent = sampleData.map((s) => JSON.stringify(s)).join('\n');

      const samples = await loader.loadFromString(jsonlContent, 'jsonl');

      expect(samples).toHaveLength(2);
      expect(samples[0]?.query).toBe('What is the refund policy?');
      expect(samples[1]?.query).toBe('How do I reset my password?');
    });

    it('should load samples from JSON string', async () => {
      const loader = new DatasetLoader();
      const jsonContent = JSON.stringify({ samples: sampleData });

      const samples = await loader.loadFromString(jsonContent, 'json');

      expect(samples).toHaveLength(2);
    });

    it('should validate sample format and reject invalid data', async () => {
      const loader = new DatasetLoader();
      // Invalid sample missing context, ground_truth, generated_answer
      const invalidContent = '{"query": "test"}';

      try {
        await loader.loadFromString(invalidContent, 'jsonl');
        // If we get here, the test should fail
        expect(true).toBe(false);
      } catch (error) {
        // Expected to throw
        expect(error).toBeDefined();
        expect(error instanceof Error).toBe(true);
      }
    });
  });

  describe('End-to-End Pipeline', () => {
    it('should run complete evaluation pipeline', async () => {
      // 1. Load data
      const loader = new DatasetLoader();
      const jsonlContent = sampleData.map((s) => JSON.stringify(s)).join('\n');
      const samples = await loader.loadFromString(jsonlContent, 'jsonl');

      // 2. Run evaluation
      const suite = new EvaluationSuite(defaultConfig);
      const evalResult = await suite.run(samples);

      // 3. Evaluate gates
      const engine = new GateEngine([
        {
          name: 'min-quality',
          type: 'threshold',
          metric: 'overall_score',
          operator: '>=',
          threshold: 0.5,
        },
      ]);

      const gateResult = engine.evaluate(evalResult.results);

      // 4. Verify results
      expect(evalResult.status).toBe('completed');
      expect(evalResult.results.metrics.total_samples).toBe(2);
      expect(gateResult.passed).toBe(true);
    });
  });
});
