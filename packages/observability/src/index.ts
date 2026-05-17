/**
 * Observability module exports
 */

export { Dashboard, type DashboardMetrics, type EvalRunSummary } from './dashboard.js';
export {
  createRunLogger,
  logError,
  logEvalComplete,
  logEvalStart,
  logGateResult,
  logger,
} from './logger.js';

export {
  costPerRunHistogram,
  evalRunsTotal,
  gatesResultGauge,
  judgeCallsTotal,
  judgeCostHistogram,
  metricsScoreGauge,
  recordCost,
  recordEvalComplete,
  recordEvalRun,
  recordGateResult,
  recordJudgeCall,
  recordMetricScore,
  samplesEvaluated,
} from './metrics.js';
export {
  addSpanAttribute,
  createSpan,
  recordSpanError,
  type SpanAttributes,
  traceEvalRun,
  traceGateEvaluation,
  traceJudgeCall,
  traceMetricCalculation,
  withSpan,
} from './tracing.js';
