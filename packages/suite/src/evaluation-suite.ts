import type {
  CostBreakdown,
  EvalResults,
  EvalSuiteConfig,
  EvaluationSample,
  GateResult,
  SampleEvalResult,
} from '@reaatech/rag-eval-core';
import { CostTracker } from '@reaatech/rag-eval-cost';
import { DatasetLoader } from '@reaatech/rag-eval-dataset';
import { GateEngine } from '@reaatech/rag-eval-gate';
import { JudgeCostTracker, JudgeEngine, type JudgeMetric } from '@reaatech/rag-eval-judge';
import { MetricsEngine } from '@reaatech/rag-eval-metrics';

/**
 * Evaluation Suite Run result
 */
export interface SuiteRunResult {
  run_id: string;
  status: 'completed' | 'partial' | 'failed';
  results: EvalResults;
  gate_result?: GateResult;
}

/**
 * Evaluation Suite
 *
 * Main entry point for running comprehensive RAG evaluations.
 * Orchestrates metrics calculation, LLM judging, cost tracking, and gate evaluation.
 */
export class EvaluationSuite {
  private config: EvalSuiteConfig;
  private metricsEngine: MetricsEngine;
  private judgeEngine?: JudgeEngine;
  private judgeCostTracker: JudgeCostTracker;
  private costTracker: CostTracker;
  private gateEngine?: GateEngine;
  private datasetLoader: DatasetLoader;
  private runId = '';
  private datasetPath = '';

  constructor(config: EvalSuiteConfig) {
    this.config = config;
    this.metricsEngine = new MetricsEngine({ parallelJobs: config.execution?.parallel_jobs ?? 5 });
    this.judgeCostTracker = new JudgeCostTracker({
      budgetLimit: config.judge?.cost?.budget_limit,
      alertThresholds: config.judge?.cost?.alert_thresholds,
    });
    this.costTracker = new CostTracker({
      budgetLimit: config.cost?.budget_limit,
      hardLimit: config.cost?.hard_limit,
      alertThresholds: config.cost?.alert_thresholds,
    });

    // Initialize judge if LLM judging is configured
    if (config.judge?.model) {
      this.judgeEngine = new JudgeEngine(config.judge);
    }

    // Initialize gate engine if gates are configured
    if (config.gates) {
      this.gateEngine = new GateEngine(config.gates);
    }

    this.datasetLoader = new DatasetLoader();
  }

  /**
   * Run evaluation on a dataset file
   */
  async runFromFile(datasetPath: string): Promise<SuiteRunResult> {
    this.datasetPath = datasetPath;
    const samples = await this.datasetLoader.load(datasetPath);
    return this.run(samples);
  }

