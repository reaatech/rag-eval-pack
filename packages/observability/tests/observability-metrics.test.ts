import {
  recordCost,
  recordEvalComplete,
  recordEvalRun,
  recordGateResult,
  recordJudgeCall,
  recordMetricScore,
} from '@reaatech/rag-eval-observability';
import { describe, expect, it } from 'vitest';

describe('Observability Metrics', () => {
  describe('recordEvalRun', () => {
    it('should record eval run without throwing', () => {
      expect(() => recordEvalRun('run-123', 10)).not.toThrow();
    });
  });

  describe('recordJudgeCall', () => {
    it('should record judge call without throwing', () => {
      expect(() => recordJudgeCall('claude-opus', 'anthropic', 0.05)).not.toThrow();
    });
  });

  describe('recordGateResult', () => {
    it('should record passing gate result', () => {
      expect(() => recordGateResult('run-123', true)).not.toThrow();
    });

    it('should record failing gate result', () => {
      expect(() => recordGateResult('run-123', false)).not.toThrow();
    });
  });

  describe('recordCost', () => {
    it('should record cost', () => {
      expect(() => recordCost('run-123', 1.5)).not.toThrow();
    });
  });

  describe('recordMetricScore', () => {
    it('should record metric score', () => {
      expect(() => recordMetricScore('run-123', 'avg_faithfulness', 0.85)).not.toThrow();
    });
  });

  describe('recordEvalComplete', () => {
    it('should record complete evaluation metrics', () => {
      const metrics = {
        avg_faithfulness: 0.85,
        avg_relevance: 0.8,
        avg_context_precision: 0.75,
        avg_context_recall: 0.9,
        overall_score: 0.82,
      };
      expect(() => recordEvalComplete('run-123', metrics, 1.5, 5000)).not.toThrow();
    });
  });
});
