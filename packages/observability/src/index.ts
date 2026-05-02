/**
 * Observability module exports
 */

export {
  logger,
  createRunLogger,
  logEvalStart,
  logEvalComplete,
  logGateResult,
  logError,
} from './logger.js';

export {
  createSpan,
  withSpan,
  traceEvalRun,
  traceMetricCalculation,
  traceJudgeCall,
  traceGateEvaluation,
  addSpanAttribute,
  recordSpanError,
  type SpanAttributes,
} from './tracing.js';

export {
  evalRunsTotal,
  samplesEvaluated,
  judgeCallsTotal,
  judgeCostHistogram,
  gatesResultGauge,
  costPerRunHistogram,
  metricsScoreGauge,
  recordEvalRun,
  recordJudgeCall,
  recordGateResult,
  recordCost,
  recordMetricScore,
  recordEvalComplete,
} from './metrics.js';

export { Dashboard, type EvalRunSummary, type DashboardMetrics } from './dashboard.js';
