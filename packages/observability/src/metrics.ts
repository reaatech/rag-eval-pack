import type { Counter, Gauge, Histogram, Meter } from '@opentelemetry/api';
import { metrics } from '@opentelemetry/api';

const meter: Meter = metrics.getMeter('rag-eval-pack', '0.1.0');

export const evalRunsTotal: Counter = meter.createCounter('rag_eval.runs.total', {
  description: 'Total number of evaluation runs',
});

export const samplesEvaluated: Counter = meter.createCounter('rag_eval.samples.evaluated', {
  description: 'Total number of samples evaluated',
});

export const judgeCallsTotal: Counter = meter.createCounter('rag_eval.judge.calls', {
  description: 'Total number of LLM judge API calls',
});

export const judgeCostHistogram: Histogram = meter.createHistogram('rag_eval.judge.cost', {
  description: 'Judge cost per run in USD',
  unit: 'USD',
});

export const gatesResultGauge: Gauge = meter.createGauge('rag_eval.gates.result', {
  description: 'Gate pass/fail result (1 = pass, 0 = fail)',
});

export const costPerRunHistogram: Histogram = meter.createHistogram('rag_eval.cost.per_run', {
  description: 'Cost per evaluation run in USD',
  unit: 'USD',
});

export const metricsScoreGauge: Gauge = meter.createGauge('rag_eval.metrics.score', {
  description: 'Metric score value',
});

export function recordEvalRun(runId: string, sampleCount: number): void {
  evalRunsTotal.add(1, { run_id: runId });
  samplesEvaluated.add(sampleCount, { run_id: runId });
}

export function recordJudgeCall(model: string, provider: string, cost: number): void {
  judgeCallsTotal.add(1, { model, provider });
  judgeCostHistogram.record(cost, { model, provider });
}

export function recordGateResult(runId: string, passed: boolean): void {
  gatesResultGauge.record(passed ? 1 : 0, { run_id: runId });
}

export function recordCost(runId: string, cost: number): void {
  costPerRunHistogram.record(cost, { run_id: runId });
}

export function recordMetricScore(runId: string, metric: string, score: number): void {
  metricsScoreGauge.record(score, { run_id: runId, metric });
}

export function recordEvalComplete(
  runId: string,
  metrics: {
    avg_faithfulness: number;
    avg_relevance: number;
    avg_context_precision: number;
    avg_context_recall: number;
    overall_score: number;
  },
  cost: number,
  _durationMs: number,
): void {
  recordMetricScore(runId, 'avg_faithfulness', metrics.avg_faithfulness);
  recordMetricScore(runId, 'avg_relevance', metrics.avg_relevance);
  recordMetricScore(runId, 'avg_context_precision', metrics.avg_context_precision);
  recordMetricScore(runId, 'avg_context_recall', metrics.avg_context_recall);
  recordMetricScore(runId, 'overall_score', metrics.overall_score);
  recordCost(runId, cost);
}
