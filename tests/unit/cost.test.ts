import { describe, it, expect, beforeEach } from 'vitest';
import { CostTracker } from '../../src/cost/tracker.js';
import { Pricing } from '../../src/cost/pricing.js';
import { BudgetManager } from '../../src/cost/budget-manager.js';
import { CostReporter } from '../../src/cost/reporter.js';

describe('Cost', () => {
  describe('CostTracker', () => {
    let tracker: CostTracker;

    beforeEach(() => {
      tracker = new CostTracker({ budgetLimit: 10 });
    });

    it('should track costs correctly', () => {
      const result = tracker.recordCost('sample-1', 0.05);
      expect(result.cost).toBe(0.05);
      expect(result.withinBudget).toBe(true);
    });

    it('should detect budget exceeded', () => {
      const tracker = new CostTracker({ budgetLimit: 10, hardLimit: true });
      tracker.recordCost('sample-1', 5);
      tracker.recordCost('sample-2', 6);
      const result = tracker.recordCost('sample-3', 0.01);
      expect(result.withinBudget).toBe(false);
      expect(result.shouldStop).toBe(true);
    });

    it('should calculate average cost', () => {
      tracker.recordCost('sample-1', 0.1);
      tracker.recordCost('sample-2', 0.2);
      expect(tracker.getAverageCost()).toBe(0.15);
    });

    it('should provide cost breakdown', () => {
      tracker.recordCost(
        'sample-1',
        0.1,
        { input: 100, output: 50, total: 150 },
        'faithfulness',
        'anthropic'
      );
      tracker.recordCost(
        'sample-2',
        0.05,
        { input: 50, output: 25, total: 75 },
        'relevance',
        'openai'
      );
      const breakdown = tracker.getBreakdown();
      expect(breakdown.total).toBe(0.15);
      expect(breakdown.by_metric.faithfulness).toBe(0.1);
      expect(breakdown.by_provider.anthropic).toBe(0.1);
    });

    it('should reset tracker', () => {
      tracker.recordCost('sample-1', 0.1);
      tracker.reset();
      expect(tracker.getTotalCost()).toBe(0);
      expect(tracker.getCount()).toBe(0);
    });
  });

  describe('Pricing', () => {
    let pricing: Pricing;

    beforeEach(() => {
      pricing = new Pricing();
    });

    it('should return correct pricing for known models', () => {
      const config = pricing.getPricing('claude-opus', 'anthropic');
      expect(config.input).toBe(15.0);
      expect(config.output).toBe(75.0);
    });

    it('should return default pricing for unknown models', () => {
      const config = pricing.getPricing('unknown-model', 'openai');
      expect(config.input).toBe(2.5);
      expect(config.output).toBe(10.0);
    });

    it('should calculate cost correctly', () => {
      const cost = pricing.calculateCost('claude-opus', 'anthropic', 1000000, 500000);
      expect(cost).toBe(52.5);
    });

    it('should add custom model pricing', () => {
      pricing.addModelPricing({
        model: 'custom-model',
        provider: 'openai',
        inputCostPerMillion: 1.0,
        outputCostPerMillion: 2.0,
      });
      const config = pricing.getPricing('custom-model', 'openai');
      expect(config.input).toBe(1.0);
      expect(config.output).toBe(2.0);
    });
  });

  describe('BudgetManager', () => {
    let manager: BudgetManager;

    beforeEach(() => {
      manager = new BudgetManager({
        budgetLimit: 10,
        hardLimit: false,
        alertThresholds: [0.5, 0.75, 0.9],
      });
    });

    it('should track spending and alert at thresholds', () => {
      manager.recordSpend(5);
      const alerts = manager.getActiveAlerts();
      expect(alerts.length).toBe(1);
      expect(alerts[0]?.threshold).toBe(0.5);
    });

    it('should stop when hard limit exceeded', () => {
      const manager = new BudgetManager({ budgetLimit: 10, hardLimit: true });
      const result1 = manager.recordSpend(7);
      expect(result1.withinBudget).toBe(true);
      const result2 = manager.recordSpend(4);
      expect(result2.shouldStop).toBe(true);
    });

    it('should suggest optimization when budget is high', () => {
      manager.recordSpend(9.5);
      const suggestions = manager.suggestOptimization();
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should reset correctly', () => {
      manager.recordSpend(5);
      manager.reset();
      expect(manager.getTotalSpent()).toBe(0);
      expect(manager.isWithinBudget()).toBe(true);
    });
  });

  describe('CostReporter', () => {
    let reporter: CostReporter;

    beforeEach(() => {
      reporter = new CostReporter();
    });

    it('should generate report', () => {
      const breakdown = {
        total: 1.5,
        by_metric: { faithfulness: 0.75, relevance: 0.75 },
        by_provider: { anthropic: 1.0, openai: 0.5 },
        per_sample: [
          { sample_id: 'sample-1', cost: 0.5 },
          { sample_id: 'sample-2', cost: 1.0 },
        ],
      };
      const report = reporter.generateReport(breakdown);
      expect(report.totalCost).toBe(1.5);
      expect(report.costPerSample).toBe(0.75);
    });

    it('should generate JUnit XML', () => {
      const breakdown = {
        total: 1.0,
        by_metric: {},
        by_provider: {},
        per_sample: [],
      };
      const xml = reporter.generateJUnitXml(breakdown);
      expect(xml).toContain('testsuite');
      expect(xml).toContain('CostReport');
    });

    it('should calculate trend correctly', () => {
      reporter.addHistoricalCost('2024-01-01', 1.0);
      reporter.addHistoricalCost('2024-01-02', 1.2);
      reporter.addHistoricalCost('2024-01-03', 1.5);
      const report = reporter.generateReport({
        total: 0,
        by_metric: {},
        by_provider: {},
        per_sample: [],
      });
      expect(report.trend).toBe('increasing');
    });
  });
});
