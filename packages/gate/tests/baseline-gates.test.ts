import type { EvalResults } from '@reaatech/rag-eval-core';
import { BaselineGates } from '@reaatech/rag-eval-gate';
import type { BaselineGateConfig } from '@reaatech/rag-eval-gate';
import { beforeEach, describe, expect, it } from 'vitest';

describe('BaselineGates', () => {
  let gates: BaselineGates;

  const mockBaselineResults: EvalResults = {
    run_id: 'baseline-1',
    dataset: 'test',
    config: { metrics: [] },
    samples: [],
    metrics: {
      overall_score: 0.85,
      avg_faithfulness: 0.8,
      avg_relevance: 0.85,
      avg_context_precision: 0.75,
      avg_context_recall: 0.9,
      cost_per_sample: 0.03,
      total_samples: 10,
    },
    total_cost: 0.3,
    cost_breakdown: { total: 0.3, by_metric: {}, by_provider: {}, per_sample: [] },
    duration_ms: 1000,
    completed_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    gates = new BaselineGates();
  });

  describe('evaluate', () => {
    it('should pass when regression is allowed', () => {
      const gate: BaselineGateConfig = {
        name: 'allow-regression',
        type: 'baseline-comparison',
        metric: 'avg_faithfulness',
        baseline: 'baseline-1',
        allow_regression: true,
      };
      const result = gates.evaluate(gate, 0.7, mockBaselineResults);
      expect(result.passed).toBe(true);
      expect(result.baseline_diff).toBeCloseTo(-0.1, 5);
    });

    it('should pass when improved by minimum improvement', () => {
      const gate: BaselineGateConfig = {
        name: 'improve',
        type: 'baseline-comparison',
        metric: 'avg_faithfulness',
        baseline: 'baseline-1',
        allow_regression: false,
        min_improvement: 0.05,
      };
      const result = gates.evaluate(gate, 0.86, mockBaselineResults);
      expect(result.passed).toBe(true);
    });

    it('should fail when regressed without allow_regression', () => {
      const gate: BaselineGateConfig = {
        name: 'no-regression',
        type: 'baseline-comparison',
        metric: 'avg_faithfulness',
        baseline: 'baseline-1',
        allow_regression: false,
      };
      const result = gates.evaluate(gate, 0.75, mockBaselineResults);
      expect(result.passed).toBe(false);
    });

    it('should handle negative baseline diff', () => {
      const gate: BaselineGateConfig = {
        name: 'check-diff',
        type: 'baseline-comparison',
        metric: 'avg_faithfulness',
        baseline: 'baseline-1',
        allow_regression: false,
      };
      const result = gates.evaluate(gate, 0.75, mockBaselineResults);
      expect(result.baseline_diff).toBeCloseTo(-0.05, 5);
      expect(result.message).toContain('regression');
    });
  });

  describe('evaluateAll', () => {
    it('should evaluate all baseline gates', () => {
      const candidateResults: EvalResults = {
        ...mockBaselineResults,
        run_id: 'candidate-1',
        metrics: {
          ...mockBaselineResults.metrics,
          avg_faithfulness: 0.82,
        },
      };

      const testGates: BaselineGateConfig[] = [
        {
          name: 'gate1',
          type: 'baseline-comparison',
          metric: 'avg_faithfulness',
          baseline: 'baseline-1',
          allow_regression: false,
          min_improvement: 0.01,
        },
      ];

      const results = gates.evaluateAll(testGates, candidateResults, mockBaselineResults);
      expect(results).toHaveLength(1);
      expect(results[0]?.passed).toBe(true);
    });
  });
});
