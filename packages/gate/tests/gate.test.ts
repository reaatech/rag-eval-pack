import type { EvalResults } from '@reaatech/rag-eval-core';
import { GateEngine } from '@reaatech/rag-eval-gate';
import { beforeEach, describe, expect, it } from 'vitest';

describe('GateEngine', () => {
  let engine: GateEngine;

  beforeEach(() => {
    engine = new GateEngine();
  });

  const createMockResults = (overrides: Partial<EvalResults> = {}): EvalResults => ({
    run_id: 'test-run',
    evaluated_at: new Date().toISOString(),
    dataset: 'test-dataset',
    config: { metrics: ['faithfulness'] },
    metrics: {
      avg_faithfulness: 0.87,
      avg_relevance: 0.82,
      avg_context_precision: 0.78,
      avg_context_recall: 0.91,
      overall_score: 0.845,
      cost_per_sample: 0.015,
      total_samples: 10,
    },
    samples: [],
    total_cost: 0.15,
    cost_breakdown: { total: 0.15, by_metric: {}, by_provider: {}, per_sample: [] },
    duration_ms: 100,
    completed_at: new Date().toISOString(),
    ...overrides,
  });

  describe('threshold gates', () => {
    it('should pass when metric meets threshold', () => {
      engine.loadGates([
        {
          name: 'min-faithfulness',
          type: 'threshold',
          metric: 'avg_faithfulness',
          operator: '>=',
          threshold: 0.85,
        },
      ]);

      const results = createMockResults();
      const gateResult = engine.evaluate(results);

      expect(gateResult.passed).toBe(true);
      expect(gateResult.failures).toHaveLength(0);
    });

    it('should fail when metric below threshold', () => {
      engine.loadGates([
        {
          name: 'min-faithfulness',
          type: 'threshold',
          metric: 'avg_faithfulness',
          operator: '>=',
          threshold: 0.9,
        },
      ]);

      const results = createMockResults();
      const gateResult = engine.evaluate(results);

      expect(gateResult.passed).toBe(false);
      expect(gateResult.failures).toHaveLength(1);
      expect(gateResult.failures[0]?.gate_name).toBe('min-faithfulness');
    });

    it('should support <= operator for cost gates', () => {
      engine.loadGates([
        {
          name: 'max-cost',
          type: 'threshold',
          metric: 'cost_per_sample',
          operator: '<=',
          threshold: 0.05,
        },
      ]);

      const results = createMockResults();
      const gateResult = engine.evaluate(results);

      expect(gateResult.passed).toBe(true);
    });
  });

  describe('baseline comparison gates', () => {
    it('should pass when no regression allowed and candidate improves', () => {
      engine.loadGates([
        {
          name: 'no-regression',
          type: 'baseline-comparison',
          metric: 'overall_score',
          allow_regression: false,
        },
      ]);

      const baseline = createMockResults();
      baseline.metrics.overall_score = 0.8;
      const candidate = createMockResults();
      candidate.metrics.overall_score = 0.85;

      const gateResult = engine.evaluate(candidate, baseline);

      expect(gateResult.passed).toBe(true);
    });

    it('should fail when regression detected', () => {
      engine.loadGates([
        {
          name: 'no-regression',
          type: 'baseline-comparison',
          metric: 'overall_score',
          allow_regression: false,
        },
      ]);

      const baseline = createMockResults();
      baseline.metrics.overall_score = 0.9;
      const candidate = createMockResults();
      candidate.metrics.overall_score = 0.8;

      const gateResult = engine.evaluate(candidate, baseline);

      expect(gateResult.passed).toBe(false);
      expect(gateResult.failures).toHaveLength(1);
    });

    it('should pass when regression allowed', () => {
      engine.loadGates([
        {
          name: 'allow-regression',
          type: 'baseline-comparison',
          metric: 'overall_score',

          allow_regression: true,
        },
      ]);

      const baseline = createMockResults();
      baseline.metrics.overall_score = 0.9;
      const candidate = createMockResults();
      candidate.metrics.overall_score = 0.8;

      const gateResult = engine.evaluate(candidate, baseline);

      expect(gateResult.passed).toBe(true);
    });
  });

  describe('multiple gates', () => {
    it('should evaluate all gates and report failures', () => {
      engine.loadGates([
        {
          name: 'min-faithfulness',
          type: 'threshold',
          metric: 'avg_faithfulness',
          operator: '>=',
          threshold: 0.9,
        },
        {
          name: 'min-relevance',
          type: 'threshold',
          metric: 'avg_relevance',
          operator: '>=',
          threshold: 0.8,
        },
      ]);

      const results = createMockResults();
      const gateResult = engine.evaluate(results);

      expect(gateResult.passed).toBe(false);
      expect(gateResult.gates).toHaveLength(2);
      expect(gateResult.failures).toHaveLength(1);
      expect(gateResult.failures[0]?.gate_name).toBe('min-faithfulness');
    });

    it('should pass all gates when all thresholds met', () => {
      engine.loadGates([
        {
          name: 'min-faithfulness',
          type: 'threshold',
          metric: 'avg_faithfulness',
          operator: '>=',
          threshold: 0.85,
        },
        {
          name: 'min-relevance',
          type: 'threshold',
          metric: 'avg_relevance',
          operator: '>=',
          threshold: 0.8,
        },
      ]);

      const results = createMockResults();
      const gateResult = engine.evaluate(results);

      expect(gateResult.passed).toBe(true);
      expect(gateResult.failures).toHaveLength(0);
    });
  });

  describe('gate management', () => {
    it('should add gates dynamically', () => {
      engine.addGate({
        name: 'min-faithfulness',
        type: 'threshold',
        metric: 'avg_faithfulness',
        operator: '>=',
        threshold: 0.85,
      });

      expect(engine.getGates()).toHaveLength(1);
    });

    it('should remove gates by name', () => {
      engine.addGate({
        name: 'gate-to-remove',
        type: 'threshold',
        metric: 'avg_faithfulness',
        operator: '>=',
        threshold: 0.85,
      });

      engine.removeGate('gate-to-remove');
      expect(engine.getGates()).toHaveLength(0);
    });

    it('should clear all gates', () => {
      engine.loadGates([
        {
          name: 'gate1',
          type: 'threshold',
          metric: 'avg_faithfulness',
          operator: '>=',
          threshold: 0.85,
        },
        {
          name: 'gate2',
          type: 'threshold',
          metric: 'avg_relevance',
          operator: '>=',
          threshold: 0.8,
        },
      ]);

      engine.clearGates();
      expect(engine.getGates()).toHaveLength(0);
    });
  });
});
