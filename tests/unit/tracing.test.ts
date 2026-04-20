import { describe, it, expect } from 'vitest';
import {
  createSpan,
  withSpan,
  traceEvalRun,
  traceMetricCalculation,
  traceJudgeCall,
  traceGateEvaluation,
} from '../../src/observability/tracing.js';

describe('Tracing', () => {
  describe('createSpan', () => {
    it('should create a span with attributes', () => {
      const span = createSpan('test.operation', { run_id: 'test-123', metric: 'faithfulness' });
      expect(span).toBeDefined();
      span.end();
    });
  });

  describe('withSpan', () => {
    it('should execute function within span context', async () => {
      const result = await withSpan('test.operation', async (span) => {
        span.end();
        return 'success';
      });
      expect(result).toBe('success');
    });

    it('should throw error from within span', async () => {
      await expect(
        withSpan('test.operation', async (span) => {
          span.end();
          throw new Error('test error');
        })
      ).rejects.toThrow('test error');
    });
  });

  describe('traceEvalRun', () => {
    it('should trace evaluation run', async () => {
      const result = await traceEvalRun('run-123', async (span) => {
        span.end();
        return 'eval-complete';
      });
      expect(result).toBe('eval-complete');
    });
  });

  describe('traceMetricCalculation', () => {
    it('should trace metric calculation', async () => {
      const result = await traceMetricCalculation(
        'run-123',
        'sample-1',
        'faithfulness',
        async (span) => {
          span.end();
          return 0.95;
        }
      );
      expect(result).toBe(0.95);
    });
  });

  describe('traceJudgeCall', () => {
    it('should trace judge call', async () => {
      const result = await traceJudgeCall('run-123', 'sample-1', 'claude-opus', async (span) => {
        span.end();
        return { score: 0.9 };
      });
      expect(result.score).toBe(0.9);
    });
  });

  describe('traceGateEvaluation', () => {
    it('should trace gate evaluation', async () => {
      const result = await traceGateEvaluation('run-123', async (span) => {
        span.end();
        return { passed: true };
      });
      expect(result.passed).toBe(true);
    });
  });
});
