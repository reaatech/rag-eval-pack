import type { EvalResults } from '../types/domain.js';

export interface EvalRunSummary {
  runId: string;
  timestamp: string;
  overallScore: number;
  avgFaithfulness: number;
  avgRelevance: number;
  avgContextPrecision: number;
  avgContextRecall: number;
  cost: number;
  duration: number;
}

export interface DashboardMetrics {
  totalRuns: number;
  averageScore: number;
  averageCost: number;
  averageDuration: number;
  gatePassRate: number;
  recentRuns: EvalRunSummary[];
  qualityTrend: 'improving' | 'declining' | 'stable';
  costTrend: 'increasing' | 'decreasing' | 'stable';
}

export class Dashboard {
  private runHistory: EvalRunSummary[] = [];

  addRun(results: EvalResults): void {
    this.runHistory.push({
      runId: results.run_id,
      timestamp: results.completed_at,
      overallScore: results.metrics.overall_score,
      avgFaithfulness: results.metrics.avg_faithfulness,
      avgRelevance: results.metrics.avg_relevance,
      avgContextPrecision: results.metrics.avg_context_precision,
      avgContextRecall: results.metrics.avg_context_recall,
      cost: results.total_cost,
      duration: results.duration_ms,
    });
  }

  getMetrics(): DashboardMetrics {
    const runs = this.runHistory;
    const totalRuns = runs.length;

    if (totalRuns === 0) {
      return {
        totalRuns: 0,
        averageScore: 0,
        averageCost: 0,
        averageDuration: 0,
        gatePassRate: 0,
        recentRuns: [],
        qualityTrend: 'stable',
        costTrend: 'stable',
      };
    }

    const avgScore = runs.reduce((sum, r) => sum + r.overallScore, 0) / totalRuns;
    const avgCost = runs.reduce((sum, r) => sum + r.cost, 0) / totalRuns;
    const avgDuration = runs.reduce((sum, r) => sum + r.duration, 0) / totalRuns;

    const recentRuns = runs.slice(-10);

    const qualityTrend = this.calculateQualityTrend();
    const costTrend = this.calculateCostTrend();

    return {
      totalRuns,
      averageScore: Math.round(avgScore * 1000) / 1000,
      averageCost: Math.round(avgCost * 10000) / 10000,
      averageDuration: Math.round(avgDuration),
      gatePassRate: 0,
      recentRuns,
      qualityTrend,
      costTrend,
    };
  }

  getRecentRuns(count: number = 10): EvalRunSummary[] {
    return this.runHistory.slice(-count);
  }

  getQualityTrend(): 'improving' | 'declining' | 'stable' {
    return this.calculateQualityTrend();
  }

  getCostTrend(): 'increasing' | 'decreasing' | 'stable' {
    return this.calculateCostTrend();
  }

  private calculateQualityTrend(): 'improving' | 'declining' | 'stable' {
    if (this.runHistory.length < 3) return 'stable';

    const recent = this.runHistory.slice(-5);
    const older = this.runHistory.slice(-10, -5);

    if (older.length === 0) return 'stable';

    const recentAvg = recent.reduce((sum, r) => sum + r.overallScore, 0) / recent.length;
    const olderAvg = older.reduce((sum, r) => sum + r.overallScore, 0) / older.length;

    const diff = recentAvg - olderAvg;
    if (Math.abs(diff) < 0.01) return 'stable';
    return diff > 0 ? 'improving' : 'declining';
  }

  private calculateCostTrend(): 'increasing' | 'decreasing' | 'stable' {
    if (this.runHistory.length < 3) return 'stable';

    const recent = this.runHistory.slice(-5);
    const older = this.runHistory.slice(-10, -5);

    if (older.length === 0) return 'stable';

    const recentAvg = recent.reduce((sum, r) => sum + r.cost, 0) / recent.length;
    const olderAvg = older.reduce((sum, r) => sum + r.cost, 0) / older.length;

    const diff = recentAvg - olderAvg;
    if (Math.abs(diff) < 0.01) return 'stable';
    return diff > 0 ? 'increasing' : 'decreasing';
  }

  clear(): void {
    this.runHistory = [];
  }
}