  /**
   * Run evaluation on provided samples
   */
  async run(samples: EvaluationSample[], runId?: string): Promise<SuiteRunResult> {
    this.runId = runId ?? `eval-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const startTime = Date.now();
    const sampleResults: SampleEvalResult[] = [];
    let status: 'completed' | 'partial' | 'failed' = 'completed';

    // Run metrics evaluation
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      if (!sample) continue;

      try {
        // Run heuristic metrics
        const result = await this.metricsEngine.evaluateSample(sample, this.config, i);
        sampleResults.push(result);

        // Run LLM judge if configured
        if (this.judgeEngine && this.config.judge?.enabled !== false) {
          await this.runJudgeEvaluation(sample, result, i);
        }

        // Check budget
        if (!this.costTracker.isWithinBudget()) {
          status = 'partial';
          break;
        }
      } catch (error) {
        status = 'partial';
        console.error(`Error evaluating sample ${i}:`, error);
      }
    }

    const durationMs = Date.now() - startTime;

    // Aggregate results
    const aggregated = this.metricsEngine.aggregateResults(sampleResults);
    const totalCost = this.costTracker.getTotalCost();

    const results: EvalResults = {
      run_id: this.runId,
      evaluated_at: new Date().toISOString(),
      dataset: this.datasetPath,
      config: this.config,
      metrics: {
        ...aggregated,
        cost_per_sample: sampleResults.length > 0 ? totalCost / sampleResults.length : 0,
      },
      samples: sampleResults,
      total_cost: totalCost,
      cost_breakdown: this.costTracker.getBreakdown(),
      duration_ms: durationMs,
      completed_at: new Date().toISOString(),
    };

    // Run gate evaluation if configured
    let gateResult: GateResult | undefined;
    if (this.gateEngine) {
      gateResult = this.gateEngine.evaluate(results);
    }

    return {
      run_id: this.runId,
      status,
      results,
      gate_result: gateResult,
    };
  }

  /**
   * Run LLM judge evaluation on a sample
   */
  private async runJudgeEvaluation(
    sample: EvaluationSample,
    result: SampleEvalResult,
    index: number,
  ): Promise<void> {
    if (!this.judgeEngine) return;

    const metrics: JudgeMetric[] = ['faithfulness', 'relevance', 'overall'];

    for (const metric of metrics) {
      try {
        const judgeResult = await this.judgeEngine.evaluate(sample, metric);

        // Record cost
        const inputText = `${sample.query} ${sample.context.join(' ')} ${sample.generated_answer}`;
        const costEstimate = this.judgeCostTracker.estimateCost(
          this.config.judge?.model ?? 'claude-sonnet-4-6',
          judgeResult.provider,
          inputText,
        );

        this.judgeCostTracker.recordCost(
          index,
          this.config.judge?.model ?? 'claude-sonnet-4-6',
          judgeResult.provider,
          costEstimate.tokens.input,
          costEstimate.tokens.output,
          metric,
        );

        this.costTracker.recordCost(
          index,
          costEstimate.cost,
          costEstimate.tokens,
          `judge_${metric}`,
          judgeResult.provider,
        );

        // Store judge result in sample result
        switch (metric) {
          case 'faithfulness':
            if (result.faithfulness) {
              result.faithfulness.judge_score = judgeResult.score;
              result.faithfulness.judge_explanation = judgeResult.explanation;
            }
            break;
          case 'relevance':
            if (result.relevance) {
              result.relevance.judge_score = judgeResult.score;
              result.relevance.judge_explanation = judgeResult.explanation;
            }
            break;
          case 'overall':
            result.judge_overall = judgeResult.score;
            result.judge_explanation = judgeResult.explanation;
            break;
        }
      } catch (error) {
        console.error(`Judge error for sample ${index}, metric ${metric}:`, error);
      }
    }
  }

  /**
   * Compare two evaluation runs
   */
  compareRuns(
    baseline: EvalResults,
    candidate: EvalResults,
  ): {
    diff: Record<string, number>;
    regressions: string[];
    improvements: string[];
  } {
    const metrics = [
      'avg_faithfulness',
      'avg_relevance',
      'avg_context_precision',
      'avg_context_recall',
      'overall_score',
    ];
    const diff: Record<string, number> = {};
    const regressions: string[] = [];
    const improvements: string[] = [];

    for (const metric of metrics) {
      const baselineMetrics = baseline.metrics as unknown as Record<string, number>;
      const candidateMetrics = candidate.metrics as unknown as Record<string, number>;
      const baselineValue = baselineMetrics[metric] || 0;
      const candidateValue = candidateMetrics[metric] || 0;
      const difference = candidateValue - baselineValue;

      diff[metric] = Math.round(difference * 1000) / 1000;

      if (difference < -0.01) {
        regressions.push(
          `${metric}: ${baselineValue.toFixed(3)} -> ${candidateValue.toFixed(3)} (${difference.toFixed(3)})`,
        );
      } else if (difference > 0.01) {
        improvements.push(
          `${metric}: ${baselineValue.toFixed(3)} -> ${candidateValue.toFixed(3)} (${difference.toFixed(3)})`,
        );
      }
    }

    return { diff, regressions, improvements };
  }

  /**
   * Set baseline for regression comparison
   */
  setBaseline(baseline: EvalResults): void {
    if (this.gateEngine) {
      this.gateEngine.setBaseline(baseline);
    }
  }

  /**
   * Get cost breakdown
   */
  getCostBreakdown(): { judge: CostBreakdown; total: CostBreakdown } {
    return {
      judge: this.judgeCostTracker.getBreakdown(),
      total: this.costTracker.getBreakdown(),
    };
  }
}
