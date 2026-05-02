import type { CostBreakdown, LLMProvider, SampleCost, TokenCount } from '@reaatech/rag-eval-core';
import { Pricing, type PricingConfig } from '@reaatech/rag-eval-cost';

/**
 * Pricing information for a model
 */
export type ModelPricing = PricingConfig;

/**
 * Judge Cost Tracker
 *
 * Tracks and calculates costs for LLM-as-judge operations.
 * Delegates price lookup to the shared {@link Pricing} table.
 */
export class JudgeCostTracker {
  private costs: SampleCost[] = [];
  private totalCost = 0;
  private costByMetric: Record<string, number> = {};
  private costByProvider: Record<string, number> = {};
  private budgetLimit: number = Number.POSITIVE_INFINITY;
  private alertThresholds: number[] = [0.5, 0.75, 0.9];
  private alertsTriggered: number[] = [];
  private pricing: Pricing;

  constructor(config?: { budgetLimit?: number; alertThresholds?: number[]; pricing?: Pricing }) {
    if (config?.budgetLimit) {
      this.budgetLimit = config.budgetLimit;
    }
    if (config?.alertThresholds) {
      this.alertThresholds = config.alertThresholds;
    }
    this.pricing = config?.pricing ?? new Pricing();
  }

  /**
   * Get pricing for a model
   */
  getPricing(model: string, provider: LLMProvider): ModelPricing {
    return this.pricing.getPricing(model, provider);
  }

  /**
   * Estimate tokens for a text
   */
  estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate cost for a single judgment
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
   * Record a judgment cost
   */
  recordCost(
    sampleId: string | number,
    model: string,
    provider: LLMProvider,
    inputTokens: number,
    outputTokens: number,
    metric?: string,
  ): { cost: number; withinBudget: boolean; alertTriggered: boolean } {
    const cost = this.calculateCost(model, provider, inputTokens, outputTokens);

    this.costs.push({
      sample_id: sampleId,
      cost,
      tokens: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      },
    });

    this.totalCost += cost;

    if (metric) {
      this.costByMetric[metric] = (this.costByMetric[metric] || 0) + cost;
    }

    this.costByProvider[provider] = (this.costByProvider[provider] || 0) + cost;

    // Check budget
    const withinBudget = this.totalCost <= this.budgetLimit;

    // Check alert thresholds
    let alertTriggered = false;
    const budgetRatio = this.totalCost / this.budgetLimit;
    for (const threshold of this.alertThresholds) {
      if (budgetRatio >= threshold && !this.alertsTriggered.includes(threshold)) {
        this.alertsTriggered.push(threshold);
        alertTriggered = true;
      }
    }

    return {
      cost: Math.round(cost * 10000) / 10000,
      withinBudget,
      alertTriggered,
    };
  }

  /**
   * Estimate cost for a judgment without recording
   */
  estimateCost(
    model: string,
    provider: LLMProvider,
    inputText: string,
    outputEstimate?: number,
  ): { cost: number; tokens: TokenCount } {
    const inputTokens = this.estimateTokens(inputText);
    const outputTokens = outputEstimate ?? Math.ceil(inputTokens * 0.3); // Estimate 30% of input

    const cost = this.calculateCost(model, provider, inputTokens, outputTokens);

    return {
      cost: Math.round(cost * 10000) / 10000,
      tokens: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      },
    };
  }

  /**
   * Get current total cost
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
    return Math.max(0, this.budgetLimit - this.totalCost);
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
   * Get number of judgments tracked
   */
  getJudgmentCount(): number {
    return this.costs.length;
  }

  /**
   * Get average cost per judgment
   */
  getAverageCost(): number {
    if (this.costs.length === 0) return 0;
    return Math.round((this.totalCost / this.costs.length) * 10000) / 10000;
  }
}
