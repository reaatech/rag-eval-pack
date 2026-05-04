import type { CostBreakdown, LLMProvider, SampleCost, TokenCount } from '@reaatech/rag-eval-core';
import { Pricing, type PricingConfig } from './pricing.js';

export type { PricingConfig };

/**
 * Cost Tracker
 *
 * Tracks and calculates costs for all evaluation operations.
 * Supports multiple providers with different pricing models.
 */
export class CostTracker {
  private costs: SampleCost[] = [];
  private totalCost = 0;
  private costByMetric: Record<string, number> = {};
  private costByProvider: Record<string, number> = {};
  private budgetLimit: number = Number.POSITIVE_INFINITY;
  private hardLimit = false;
  private alertThresholds: number[] = [0.5, 0.75, 0.9];
  private alertsTriggered: number[] = [];
  private pricing: Pricing;

  constructor(config?: {
    budgetLimit?: number;
    hardLimit?: boolean;
    alertThresholds?: number[];
    pricing?: Pricing;
  }) {
    if (config?.budgetLimit) {
      this.budgetLimit = config.budgetLimit;
    }
    if (config?.hardLimit !== undefined) {
      this.hardLimit = config.hardLimit;
    }
    if (config?.alertThresholds) {
      this.alertThresholds = config.alertThresholds;
    }
    this.pricing = config?.pricing ?? new Pricing();
  }

  /**
   * Get pricing for a model
   */
  getPricing(model: string, provider: LLMProvider): PricingConfig {
    return this.pricing.getPricing(model, provider);
  }

  /**
   * Estimate tokens for text
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate cost from tokens
   */
  calculateCost(
    model: string,
    provider: LLMProvider,
    inputTokens: number,
    outputTokens: number,
  ): number {
    return this.pricing.calculateCost(model, provider, inputTokens, outputTokens);
  }

  /**
   * Record a cost
   */
  recordCost(
    sampleId: string | number,
    cost: number,
    tokens?: TokenCount,
    metric?: string,
    provider?: string,
  ): { cost: number; withinBudget: boolean; shouldStop: boolean } {
    const sampleCost: SampleCost = {
      sample_id: sampleId,
      cost,
      tokens,
    };

    this.costs.push(sampleCost);
    this.totalCost += cost;

    if (metric) {
      this.costByMetric[metric] = (this.costByMetric[metric] || 0) + cost;
    }

    if (provider) {
      this.costByProvider[provider] = (this.costByProvider[provider] || 0) + cost;
    }

    const withinBudget = this.totalCost <= this.budgetLimit;
    const shouldStop = this.hardLimit && !withinBudget;

    // Check alert thresholds
    const budgetRatio = this.totalCost / this.budgetLimit;
    for (const threshold of this.alertThresholds) {
      if (budgetRatio >= threshold && !this.alertsTriggered.includes(threshold)) {
        this.alertsTriggered.push(threshold);
      }
    }

    return {
      cost: Math.round(cost * 10000) / 10000,
      withinBudget,
      shouldStop,
    };
  }

  /**
   * Get total cost
   */
  getTotalCost(): number {
    return Math.round(this.totalCost * 10000) / 10000;
  }

  /**
   * Check if within budget
   */
  isWithinBudget(): boolean {
    return this.totalCost <= this.budgetLimit;
  }

  /**
   * Get remaining budget
   */
  getRemainingBudget(): number {
    return Math.max(0, Math.round((this.budgetLimit - this.totalCost) * 10000) / 10000);
  }

  /**
   * Get budget usage ratio
   */
  getBudgetUsage(): number {
    if (this.budgetLimit === Number.POSITIVE_INFINITY) return 0;
    return Math.round((this.totalCost / this.budgetLimit) * 1000) / 1000;
  }

  /**
   * Get cost breakdown
   */
  getBreakdown(): CostBreakdown {
    return {
      total: Math.round(this.totalCost * 10000) / 10000,
      by_metric: { ...this.costByMetric },
      by_provider: { ...this.costByProvider },
      per_sample: this.costs.map((c) => ({
        sample_id: c.sample_id,
        cost: Math.round(c.cost * 10000) / 10000,
        tokens: c.tokens,
      })),
    };
  }

  /**
   * Reset tracker
   */
  reset(): void {
    this.costs = [];
    this.totalCost = 0;
    this.costByMetric = {};
    this.costByProvider = {};
    this.alertsTriggered = [];
  }

  /**
   * Get number of recorded costs
   */
  getCount(): number {
    return this.costs.length;
  }

  /**
   * Get average cost
   */
  getAverageCost(): number {
    if (this.costs.length === 0) return 0;
    return Math.round((this.totalCost / this.costs.length) * 10000) / 10000;
  }
}
