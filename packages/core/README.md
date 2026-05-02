# @reaatech/rag-eval-core

[![npm version](https://img.shields.io/npm/v/@reaatech/rag-eval-core.svg)](https://www.npmjs.com/package/@reaatech/rag-eval-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/rag-eval-pack/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/rag-eval-pack/ci.yml?branch=main&label=CI)](https://github.com/reaatech/rag-eval-pack/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Canonical TypeScript types and Zod schemas for RAG (Retrieval-Augmented Generation) evaluation. This package is the single source of truth for all evaluation shapes used throughout the `@reaatech/rag-eval-*` ecosystem.

## Installation

```bash
npm install @reaatech/rag-eval-core
# or
pnpm add @reaatech/rag-eval-core
```

## Feature Overview

- **18+ exported types** — `EvaluationSample`, `EvalSuiteConfig`, `SampleEvalResult`, `EvalResults`, `GateConfig`, `JudgeConfig`, and more
- **2 Zod schemas** — `EvaluationSampleSchema` and `EvalSuiteConfigSchema` for runtime validation
- **Full cost accounting types** — `CostBreakdown`, `TokenUsage`, `PricingConfig` for per-evaluation cost tracking
- **Gate configuration types** — `ThresholdGateConfig`, `BaselineGateConfig` with full operator support
- **Zero runtime dependencies** beyond `zod` — lightweight and tree-shakeable
- **Dual ESM/CJS output** — works with `import` and `require`

## Quick Start

```typescript
import {
  EvaluationSampleSchema,
  EvalSuiteConfigSchema,
  type EvaluationSample,
  type EvalSuiteConfig,
} from "@reaatech/rag-eval-core";

// Validate an evaluation sample at the boundary
const rawSample = JSON.parse(incomingJson);
const sample: EvaluationSample = EvaluationSampleSchema.parse(rawSample);

// Validate a suite configuration
const rawConfig = JSON.parse(configJson);
const config: EvalSuiteConfig = EvalSuiteConfigSchema.parse(rawConfig);
```

## Exports

### Core Types

| Export | Description |
|--------|-------------|
| `EvaluationSample` | Input sample: `query`, `context`, `ground_truth`, `generated_answer`, optional `retrieved_chunk_ids` and `metadata` |
| `EvalSuiteConfig` | Full evaluation suite configuration: metrics, judge, cost, execution, gates |
| `SampleEvalResult` | Per-sample result with heuristic and judge scores for each metric |
| `EvalResults` | Aggregated results: `run_id`, `metrics`, `samples`, `total_cost`, `cost_breakdown`, `duration_ms` |
| `AggregatedMetrics` | Aggregated metric scores: `overall_score`, `avg_faithfulness`, `avg_relevance`, mean + std dev per metric |

### Judge Types

| Export | Description |
|--------|-------------|
| `JudgeConfig` | Judge configuration: `model`, `enabled`, `consensus`, `calibration`, `cost` |
| `ConsensusConfig` | Multi-model consensus: `enabled`, `models` with weights, `voting_strategy`, `tie_breaker` |
| `CalibrationConfig` | Calibration settings: `enabled`, `human_labels` path, `calibration_method` |
| `JudgeMetric` | Metric union: `faithfulness \| relevance \| context_precision \| context_recall \| overall` |

### Gate Types

| Export | Description |
|--------|-------------|
| `GateConfig` | Union of `ThresholdGateConfig \| BaselineGateConfig` |
| `ThresholdGateConfig` | `{ name, type: "threshold", metric, operator, threshold }` |
| `BaselineGateConfig` | `{ name, type: "baseline-comparison", metric, allow_regression }` |
| `GateResult` | Gate evaluation result: `passed`, `gates[]`, `failures[]` |
| `GateEvalResult` | Per-gate result: `passed`, `gate_name`, `actual_value`, `message` |

### Cost Types

| Export | Description |
|--------|-------------|
| `CostBreakdown` | `{ total, by_metric, by_provider, per_sample }` |
| `TokenUsage` | `{ input, output, total }` |
| `PricingConfig` | Per-model pricing: `{ model, provider, inputCostPerMillion, outputCostPerMillion }` |

### Schemas

| Export | Description |
|--------|-------------|
| `EvaluationSampleSchema` | Zod schema for validating evaluation samples (query, context, ground_truth, generated_answer) |
| `EvalSuiteConfigSchema` | Zod schema for validating suite configuration (metrics, judge, cost, gates, execution) |

## Usage Pattern

Every schema export has a matching type export. Use the schema for runtime validation and the type for compile-time checking:

```typescript
import { EvaluationSampleSchema, type EvaluationSample } from "@reaatech/rag-eval-core";

function processSample(raw: unknown): EvaluationSample {
  // Parse at the boundary — throws ZodError on invalid data
  return EvaluationSampleSchema.parse(raw);
}
```

## Related Packages

- [`@reaatech/rag-eval-metrics`](https://www.npmjs.com/package/@reaatech/rag-eval-metrics) — Faithfulness, relevance, context precision/recall scorers
- [`@reaatech/rag-eval-judge`](https://www.npmjs.com/package/@reaatech/rag-eval-judge) — LLM-as-judge with calibration and consensus
- [`@reaatech/rag-eval-cost`](https://www.npmjs.com/package/@reaatech/rag-eval-cost) — Pricing, budgeting, and cost reporting
- [`@reaatech/rag-eval-gate`](https://www.npmjs.com/package/@reaatech/rag-eval-gate) — Quality gates and CI regression checks

## License

[MIT](https://github.com/reaatech/rag-eval-pack/blob/main/LICENSE)
