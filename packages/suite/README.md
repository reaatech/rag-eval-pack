# @reaatech/rag-eval-suite

[![npm version](https://img.shields.io/npm/v/@reaatech/rag-eval-suite.svg)](https://www.npmjs.com/package/@reaatech/rag-eval-suite)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/rag-eval-pack/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/rag-eval-pack/ci.yml?branch=main&label=CI)](https://github.com/reaatech/rag-eval-pack/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Central evaluation orchestrator that ties metrics, judge, cost tracking, quality gates, and dataset loading into a single `EvaluationSuite` class. The primary entry point for running comprehensive RAG evaluations.

## Installation

```bash
npm install @reaatech/rag-eval-suite
# or
pnpm add @reaatech/rag-eval-suite
```

## Feature Overview

- **End-to-end orchestration** — run metrics, LLM judge, cost tracking, and gate evaluation in a single call
- **Parallel metric execution** — configurable concurrency for heuristic metric computation
- **Judge integration** — optional LLM-based scoring for faithfulness, relevance, and overall quality
- **Budget enforcement** — per-run and per-sample cost tracking with automatic stopping
- **Gate evaluation** — threshold and baseline-comparison gates evaluated against aggregated results
- **Run comparison** — diff two evaluation runs to identify regressions and improvements
- **Baseline management** — set and compare against stored baselines for CI regression detection

## Quick Start

```typescript
import { EvaluationSuite } from "@reaatech/rag-eval-suite";

const suite = new EvaluationSuite({
  metrics: ["faithfulness", "relevance", "context_precision", "context_recall"],
  judge: { model: "claude-opus" },
  gates: [
    { name: "min-faithfulness", type: "threshold", metric: "avg_faithfulness", operator: ">=", threshold: 0.85 },
  ],
  cost: { budget_limit: 10.00, hard_limit: true },
});

const result = await suite.runFromFile("datasets/eval-samples.jsonl");

console.log("Overall score:", result.results.metrics.overall_score);
console.log("Faithfulness:", result.results.metrics.avg_faithfulness);
console.log("Total cost:", result.results.total_cost);
console.log("Gates passed:", result.gate_result?.passed);
```

## API Reference

### `EvaluationSuite`

The main class for running evaluations.

```typescript
import { EvaluationSuite, type SuiteRunResult } from "@reaatech/rag-eval-suite";
import type { EvalSuiteConfig, EvaluationSample, EvalResults } from "@reaatech/rag-eval-core";

const suite = new EvaluationSuite(config: EvalSuiteConfig);
```

#### `EvalSuiteConfig`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `metrics` | `MetricName[]` | (required) | Metrics to evaluate: `"faithfulness"`, `"relevance"`, `"context_precision"`, `"context_recall"` |
| `judge` | `JudgeConfig` | — | Optional LLM judge configuration |
| `cost` | `CostConfig` | — | Budget limits and alert thresholds |
| `gates` | `GateConfig[]` | — | Quality gates to evaluate |
| `execution` | `ExecutionConfig` | `{ parallel_jobs: 5 }` | Execution configuration |

#### Run Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `run(samples, runId?)` | `Promise<SuiteRunResult>` | Run evaluation on in-memory samples |
| `runFromFile(datasetPath)` | `Promise<SuiteRunResult>` | Load samples from file and evaluate |

#### `SuiteRunResult`

| Property | Type | Description |
|----------|------|-------------|
| `run_id` | `string` | Unique run identifier |
| `status` | `"completed" \| "partial" \| "failed"` | Run completion status |
| `results` | `EvalResults` | Full evaluation results |
| `gate_result` | `GateResult?` | Gate evaluation result (if gates configured) |

#### Comparison Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `compareRuns(baseline, candidate)` | `{ diff, regressions, improvements }` | Compare two evaluation runs |
| `setBaseline(baseline)` | `void` | Store a baseline for gate comparison |

#### Cost Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getCostBreakdown()` | `{ judge: CostBreakdown, total: CostBreakdown }` | Get detailed cost breakdown |

### How It Works

1. **Dataset loading** — loads and validates samples from JSONL/JSON/YAML
2. **Heuristic metrics** — runs `MetricsEngine` in parallel for all configured metrics
3. **LLM judging** (optional) — evaluates faithfulness, relevance, and overall quality via LLM
4. **Cost tracking** — records token usage and cost at both the sample and run level
5. **Aggregation** — computes mean, standard deviation, and overall score across all samples
6. **Gate evaluation** — runs threshold and baseline-comparison gates against aggregated results

## Usage Patterns

### Without Judge (Heuristic-Only)

```typescript
const suite = new EvaluationSuite({
  metrics: ["faithfulness", "relevance"],
});

const result = await suite.run(samples);
// No LLM costs, fast evaluation using NLP heuristics only
```

### With Judge and Budget

```typescript
const suite = new EvaluationSuite({
  metrics: ["faithfulness", "relevance", "context_precision", "context_recall"],
  judge: {
    model: "claude-opus",
    consensus: {
      enabled: true,
      models: [
        { id: "claude-opus", weight: 0.5 },
        { id: "gpt-4-turbo", weight: 0.5 },
      ],
      voting_strategy: "weighted",
    },
  },
  cost: { budget_limit: 50.00, hard_limit: true },
});

const result = await suite.runFromFile("datasets/large-eval.jsonl");
console.log(`Cost: $${result.results.total_cost}`);
```

### CI Regression Detection

```typescript
import { EvaluationSuite } from "@reaatech/rag-eval-suite";
import { readFileSync, existsSync } from "node:fs";

const suite = new EvaluationSuite({
  metrics: ["faithfulness", "relevance"],
  gates: [
    { name: "no-regression", type: "baseline-comparison", metric: "overall_score", allow_regression: false },
  ],
});

// Load baseline if it exists
const baselinePath = "results/baseline.json";
if (existsSync(baselinePath)) {
  const baseline = JSON.parse(readFileSync(baselinePath, "utf-8"));
  suite.setBaseline(baseline);
}

const result = await suite.runFromFile("datasets/eval.jsonl");

if (result.gate_result && !result.gate_result.passed) {
  console.error("Regression detected!");
  process.exit(1);
}
```

### Run Comparison

```typescript
const suite = new EvaluationSuite({ metrics: ["faithfulness"] });

const diff = suite.compareRuns(v10Results, v11Results);

console.log("Diffs:", diff.diff);
console.log("Regressions:", diff.regressions);
console.log("Improvements:", diff.improvements);
```

## Related Packages

- [`@reaatech/rag-eval-core`](https://www.npmjs.com/package/@reaatech/rag-eval-core) — Types and schemas
- [`@reaatech/rag-eval-metrics`](https://www.npmjs.com/package/@reaatech/rag-eval-metrics) — Heuristic metric scorers
- [`@reaatech/rag-eval-judge`](https://www.npmjs.com/package/@reaatech/rag-eval-judge) — LLM judge with calibration
- [`@reaatech/rag-eval-cost`](https://www.npmjs.com/package/@reaatech/rag-eval-cost) — Cost tracking and budgeting
- [`@reaatech/rag-eval-gate`](https://www.npmjs.com/package/@reaatech/rag-eval-gate) — Quality gates
- [`@reaatech/rag-eval-dataset`](https://www.npmjs.com/package/@reaatech/rag-eval-dataset) — Dataset loading and validation
- [`@reaatech/rag-eval-cli`](https://www.npmjs.com/package/@reaatech/rag-eval-cli) — CLI tool

## License

[MIT](https://github.com/reaatech/rag-eval-pack/blob/main/LICENSE)
