import type { EvalResults } from '@reaatech/rag-eval-core';
import { Dashboard } from '@reaatech/rag-eval-observability';
import { beforeEach, describe, expect, it } from 'vitest';

function createMockEvalResults(override: Partial<EvalResults> = {}): EvalResults {
  return {
    run_id: 'run-1',
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
    ...override,
  };
}

describe('Dashboard', () => {
  let dashboard: Dashboard;

  beforeEach(() => {
    dashboard = new Dashboard();
  });

  describe('addRun', () => {
    it('should add eval results to history', () => {
      const results = createMockEvalResults({ run_id: 'run-1' });
      dashboard.addRun(results);
      const metrics = dashboard.getMetrics();
      expect(metrics.totalRuns).toBe(1);
    });
  });

  describe('getMetrics', () => {
    it('should return empty metrics when no runs', () => {
      const metrics = dashboard.getMetrics();
      expect(metrics.totalRuns).toBe(0);
      expect(metrics.averageScore).toBe(0);
    });

    it('should calculate averages correctly', () => {
      dashboard.addRun(
        createMockEvalResults({
          run_id: 'run-1',
          metrics: {
            overall_score: 0.8,
            avg_faithfulness: 0.8,
            avg_relevance: 0.8,
            avg_context_precision: 0.8,
            avg_context_recall: 0.8,
            cost_per_sample: 0.03,
            total_samples: 10,
          },
        }),
      );
      dashboard.addRun(
        createMockEvalResults({
          run_id: 'run-2',
          metrics: {
            overall_score: 0.9,
            avg_faithfulness: 0.9,
            avg_relevance: 0.9,
            avg_context_precision: 0.9,
            avg_context_recall: 0.9,
            cost_per_sample: 0.03,
            total_samples: 10,
          },
        }),
      );
      const metrics = dashboard.getMetrics();
      expect(metrics.averageScore).toBe(0.85);
    });
  });

  describe('getRecentRuns', () => {
    it('should return empty array when no runs', () => {
      expect(dashboard.getRecentRuns()).toEqual([]);
    });

    it('should return limited recent runs', () => {
      for (let i = 0; i < 15; i++) {
        dashboard.addRun(createMockEvalResults({ run_id: `run-${i}` }));
      }
      const recent = dashboard.getRecentRuns(5);
      expect(recent).toHaveLength(5);
      expect(recent[0]?.runId).toBe('run-10');
    });
  });

  describe('getQualityTrend', () => {
    it('should return stable with less than 3 runs', () => {
      dashboard.addRun(createMockEvalResults({ run_id: 'run-1' }));
      dashboard.addRun(createMockEvalResults({ run_id: 'run-2' }));
      expect(dashboard.getQualityTrend()).toBe('stable');
    });

    it('should return improving when recent scores are higher', () => {
      for (let i = 0; i < 8; i++) {
        const score = i < 5 ? 0.7 : 0.9;
        dashboard.addRun(
          createMockEvalResults({
            run_id: `run-${i}`,
            metrics: {
              overall_score: score,
              avg_faithfulness: score,
              avg_relevance: score,
              avg_context_precision: score,
              avg_context_recall: score,
              cost_per_sample: 0.03,
              total_samples: 10,
            },
          }),
        );
      }
      expect(dashboard.getQualityTrend()).toBe('improving');
    });

    it('should return declining when recent scores are lower', () => {
      for (let i = 0; i < 8; i++) {
        const score = i < 5 ? 0.9 : 0.7;
        dashboard.addRun(
          createMockEvalResults({
            run_id: `run-${i}`,
            metrics: {
              overall_score: score,
              avg_faithfulness: score,
              avg_relevance: score,
              avg_context_precision: score,
              avg_context_recall: score,
              cost_per_sample: 0.03,
              total_samples: 10,
            },
          }),
        );
      }
      expect(dashboard.getQualityTrend()).toBe('declining');
    });
  });

  describe('getCostTrend', () => {
    it('should return stable with less than 3 runs', () => {
      dashboard.addRun(createMockEvalResults({ run_id: 'run-1' }));
      expect(dashboard.getCostTrend()).toBe('stable');
    });
  });

  describe('clear', () => {
    it('should clear all run history', () => {
      dashboard.addRun(createMockEvalResults({ run_id: 'run-1' }));
      dashboard.clear();
      const metrics = dashboard.getMetrics();
      expect(metrics.totalRuns).toBe(0);
    });
  });
});
