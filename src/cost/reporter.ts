import type { CostBreakdown, EvalResults } from '../types/domain.js';

export interface CostReport {
  totalCost: number;
  costPerSample: number;
  byMetric: Record<string, number>;
  byProvider: Record<string, number>;
  trend: 'increasing' | 'decreasing' | 'stable';
  projectedDailyCost?: number;
}

export interface JUnitCostReport {
  testcase: { name: string; time: string; classname: string };
  failures: number;
  tests: number;
}

export class CostReporter {
  private historicalCosts: { date: string; cost: number }[] = [];

  addHistoricalCost(date: string, cost: number): void {
    this.historicalCosts.push({ date, cost });
  }

  generateReport(costBreakdown: CostBreakdown, _results?: EvalResults): CostReport {
    const totalCost = costBreakdown.total;
    const totalSamples = costBreakdown.per_sample.length || 1;
    const costPerSample = totalCost / totalSamples;

    return {
      totalCost: Math.round(totalCost * 10000) / 10000,
      costPerSample: Math.round(costPerSample * 10000) / 10000,
      byMetric: costBreakdown.by_metric,
      byProvider: costBreakdown.by_provider,
      trend: this.calculateTrend(),
      projectedDailyCost: this.projectDailyCost(),
    };
  }

  generateSummary(costBreakdown: CostBreakdown): string {
    const report = this.generateReport(costBreakdown);
    const lines = [
      '## Cost Summary',
      '',
      `Total Cost: $${report.totalCost.toFixed(4)}`,
      `Cost Per Sample: $${report.costPerSample.toFixed(4)}`,
      '',
      '### By Metric',
      ...Object.entries(report.byMetric).map(
        ([metric, cost]) => `- ${metric}: $${cost.toFixed(4)}`
      ),
      '',
      '### By Provider',
      ...Object.entries(report.byProvider).map(
        ([provider, cost]) => `- ${provider}: $${cost.toFixed(4)}`
      ),
    ];
    return lines.join('\n');
  }

  exportToJson(costBreakdown: CostBreakdown, results?: EvalResults): string {
    const report = this.generateReport(costBreakdown, results);
    return JSON.stringify(report, null, 2);
  }

  generateJUnitXml(costBreakdown: CostBreakdown): string {
    const report = this.generateReport(costBreakdown);
    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite tests="1" failures="0" name="CostReport">
  <testcase name="cost" time="0" classname="CostReport">
    <system-out>Total: $${report.totalCost.toFixed(4)}, Per Sample: $${report.costPerSample.toFixed(4)}</system-out>
  </testcase>
</testsuite>`;
  }

  private calculateTrend(): 'increasing' | 'decreasing' | 'stable' {
    if (this.historicalCosts.length < 2) return 'stable';
    const recent = this.historicalCosts.slice(-5);
    const first = recent[0]!.cost;
    const last = recent[recent.length - 1]!.cost;
    const diff = last - first;
    if (Math.abs(diff) < 0.01) return 'stable';
    return diff > 0 ? 'increasing' : 'decreasing';
  }

  private projectDailyCost(): number | undefined {
    if (this.historicalCosts.length < 2) return undefined;
    const recent = this.historicalCosts.slice(-7);
    const avgCost = recent.reduce((sum, c) => sum + c.cost, 0) / recent.length;
    return Math.round(avgCost * 10000) / 10000;
  }

  clear(): void {
    this.historicalCosts = [];
  }
}
