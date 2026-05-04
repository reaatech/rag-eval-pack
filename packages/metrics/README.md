# @reaatech/rag-eval-metrics

[![npm version](https://img.shields.io/npm/v/@reaatech/rag-eval-metrics.svg)](https://www.npmjs.com/package/@reaatech/rag-eval-metrics)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/rag-eval-pack/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/rag-eval-pack/ci.yml?branch=main&label=CI)](https://github.com/reaatech/rag-eval-pack/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Heuristic metric scorers for RAG evaluation. Provides four independent scorers — faithfulness, relevance, context precision, and context recall — plus a `MetricsEngine` orchestrator that runs them in parallel with configurable concurrency.

## Installation

```bash
npm install @reaatech/rag-eval-metrics
# or
pnpm add @reaatech/rag-eval-metrics
```

## Feature Overview

- **Faithfulness** — measures factual grounding of the answer in retrieved context (statement-level decomposition)
- **Relevance** — measures semantic alignment between query and answer (intent decomposition + cosine similarity)
- **Context Precision** — measures retrieval ranking quality via MAP (Mean Average Precision) and NDCG
- **Context Recall** — measures ground truth coverage by decomposing facts and checking context overlap
- **Parallel execution** — `MetricsEngine` runs all configured scorers concurrently with configurable `parallelJobs`
- **Heuristic-first** — no LLM calls required; all scorers use NLP libraries (`compromise`, `natural`)

## Quick Start

```typescript
import {
  FaithfulnessScorer,
  RelevanceScorer,
  ContextPrecisionScorer,
  ContextRecallScorer,
  MetricsEngine,
} from "@reaatech/rag-eval-metrics";

const engine = new MetricsEngine({ parallelJobs: 4 });

const result = await engine.evaluateSample(
  {
    query: "What is the refund policy?",
    context: [
      "Refunds are processed within 14 days of purchase.",
      "Contact support@example.com for refund requests.",
    ],
    ground_truth: "Refunds must be requested within 14 days by contacting support.",
    generated_answer: "You can request a refund within 14 days by emailing support.",
  },
  { metrics: ["faithfulness", "relevance", "context_precision", "context_recall"] },
  0
);

console.log(result.faithfulness?.score); // ~0.95
console.log(result.relevance?.score);    // ~0.88
```

## API Reference

### `FaithfulnessScorer`

Decomposes the generated answer into atomic statements and verifies each against the provided context.

```typescript
import { FaithfulnessScorer } from "@reaatech/rag-eval-metrics";

const scorer = new FaithfulnessScorer();
const result = await scorer.score(sample);
// → { score: 0.90, statements: [...], supported_count: 8, total_count: 9 }
```

| Property | Type | Description |
|----------|------|-------------|
| `score` | `number` | Ratio of supported statements to total (0–1) |
| `statements` | `string[]` | Decomposed atomic statements from the answer |
| `supported_count` | `number` | Number of statements supported by context |
| `total_count` | `number` | Total number of extracted statements |

### `RelevanceScorer`

Decomposes the query into intents and checks how well the answer addresses each intent using semantic similarity.

```typescript
import { RelevanceScorer } from "@reaatech/rag-eval-metrics";

const scorer = new RelevanceScorer();
const result = await scorer.score(sample);
// → { score: 0.88, intents: [...], similarity: 0.82 }
```

| Property | Type | Description |
|----------|------|-------------|
| `score` | `number` | Composite relevance score (0–1) |
| `intents` | `string[]` | Decomposed query intents |
| `similarity` | `number` | Cosine similarity between intent and answer embeddings |

### `ContextPrecisionScorer`

Evaluates how well the retrieval system ranks relevant context chunks. Computes MAP and NDCG against the ground truth.

```typescript
import { ContextPrecisionScorer } from "@reaatech/rag-eval-metrics";

const scorer = new ContextPrecisionScorer();
const result = await scorer.score(sample);
// → { score: 0.75, map: 0.72, ndcg: 0.78, relevant_ranks: [1, 3] }
```

| Property | Type | Description |
|----------|------|-------------|
| `score` | `number` | Average of MAP and NDCG |
| `map` | `number` | Mean Average Precision |
| `ndcg` | `number` | Normalized Discounted Cumulative Gain |
| `relevant_ranks` | `number[]` | Rank positions of relevant chunks (1-indexed) |

### `ContextRecallScorer`

Decomposes the ground truth into individual facts and measures how many are covered by the retrieved context.

```typescript
import { ContextRecallScorer } from "@reaatech/rag-eval-metrics";

const scorer = new ContextRecallScorer();
const result = await scorer.score(sample);
// → { score: 0.90, total_facts: 5, covered_facts: 4 }
```

| Property | Type | Description |
|----------|------|-------------|
| `score` | `number` | Ratio of covered facts to total (0–1) |
| `total_facts` | `number` | Number of facts extracted from ground truth |
| `covered_facts` | `number` | Number of facts found in retrieved context |

### `MetricsEngine`

Orchestrates parallel metric computation.

```typescript
import { MetricsEngine } from "@reaatech/rag-eval-metrics";

const engine = new MetricsEngine({ parallelJobs: 5 });

// Evaluate a single sample
const result = await engine.evaluateSample(sample, config, index);

// Aggregate results across all samples
const aggregated = engine.aggregateResults(sampleResults);
// → { overall_score, avg_faithfulness, avg_relevance, ..., std_dev: { ... } }
```

#### Constructor Options

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `parallelJobs` | `number` | `5` | Maximum concurrent metric evaluations |

## Usage Patterns

### Individual Scorer

```typescript
import { FaithfulnessScorer } from "@reaatech/rag-eval-metrics";

const scorer = new FaithfulnessScorer();

const result = await scorer.score({
  query: "What is the refund policy?",
  context: ["Refunds are processed within 14 days."],
  ground_truth: "Refunds within 14 days.",
  generated_answer: "You have 14 days to request a refund.",
});

if (result.score < 0.85) {
  console.warn("Answer may contain hallucinations");
}
```

### Batch Evaluation with Aggregation

```typescript
import { MetricsEngine } from "@reaatech/rag-eval-metrics";
import type { EvaluationSample, EvalSuiteConfig } from "@reaatech/rag-eval-core";

const engine = new MetricsEngine({ parallelJobs: 8 });
const config: EvalSuiteConfig = {
  metrics: ["faithfulness", "relevance", "context_precision", "context_recall"],
};

const results = await Promise.all(
  samples.map((sample, i) => engine.evaluateSample(sample, config, i))
);

const aggregated = engine.aggregateResults(results);
console.log("Overall score:", aggregated.overall_score);
console.log("Faithfulness:", aggregated.avg_faithfulness);
```

## Related Packages

- [`@reaatech/rag-eval-core`](https://www.npmjs.com/package/@reaatech/rag-eval-core) — Types and schemas
- [`@reaatech/rag-eval-judge`](https://www.npmjs.com/package/@reaatech/rag-eval-judge) — LLM-based evaluation (higher accuracy, higher cost)
- [`@reaatech/rag-eval-suite`](https://www.npmjs.com/package/@reaatech/rag-eval-suite) — Central orchestrator

## License

[MIT](https://github.com/reaatech/rag-eval-pack/blob/main/LICENSE)
