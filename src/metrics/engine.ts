import pLimit from 'p-limit';
import type {
  EvaluationSample,
  SampleEvalResult,
  EvalSuiteConfig,
  AggregatedMetrics,
} from '../types/domain.js';
import { FaithfulnessScorer } from './faithfulness.js';
import { RelevanceScorer } from './relevance.js';
import { ContextPrecisionScorer } from './context-precision.js';
import { ContextRecallScorer } from './context-recall.js';

/**
 * Metrics Engine
 *
 * Orchestrates the calculation of all RAG evaluation metrics.
 * Supports batch processing with parallel execution and rate limiting.
 */
export class MetricsEngine {
  private faithfulnessScorer: FaithfulnessScorer;
  private relevanceScorer: RelevanceScorer;
  private contextPrecisionScorer: ContextPrecisionScorer;
  private contextRecallScorer: ContextRecallScorer;
  private limit: ReturnType<typeof pLimit>;

  constructor(config?: { parallelJobs?: number }) {
    this.faithfulnessScorer = new FaithfulnessScorer();
    this.relevanceScorer = new RelevanceScorer();
    this.contextPrecisionScorer = new ContextPrecisionScorer();
    this.contextRecallScorer = new ContextRecallScorer();
    this.limit = pLimit(config?.parallelJobs ?? 5);
  }

  /**
   * Evaluate a single sample with all configured metrics
   */
  async evaluateSample(
    sample: EvaluationSample,
    config: EvalSuiteConfig,
    sampleId?: string | number
  ): Promise<SampleEvalResult> {
    const result: SampleEvalResult = {
      sample_id: sampleId ?? crypto.randomUUID(),
      sample,
      evaluated_at: new Date().toISOString(),
    };

    const metricPromises: Promise<void>[] = [];

    if (config.metrics.includes('faithfulness')) {
      metricPromises.push(
        this.limit(async () => {
          result.faithfulness = await this.faithfulnessScorer.score(sample);
        })
      );
    }

    if (config.metrics.includes('relevance')) {
      metricPromises.push(
        this.limit(async () => {
          result.relevance = await this.relevanceScorer.score(sample);
        })
      );
    }

    if (config.metrics.includes('context_precision')) {
      metricPromises.push(
        this.limit(async () => {
          result.context_precision = await this.contextPrecisionScorer.score(sample);
        })
      );
    }

    if (config.metrics.includes('context_recall')) {
      metricPromises.push(
        this.limit(async () => {
          result.context_recall = await this.contextRecallScorer.score(sample);
        })
      );
    }

    await Promise.all(metricPromises);

    // Calculate overall score as weighted average
    result.overall_score = this.calculateOverallScore(result, config);

    return result;
  }

  /**
   * Evaluate multiple samples in batch with parallel execution
   */
  async evaluateBatch(
    samples: EvaluationSample[],
    config: EvalSuiteConfig
  ): Promise<SampleEvalResult[]> {
    const promises = samples.map((sample, i) =>
      this.limit(() => this.evaluateSample(sample, config, i))
    );
    return Promise.all(promises);
  }

  /**
   * Calculate overall score from individual metrics
   */
  private calculateOverallScore(result: SampleEvalResult, config: EvalSuiteConfig): number {
    const scores: number[] = [];
    const weights: number[] = [];

    const defaultWeights: Record<string, number> = {
      faithfulness: 0.35,
      relevance: 0.3,
      context_precision: 0.15,
      context_recall: 0.2,
    };

    const customWeights = config.weights ?? {};
    const effectiveWeights = {
      faithfulness: customWeights.faithfulness ?? defaultWeights.faithfulness,
      relevance: customWeights.relevance ?? defaultWeights.relevance,
      context_precision: customWeights.context_precision ?? defaultWeights.context_precision,
      context_recall: customWeights.context_recall ?? defaultWeights.context_recall,
    };

    if (result.faithfulness) {
      scores.push(result.faithfulness!.score);
      weights.push(config.metrics.includes('faithfulness') ? effectiveWeights.faithfulness : 0);
    }

    if (result.relevance) {
      scores.push(result.relevance!.score);
      weights.push(config.metrics.includes('relevance') ? effectiveWeights.relevance : 0);
    }

    if (result.context_precision) {
      scores.push(result.context_precision!.score);
      weights.push(
        config.metrics.includes('context_precision') ? effectiveWeights.context_precision : 0
      );
    }

    if (result.context_recall) {
      scores.push(result.context_recall!.score);
      weights.push(config.metrics.includes('context_recall') ? effectiveWeights.context_recall : 0);
    }

    if (scores.length === 0) return 0;

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    if (totalWeight === 0) return 0;

    const weightedSum = scores.reduce((sum, score, i) => sum + score * (weights[i] || 0), 0);
    return Math.round((weightedSum / totalWeight) * 1000) / 1000;
  }

  /**
   * Aggregate results across multiple samples
   */
  aggregateResults(results: SampleEvalResult[]): AggregatedMetrics {
    const totalSamples = results.length;

    const faithfulnessScores = results
      .filter((r) => r.faithfulness)
      .map((r) => r.faithfulness!.score);
    const relevanceScores = results.filter((r) => r.relevance).map((r) => r.relevance!.score);
    const contextPrecisionScores = results
      .filter((r) => r.context_precision)
      .map((r) => r.context_precision!.score);
    const contextRecallScores = results
      .filter((r) => r.context_recall)
      .map((r) => r.context_recall!.score);
    const overallScores = results
      .filter((r) => r.overall_score !== undefined)
      .map((r) => r.overall_score!);

    return {
      overall_score: this.mean(overallScores),
      avg_faithfulness: this.mean(faithfulnessScores),
      avg_relevance: this.mean(relevanceScores),
      avg_context_precision: this.mean(contextPrecisionScores),
      avg_context_recall: this.mean(contextRecallScores),
      cost_per_sample: 0, // Will be calculated by cost tracker
      total_samples: totalSamples,
      std_dev: {
        faithfulness: this.stdDev(faithfulnessScores),
        relevance: this.stdDev(relevanceScores),
        context_precision: this.stdDev(contextPrecisionScores),
        context_recall: this.stdDev(contextRecallScores),
        overall: this.stdDev(overallScores),
      },
    };
  }

  /**
   * Calculate mean of an array of numbers
   */
  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return Math.round((sum / values.length) * 1000) / 1000;
  }

  /**
   * Calculate standard deviation
   */
  private stdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = this.mean(values);
    const squareDiffs = values.map((value) => Math.pow(value - mean, 2));
    const variance = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.round(Math.sqrt(variance) * 1000) / 1000;
  }
}
