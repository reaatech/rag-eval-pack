import { ThresholdGates } from '@reaatech/rag-eval-gate';
import type { ThresholdGateConfig } from '@reaatech/rag-eval-gate';
import { beforeEach, describe, expect, it } from 'vitest';

describe('ThresholdGates', () => {
  let gates: ThresholdGates;

  beforeEach(() => {
    gates = new ThresholdGates();
  });

  describe('evaluate', () => {
    it('should pass when value >= threshold with >= operator', () => {
      const gate: ThresholdGateConfig = {
        name: 'min-faithfulness',
        type: 'threshold',
        metric: 'avg_faithfulness',
        operator: '>=',
        threshold: 0.85,
      };
      const result = gates.evaluate(gate, 0.9);
      expect(result.passed).toBe(true);
      expect(result.actual_value).toBe(0.9);
    });

    it('should fail when value < threshold with >= operator', () => {
      const gate: ThresholdGateConfig = {
        name: 'min-faithfulness',
        type: 'threshold',
        metric: 'avg_faithfulness',
        operator: '>=',
        threshold: 0.85,
      };
      const result = gates.evaluate(gate, 0.8);
      expect(result.passed).toBe(false);
      expect(result.message).toContain('< 0.85');
    });

    it('should pass when value <= threshold with <= operator', () => {
      const gate: ThresholdGateConfig = {
        name: 'max-cost',
        type: 'threshold',
        metric: 'cost_per_sample',
        operator: '<=',
        threshold: 0.05,
      };
      const result = gates.evaluate(gate, 0.03);
      expect(result.passed).toBe(true);
    });

    it('should fail when value > threshold with <= operator', () => {
      const gate: ThresholdGateConfig = {
        name: 'max-cost',
        type: 'threshold',
        metric: 'cost_per_sample',
        operator: '<=',
        threshold: 0.05,
      };
      const result = gates.evaluate(gate, 0.1);
      expect(result.passed).toBe(false);
    });

    it('should pass when value > threshold with > operator', () => {
      const gate: ThresholdGateConfig = {
        name: 'high-score',
        type: 'threshold',
        metric: 'overall_score',
        operator: '>',
        threshold: 0.5,
      };
      const result = gates.evaluate(gate, 0.6);
      expect(result.passed).toBe(true);
    });

    it('should fail when value <= threshold with > operator', () => {
      const gate: ThresholdGateConfig = {
        name: 'high-score',
        type: 'threshold',
        metric: 'overall_score',
        operator: '>',
        threshold: 0.5,
      };
      const result = gates.evaluate(gate, 0.5);
      expect(result.passed).toBe(false);
    });

    it('should pass when value < threshold with < operator', () => {
      const gate: ThresholdGateConfig = {
        name: 'low-error',
        type: 'threshold',
        metric: 'error_rate',
        operator: '<',
        threshold: 0.1,
      };
      const result = gates.evaluate(gate, 0.05);
      expect(result.passed).toBe(true);
    });

    it('should pass when values equal with == operator', () => {
      const gate: ThresholdGateConfig = {
        name: 'exact-score',
        type: 'threshold',
        metric: 'overall_score',
        operator: '==',
        threshold: 0.85,
      };
      const result = gates.evaluate(gate, 0.85);
      expect(result.passed).toBe(true);
    });

    it('should fail when values not equal with == operator', () => {
      const gate: ThresholdGateConfig = {
        name: 'exact-score',
        type: 'threshold',
        metric: 'overall_score',
        operator: '==',
        threshold: 0.85,
      };
      const result = gates.evaluate(gate, 0.86);
      expect(result.passed).toBe(false);
    });
  });

  describe('evaluateAll', () => {
    it('should evaluate all gates', () => {
      const testGates: ThresholdGateConfig[] = [
        { name: 'gate1', type: 'threshold', metric: 'score1', operator: '>=', threshold: 0.5 },
        { name: 'gate2', type: 'threshold', metric: 'score2', operator: '>=', threshold: 0.6 },
      ];
      const getMetric = (metric: string): number => (metric === 'score1' ? 0.7 : 0.8);
      const results = gates.evaluateAll(testGates, getMetric);
      expect(results).toHaveLength(2);
      expect(results[0]?.passed).toBe(true);
      expect(results[1]?.passed).toBe(true);
    });
  });
});
