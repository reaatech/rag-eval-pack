/**
 * Core domain types for rag-eval-pack
 */

/** Provider types for LLM judges */
export type LLMProvider = 'anthropic' | 'openai' | 'google' | 'mock';

/** Model configuration */
export interface ModelConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

/** Evaluation sample - a single test case */
export interface EvaluationSample {
  /** User query/question */
  query: string;
  /** Retrieved context chunks */
  context: string[];
  /** Expected answer for evaluation */
  ground_truth: string;
  /** RAG system's generated answer */
  generated_answer: string;
  /** IDs of retrieved chunks, in retrieval rank order (optional) */
  retrieved_chunk_ids?: string[];
  /** IDs of the chunks that are actually relevant (ground-truth labels for retrieval metrics) */
  relevant_chunk_ids?: string[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Provider of text embeddings, used for true semantic similarity scoring.
 * Implementations may wrap a provider SDK, a local model, or a cache.
 */
export interface EmbeddingProvider {
  /** Embed a batch of texts, returning one vector per input (in order). */
  embed(texts: string[]): Promise<number[][]>;
}

/** Faithfulness evaluation result */
export interface FaithfulnessResult {
  /** Score from 0 to 1 */
  score: number;
  /** Extracted statements from the answer */
  statements: string[];
  /** Number of statements supported by context */
  supported_count: number;
  /** Total number of statements */
  total_statements: number;
  /** Explanation of the score */
  explanation?: string;
  /** Per-statement support details */
  statement_support?: StatementSupport[];
  /** LLM judge score (if using LLM judge) */
  judge_score?: number;
  /** LLM judge explanation */
  judge_explanation?: string;
}

/** Per-statement support information */
export interface StatementSupport {
  statement: string;
  supported: boolean;
  reasoning?: string;
}

/** Relevance evaluation result */
export interface RelevanceResult {
  /** Score from 0 to 1 */
  score: number;
  /** Lexical similarity score (word/character overlap; surface-form only) */
  lexical_similarity?: number;
  /** Semantic similarity score (cosine of embeddings; only when an EmbeddingProvider is configured) */
  semantic_similarity?: number;
  /** Intent coverage score */
  intent_score?: number;
  /** Explanation of the score */
  explanation?: string;
  /** LLM judge score (if using LLM judge) */
  judge_score?: number;
  /** LLM judge explanation */
  judge_explanation?: string;
}

/** Context precision evaluation result */
export interface ContextPrecisionResult {
  /** Overall precision score from 0 to 1 */
  score: number;
  /** Mean Average Precision */
  map: number;
  /** Normalized Discounted Cumulative Gain */
  ndcg: number;
  /** Relevance scores for each chunk */
  chunk_relevance_scores: number[];
  /** Explanation of the score */
  explanation?: string;
}

/** Context recall evaluation result */
export interface ContextRecallResult {
  /** Score from 0 to 1 */
  score: number;
  /** Total facts in ground truth */
  total_facts: number;
  /** Facts covered by context */
  covered_facts: number;
  /** List of facts and their coverage status */
  facts?: FactCoverage[];
  /** Explanation of the score */
  explanation?: string;
}

/** Fact coverage information */
export interface FactCoverage {
  fact: string;
  covered: boolean;
  matching_context?: string;
}

/**
 * Retrieval ranking result.
 *
 * Standard information-retrieval metrics computed by comparing the ranked
 * `retrieved_chunk_ids` against the ground-truth `relevant_chunk_ids`.
 */
export interface RetrievalResult {
  /** Reciprocal rank of the first relevant chunk (0 if none retrieved) */
  mrr: number;
  /** Normalized discounted cumulative gain over the ranking */
  ndcg: number;
  /** Precision@k: fraction of the top-k retrieved chunks that are relevant */
  precision_at_k: number;
  /** Recall@k: fraction of all relevant chunks present in the top-k */
  recall_at_k: number;
  /** Hit@k: 1 if any relevant chunk appears in the top-k, else 0 */
  hit_at_k: number;
  /** The cutoff k used for the @k metrics */
  k: number;
  /** Explanation of the score */
  explanation?: string;
}

/** Answer correctness result (generated answer vs. ground truth). */
export interface AnswerCorrectnessResult {
  /** Overall correctness score from 0 to 1 */
  score: number;
  /** Lexical similarity to the ground truth (surface-form only) */
  lexical_similarity?: number;
  /** Semantic similarity to the ground truth (only when an EmbeddingProvider is configured) */
  semantic_similarity?: number;
  /** Explanation of the score */
  explanation?: string;
}

/** Complete evaluation result for a single sample */
export interface SampleEvalResult {
  /** Sample identifier */
  sample_id: string | number;
  /** Original sample */
  sample: EvaluationSample;
  /** Faithfulness score */
  faithfulness?: FaithfulnessResult;
  /** Relevance score */
  relevance?: RelevanceResult;
  /** Context precision score */
  context_precision?: ContextPrecisionResult;
  /** Context recall score */
  context_recall?: ContextRecallResult;
  /** Overall score (weighted combination) */
  overall_score?: number;
  /** Evaluation cost for this sample */
  cost?: number;
  /** Evaluation timestamp */
  evaluated_at: string;
  /** LLM judge overall score */
  judge_overall?: number;
  /** LLM judge explanation */
  judge_explanation?: string;
}

/** Aggregated evaluation results */
export interface EvalResults {
  /** Run identifier */
  run_id: string;
  /** Dataset name/path */
  dataset: string;
  /** Configuration used */
  config: EvalSuiteConfig;
  /** Per-sample results */
  samples: SampleEvalResult[];
  /** Aggregated metrics */
  metrics: AggregatedMetrics;
  /** Total cost */
  total_cost: number;
  /** Cost breakdown */
  cost_breakdown: CostBreakdown;
  /** Evaluation duration in milliseconds */
  duration_ms: number;
  /** Evaluation timestamp */
  completed_at: string;
  /** Evaluation start timestamp */
  evaluated_at?: string;
}

/** Aggregated metrics across all samples */
export interface AggregatedMetrics {
  /** Overall score (weighted combination) */
  overall_score: number;
  /** Average faithfulness score */
  avg_faithfulness: number;
  /** Average relevance score */
  avg_relevance: number;
  /** Average context precision */
  avg_context_precision: number;
  /** Average context recall */
  avg_context_recall: number;
  /** Cost per sample */
  cost_per_sample: number;
  /** Total samples evaluated */
  total_samples: number;
  /** Standard deviation of scores */
  std_dev?: Record<string, number>;
}

/** Cost breakdown */
export interface CostBreakdown {
  /** Total cost */
  total: number;
  /** Cost by metric type */
  by_metric: Record<string, number>;
  /** Cost by provider/model */
  by_provider: Record<string, number>;
  /** Per-sample costs */
  per_sample: SampleCost[];
}

/** Cost for a single sample */
export interface SampleCost {
  sample_id: string | number;
  cost: number;
  tokens?: TokenCount;
}

/** Token count information */
export interface TokenCount {
  input: number;
  output: number;
  total: number;
}

/** LLM Judge score */
export interface JudgeScore {
  /** Score from 0 to 1 */
  score: number;
  /** Explanation/reationale */
  explanation: string;
  /** Confidence in the score (0-1) */
  confidence: number;
  /** Whether the score has been calibrated */
  calibrated: boolean;
  /** Raw score before calibration */
  raw_score?: number;
  /** Model used for judging */
  model: string;
  /** Provider used */
  provider: LLMProvider;
}

/** Gate configuration */
export interface GateConfig {
  /** Gate name */
  name: string;
  /** Gate type */
  type: 'threshold' | 'baseline-comparison';
  /** Metric to evaluate */
  metric: string;
  /** Comparison operator */
  operator?: '>=' | '<=' | '>' | '<' | '==';
  /** Threshold value */
  threshold?: number;
  /** Baseline results path (for baseline-comparison) */
  baseline?: string;
  /** Whether regression is allowed */
  allow_regression?: boolean;
  /** Minimum improvement required */
  min_improvement?: number;
  /**
   * Tolerance band (absolute metric units). A regression smaller than this is
   * treated as noise and does not fail the gate. Defaults to 0 (strict).
   */
  tolerance?: number;
  /**
   * Severity when the gate's check is not satisfied. `fail` (default) fails the
   * overall run; `warn` records a warning but lets the run pass.
   */
  severity?: 'warn' | 'fail';
}

/** Gate evaluation result */
export interface GateResult {
  /** Whether all `fail`-severity gates passed */
  passed: boolean;
  /** Individual gate results */
  gates: IndividualGateResult[];
  /** Failures summary (fail-severity gates that did not pass) */
  failures: GateFailure[];
  /** Warnings summary (warn-severity gates that did not pass) */
  warnings: GateFailure[];
  /** Evaluation timestamp */
  evaluated_at: string;
}

/** Result for a single gate */
export interface IndividualGateResult {
  /** Gate name */
  name: string;
  /** Whether this gate's check was satisfied */
  passed: boolean;
  /** Severity of this gate (defaults to `fail`) */
  severity?: 'warn' | 'fail';
  /** Whether an unsatisfied check was downgraded to a warning */
  warning?: boolean;
  /** Actual metric value */
  actual_value: number;
  /** Expected value/threshold */
  expected_value?: number;
  /** Difference from baseline (if applicable) */
  baseline_diff?: number;
  /** Message/reasoning */
  message: string;
}

/** Gate failure information */
export interface GateFailure {
  gate_name: string;
  metric: string;
  actual: number;
  expected: number;
  difference: number;
}

/** Evaluation suite configuration */
export interface EvalSuiteConfig {
  /** Metrics to compute */
  metrics: string[];
  /** Judge configuration */
  judge?: JudgeConfig;
  /** Cost configuration */
  cost?: CostConfig;
  /** Execution configuration */
  execution?: ExecutionConfig;
  /** Output configuration */
  output?: OutputConfig;
  /** Gate configurations */
  gates?: GateConfig[];
  /** Weights for overall score calculation */
  weights?: {
    faithfulness?: number;
    relevance?: number;
    context_precision?: number;
    context_recall?: number;
  };
}

/** Judge configuration */
export interface JudgeConfig {
  /** Primary judge model */
  model?: string;
  /**
   * Explicit provider. Overrides inference from the model name — required for
   * OpenAI-compatible gateways, proxies, and self-hosted/local models whose
   * names don't contain a recognizable provider keyword.
   */
  provider?: LLMProvider;
  /** Base URL for an OpenAI-/provider-compatible endpoint (gateway, proxy, local server) */
  base_url?: string;
  /** API key override (falls back to provider-specific environment variables) */
  api_key?: string;
  /** Fallback models */
  fallback_models?: string[];
  /** Calibration settings */
  calibration?: CalibrationConfig;
  /** Consensus settings */
  consensus?: ConsensusConfig;
  /** Whether judge is enabled */
  enabled?: boolean;
  /** Cost configuration for judge */
  cost?: {
    budget_limit?: number;
    max_per_judgment?: number;
    alert_thresholds?: number[];
  };
}

/** Calibration configuration */
export interface CalibrationConfig {
  /** Whether calibration is enabled */
  enabled: boolean;
  /** Path to human labels for calibration */
  human_labels?: string;
  /** Calibration method */
  method: 'temperature_scaling' | 'isotonic_regression';
}

/** Consensus configuration */
export interface ConsensusConfig {
  /** Whether consensus is enabled */
  enabled: boolean;
  /** Models to use for consensus */
  models: ConsensusModel[];
  /** Voting strategy */
  voting_strategy: 'weighted' | 'majority' | 'unanimous';
  /** Minimum agreement threshold */
  min_agreement?: number;
}

/** Consensus model configuration */
export interface ConsensusModel {
  /** Model identifier */
  id: string;
  /** Weight for weighted voting */
  weight?: number;
}

/** Cost configuration */
export interface CostConfig {
  /** Budget limit for the run */
  budget_limit: number;
  /** Maximum cost per sample */
  max_cost_per_sample?: number;
  /** Alert thresholds (as fraction of budget) */
  alert_thresholds?: number[];
  /** Whether to enforce hard limit */
  hard_limit?: boolean;
}

/** Execution configuration */
export interface ExecutionConfig {
  /** Number of parallel jobs */
  parallel_jobs?: number;
  /** Number of retry attempts */
  retry_attempts?: number;
  /** Timeout per sample in milliseconds */
  timeout_per_sample?: number;
  /** Random seed for reproducibility */
  seed?: number;
}

/** Output configuration */
export interface OutputConfig {
  /** Output formats */
  formats?: ('json' | 'markdown' | 'junit' | 'html')[];
  /** Include per-sample results */
  include_per_sample?: boolean;
  /** Include explanations */
  include_explanations?: boolean;
}

/** Dataset versioning information */
export interface DatasetVersion {
  /** Version string */
  version: string;
  /** Creation date */
  created: string;
  /** Author */
  author?: string;
  /** Description */
  description?: string;
  /** Changes from previous version */
  changes?: string[];
  /** Sample statistics */
  samples?: DatasetSampleStats;
}

/** Dataset sample statistics */
export interface DatasetSampleStats {
  /** Total samples */
  total: number;
  /** Samples by domain */
  by_domain?: Record<string, number>;
  /** Samples by difficulty */
  by_difficulty?: Record<string, number>;
}

/** Run status */
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** Run information */
export interface RunInfo {
  /** Run identifier */
  run_id: string;
  /** Current status */
  status: RunStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Samples processed */
  samples_processed: number;
  /** Total samples */
  total_samples: number;
  /** Start time */
  started_at?: string;
  /** Completion time */
  completed_at?: string;
  /** Error message (if failed) */
  error?: string;
}

/** Comparison result between two runs */
export interface ComparisonResult {
  /** Baseline run ID */
  baseline_run_id: string;
  /** Candidate run ID */
  candidate_run_id: string;
  /** Overall change */
  overall_change: number;
  /** Metric changes */
  metric_changes: Record<string, MetricChange>;
  /** Whether there were regressions */
  has_regressions: boolean;
  /** Regression details */
  regressions: RegressionDetail[];
}

/** Metric change information */
export interface MetricChange {
  /** Direction of change */
  direction: 'improved' | 'degraded' | 'unchanged';
  /** Absolute change value */
  value: number;
  /** Percentage change */
  percentage: number;
  /** Statistical significance (if applicable) */
  significant?: boolean;
}

/** Regression detail */
export interface RegressionDetail {
  metric: string;
  baseline_value: number;
  candidate_value: number;
  change: number;
  severity: 'low' | 'medium' | 'high';
}
