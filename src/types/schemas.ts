import { z } from 'zod';

/**
 * Zod schemas for rag-eval-pack
 * These schemas provide runtime validation for all domain types
 */

/** Evaluation sample schema */
export const EvaluationSampleSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  context: z.array(z.string()).min(1, 'At least one context chunk required'),
  ground_truth: z.string().min(1, 'Ground truth cannot be empty'),
  generated_answer: z.string().min(1, 'Generated answer cannot be empty'),
  retrieved_chunk_ids: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/** Faithfulness result schema */
export const FaithfulnessResultSchema = z.object({
  score: z.number().min(0).max(1),
  statements: z.array(z.string()),
  supported_count: z.number().min(0),
  total_statements: z.number().min(0),
  explanation: z.string().optional(),
  statement_support: z
    .array(
      z.object({
        statement: z.string(),
        supported: z.boolean(),
        reasoning: z.string().optional(),
      })
    )
    .optional(),
});

/** Relevance result schema */
export const RelevanceResultSchema = z.object({
  score: z.number().min(0).max(1),
  semantic_similarity: z.number().min(0).max(1).optional(),
  intent_score: z.number().min(0).max(1).optional(),
  explanation: z.string().optional(),
});

/** Context precision result schema */
export const ContextPrecisionResultSchema = z.object({
  score: z.number().min(0).max(1),
  map: z.number().min(0).max(1),
  ndcg: z.number().min(0).max(1),
  chunk_relevance_scores: z.array(z.number().min(0).max(1)),
  explanation: z.string().optional(),
});

/** Context recall result schema */
export const ContextRecallResultSchema = z.object({
  score: z.number().min(0).max(1),
  total_facts: z.number().min(0),
  covered_facts: z.number().min(0),
  facts: z
    .array(
      z.object({
        fact: z.string(),
        covered: z.boolean(),
        matching_context: z.string().optional(),
      })
    )
    .optional(),
  explanation: z.string().optional(),
});

/** Sample evaluation result schema */
export const SampleEvalResultSchema = z.object({
  sample_id: z.union([z.string(), z.number()]),
  sample: EvaluationSampleSchema,
  faithfulness: FaithfulnessResultSchema.optional(),
  relevance: RelevanceResultSchema.optional(),
  context_precision: ContextPrecisionResultSchema.optional(),
  context_recall: ContextRecallResultSchema.optional(),
  overall_score: z.number().min(0).max(1).optional(),
  cost: z.number().min(0).optional(),
  evaluated_at: z.string(),
});

/** Aggregated metrics schema */
export const AggregatedMetricsSchema = z.object({
  overall_score: z.number().min(0).max(1),
  avg_faithfulness: z.number().min(0).max(1),
  avg_relevance: z.number().min(0).max(1),
  avg_context_precision: z.number().min(0).max(1),
  avg_context_recall: z.number().min(0).max(1),
  cost_per_sample: z.number().min(0),
  total_samples: z.number().min(0),
  std_dev: z.record(z.number()).optional(),
});

/** Token count schema */
export const TokenCountSchema = z.object({
  input: z.number().min(0),
  output: z.number().min(0),
  total: z.number().min(0),
});

/** Sample cost schema */
export const SampleCostSchema = z.object({
  sample_id: z.union([z.string(), z.number()]),
  cost: z.number().min(0),
  tokens: TokenCountSchema.optional(),
});

/** Cost breakdown schema */
export const CostBreakdownSchema = z.object({
  total: z.number().min(0),
  by_metric: z.record(z.number().min(0)),
  by_provider: z.record(z.number().min(0)),
  per_sample: z.array(SampleCostSchema),
});

/** Judge score schema */
export const JudgeScoreSchema = z.object({
  score: z.number().min(0).max(1),
  explanation: z.string(),
  confidence: z.number().min(0).max(1),
  calibrated: z.boolean(),
  raw_score: z.number().min(0).max(1).optional(),
  model: z.string(),
  provider: z.enum(['anthropic', 'openai', 'google', 'mock']),
});

/** Gate configuration schema */
export const GateConfigSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['threshold', 'baseline-comparison']),
  metric: z.string().min(1),
  operator: z.enum(['>=', '<=', '>', '<', '==']).optional(),
  threshold: z.number().optional(),
  baseline: z.string().optional(),
  allow_regression: z.boolean().optional(),
  min_improvement: z.number().optional(),
});

/** Individual gate result schema */
export const IndividualGateResultSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
  actual_value: z.number(),
  expected_value: z.number().optional(),
  baseline_diff: z.number().optional(),
  message: z.string(),
});

/** Gate failure schema */
export const GateFailureSchema = z.object({
  gate_name: z.string(),
  metric: z.string(),
  actual: z.number(),
  expected: z.number(),
  difference: z.number(),
});

/** Gate result schema */
export const GateResultSchema = z.object({
  passed: z.boolean(),
  gates: z.array(IndividualGateResultSchema),
  failures: z.array(GateFailureSchema),
  evaluated_at: z.string(),
});

/** Calibration configuration schema */
export const CalibrationConfigSchema = z.object({
  enabled: z.boolean(),
  human_labels: z.string().optional(),
  method: z.enum(['temperature_scaling', 'isotonic_regression']),
});

/** Consensus model schema */
export const ConsensusModelSchema = z.object({
  id: z.string(),
  weight: z.number().optional(),
});

/** Consensus configuration schema */
export const ConsensusConfigSchema = z.object({
  enabled: z.boolean(),
  models: z.array(ConsensusModelSchema),
  voting_strategy: z.enum(['weighted', 'majority', 'unanimous']),
  min_agreement: z.number().min(0).max(1).optional(),
});

/** Judge configuration schema */
export const JudgeConfigSchema = z.object({
  model: z.string().optional(),
  fallback_models: z.array(z.string()).optional(),
  calibration: CalibrationConfigSchema.optional(),
  consensus: ConsensusConfigSchema.optional(),
  enabled: z.boolean().optional(),
  cost: z
    .object({
      budget_limit: z.number().positive().optional(),
      max_per_judgment: z.number().positive().optional(),
      alert_thresholds: z.array(z.number().min(0).max(1)).optional(),
    })
    .optional(),
});

/** Cost configuration schema */
export const CostConfigSchema = z.object({
  budget_limit: z.number().positive(),
  max_cost_per_sample: z.number().positive().optional(),
  alert_thresholds: z.array(z.number().min(0).max(1)).optional(),
  hard_limit: z.boolean().optional(),
});

/** Execution configuration schema */
export const ExecutionConfigSchema = z.object({
  parallel_jobs: z.number().positive().optional(),
  retry_attempts: z.number().min(0).optional(),
  timeout_per_sample: z.number().positive().optional(),
  seed: z.number().optional(),
});

/** Output configuration schema */
export const OutputConfigSchema = z.object({
  formats: z.array(z.enum(['json', 'markdown', 'junit', 'html'])).optional(),
  include_per_sample: z.boolean().optional(),
  include_explanations: z.boolean().optional(),
});

/** Evaluation suite configuration schema */
export const EvalSuiteConfigSchema = z.object({
  metrics: z.array(z.string()),
  judge: JudgeConfigSchema.optional(),
  cost: CostConfigSchema.optional(),
  execution: ExecutionConfigSchema.optional(),
  output: OutputConfigSchema.optional(),
  gates: z.array(GateConfigSchema).optional(),
  weights: z
    .object({
      faithfulness: z.number().optional(),
      relevance: z.number().optional(),
      context_precision: z.number().optional(),
      context_recall: z.number().optional(),
    })
    .optional(),
});

/** Eval results schema */
export const EvalResultsSchema = z.object({
  run_id: z.string(),
  dataset: z.string(),
  config: EvalSuiteConfigSchema,
  samples: z.array(SampleEvalResultSchema),
  metrics: AggregatedMetricsSchema,
  total_cost: z.number().min(0),
  cost_breakdown: CostBreakdownSchema,
  duration_ms: z.number().min(0),
  completed_at: z.string(),
});

/** Run info schema */
export const RunInfoSchema = z.object({
  run_id: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']),
  progress: z.number().min(0).max(100),
  samples_processed: z.number().min(0),
  total_samples: z.number().min(0),
  started_at: z.string().optional(),
  completed_at: z.string().optional(),
  error: z.string().optional(),
});

/** Metric change schema */
export const MetricChangeSchema = z.object({
  direction: z.enum(['improved', 'degraded', 'unchanged']),
  value: z.number(),
  percentage: z.number(),
  significant: z.boolean().optional(),
});

/** Regression detail schema */
export const RegressionDetailSchema = z.object({
  metric: z.string(),
  baseline_value: z.number(),
  candidate_value: z.number(),
  change: z.number(),
  severity: z.enum(['low', 'medium', 'high']),
});

/** Comparison result schema */
export const ComparisonResultSchema = z.object({
  baseline_run_id: z.string(),
  candidate_run_id: z.string(),
  overall_change: z.number(),
  metric_changes: z.record(MetricChangeSchema),
  has_regressions: z.boolean(),
  regressions: z.array(RegressionDetailSchema),
});

/** Dataset version schema */
export const DatasetVersionSchema = z.object({
  version: z.string(),
  created: z.string(),
  author: z.string().optional(),
  description: z.string().optional(),
  changes: z.array(z.string()).optional(),
  samples: z
    .object({
      total: z.number().min(0),
      by_domain: z.record(z.number().min(0)).optional(),
      by_difficulty: z.record(z.number().min(0)).optional(),
    })
    .optional(),
});

/** Model configuration schema */
export const ModelConfigSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'google', 'mock']),
  model: z.string(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
});
