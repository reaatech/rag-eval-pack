# @reaatech/rag-eval-judge

[![npm version](https://img.shields.io/npm/v/@reaatech/rag-eval-judge.svg)](https://www.npmjs.com/package/@reaatech/rag-eval-judge)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/rag-eval-pack/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/rag-eval-pack/ci.yml?branch=main&label=CI)](https://github.com/reaatech/rag-eval-pack/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

LLM-as-judge for RAG evaluation with multi-provider support, calibration against human labels, and consensus voting across models. Provides prompt templates for faithfulness, relevance, context precision, context recall, and overall quality scoring.

## Installation

```bash
npm install @reaatech/rag-eval-judge
# or
pnpm add @reaatech/rag-eval-judge
```

## Feature Overview

- **Multi-provider support** — Anthropic (Claude), OpenAI (GPT), and Google (Gemini) with automatic provider selection
- **Provider fallback** — configure backup models that activate when primary provider credentials are unavailable
- **Consensus voting** — weighted, majority, or unanimous voting across multiple judge models for higher accuracy
- **Calibration** — temperature scaling or isotonic regression against human-labeled data
- **Cost tracking** — per-judgment token counting and cost estimation via `@reaatech/rag-eval-cost`
- **Prompt templates** — curated prompts for each metric with structured score/explanation output parsing

## Quick Start

```typescript
import { JudgeEngine } from "@reaatech/rag-eval-judge";

const engine = new JudgeEngine({
  model: "claude-opus",
});

const result = await engine.evaluate(
  {
    query: "What is the refund policy?",
    context: [
      "Refunds are processed within 14 days of purchase.",
      "Contact support@example.com for refund requests.",
    ],
    ground_truth: "Refunds must be requested within 14 days by contacting support.",
    generated_answer: "You can request a refund within 14 days by emailing support.",
  },
  "faithfulness"
);

console.log(result.score);    // 0.85–0.95
console.log(result.provider); // "anthropic"
console.log(result.model);    // "claude-opus"
```

## API Reference

### `JudgeEngine`

The primary class for LLM-based evaluation.

```typescript
import { JudgeEngine, type JudgeConfig, type JudgeMetric, type JudgeResult } from "@reaatech/rag-eval-judge";

const engine = new JudgeEngine(config: JudgeConfig);
```

#### `JudgeConfig`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `model` | `string` | — | Primary judge model ID |
| `enabled` | `boolean` | `true` | Enable/disable LLM judging |
| `fallback_models` | `string[]` | `[]` | Backup model IDs for provider fallback |
| `consensus` | `ConsensusConfig` | — | Multi-model consensus configuration |
| `calibration` | `CalibrationConfig` | — | Human-label calibration configuration |
| `cost` | `JudgeCostConfig` | — | Per-judgment cost limits |

#### Instance Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `evaluate(sample, metric, model?)` | `Promise<JudgeResult>` | Run single-metric judge evaluation |
| `evaluateWithConsensus(sample, metric)` | `Promise<JudgeResult>` | Run consensus-based evaluation with multiple models |
| `evaluateBatch(samples, metric, useConsensus?)` | `Promise<JudgeResult[]>` | Evaluate multiple samples for a single metric |

#### `JudgeResult`

| Property | Type | Description |
|----------|------|-------------|
| `score` | `number` | Judged score (0–1) |
| `metric` | `string` | Evaluated metric name |
| `provider` | `string` | LLM provider used |
| `model` | `string` | LLM model used |
| `explanation` | `string` | Judge's reasoning |
| `raw_response` | `string` | Raw LLM response |

### `JudgeCalibrator`

Calibrates judge scores against human-labeled data.

```typescript
import { JudgeCalibrator } from "@reaatech/rag-eval-judge";

const calibrator = new JudgeCalibrator({
  method: "temperature_scaling",
});

// Load human-labeled data
calibrator.loadData([
  { rawScore: 0.7, humanScore: 0.75 },
  { rawScore: 0.5, humanScore: 0.55 },
  { rawScore: 0.3, humanScore: 0.35 },
]);

// Train the calibration model
await calibrator.train();

// Apply calibration to new scores
const calibratedScore = calibrator.apply(0.7);
console.log(calibratedScore); // Adjusted based on training data
```

#### `CalibrationConfig`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable calibration |
| `method` | `"temperature_scaling" \| "isotonic_regression"` | `"temperature_scaling"` | Calibration algorithm |
| `human_labels` | `string` | — | Path to human labels JSONL file |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `addDataPoint(rawScore, humanScore)` | `void` | Add a single calibration datapoint |
| `loadData(points)` | `void` | Load calibration data from array |
| `train()` | `Promise<void>` | Train the calibration model |
| `apply(rawScore)` | `number` | Apply calibration to a raw score |
| `isTrained()` | `boolean` | Whether the model has been trained |
| `getMetrics()` | `CalibrationMetrics` | Get MAE and RMSE after training |
| `getMethod()` | `string` | Get the current calibration method |

### `JudgeCostTracker`

Tracks per-judgment costs with budget enforcement.

```typescript
import { JudgeCostTracker } from "@reaatech/rag-eval-judge";

const tracker = new JudgeCostTracker({
  budgetLimit: 10.00,
  alertThresholds: [0.5, 0.75, 0.9],
});

// Estimate cost before making a call
const estimate = tracker.estimateCost("claude-opus", "anthropic", inputText);
console.log(estimate.cost);         // estimated cost
console.log(estimate.tokens.input); // estimated input tokens

// Record cost after a judgment
tracker.recordCost(
  sampleIndex,
  "claude-opus",
  "anthropic",
  inputTokens,
  outputTokens,
  "faithfulness"
);
```

### Prompt Templates

Pre-built prompts for each metric, with structured output formatting:

| Export | Metric |
|--------|--------|
| `FAITHFULNESS_PROMPT` | Verify if answer is faithful to context |
| `RELEVANCE_PROMPT` | Check if answer addresses the query |
| `CONTEXT_PRECISION_PROMPT` | Evaluate context ranking quality |
| `CONTEXT_RECALL_PROMPT` | Evaluate ground truth coverage in context |
| `OVERALL_QUALITY_PROMPT` | Holistic answer quality assessment |

```typescript
import { applyPromptTemplate, parseJudgeResponse, FAITHFULNESS_PROMPT } from "@reaatech/rag-eval-judge";

const prompt = applyPromptTemplate(FAITHFULNESS_PROMPT, {
  query: sample.query,
  context: sample.context.join("\n"),
  answer: sample.generated_answer,
});

// Send to LLM, then parse the response
const result = parseJudgeResponse(llmResponse);
// → { score: 0.90, explanation: "The answer accurately reflects..." }
```

## Usage Patterns

### Consensus Voting

```typescript
import { JudgeEngine } from "@reaatech/rag-eval-judge";

const engine = new JudgeEngine({
  model: "claude-opus",
  consensus: {
    enabled: true,
    models: [
      { id: "claude-opus", weight: 0.5 },
      { id: "gpt-4-turbo", weight: 0.3 },
      { id: "gemini-pro", weight: 0.2 },
    ],
    voting_strategy: "weighted",
    tie_breaker: "highest_confidence",
    min_agreement: 0.7,
  },
});

const result = await engine.evaluateWithConsensus(sample, "faithfulness");
// Weighted average across all 3 models
```

### Calibrated Evaluation Pipeline

```typescript
import { JudgeEngine, JudgeCalibrator } from "@reaatech/rag-eval-judge";

const calibrator = new JudgeCalibrator({ method: "temperature_scaling" });
calibrator.loadData(humanLabels);
await calibrator.train();

const engine = new JudgeEngine({
  model: "claude-opus",
  calibration: { enabled: true },
});

const rawResult = await engine.evaluate(sample, "faithfulness");
const calibratedScore = calibrator.apply(rawResult.score);
console.log(`Raw: ${rawResult.score} → Calibrated: ${calibratedScore}`);
```

### Provider Fallback

```typescript
const engine = new JudgeEngine({
  model: "claude-opus",
  fallback_models: ["gpt-4-turbo", "gemini-pro"],
});

// If ANTHROPIC_API_KEY is missing, falls back to OpenAI, then Google
const result = await engine.evaluate(sample, "faithfulness");
console.log(`Used: ${result.provider} / ${result.model}`);
```

## Related Packages

- [`@reaatech/rag-eval-core`](https://www.npmjs.com/package/@reaatech/rag-eval-core) — Types and schemas
- [`@reaatech/rag-eval-cost`](https://www.npmjs.com/package/@reaatech/rag-eval-cost) — Pricing and budget infrastructure
- [`@reaatech/rag-eval-metrics`](https://www.npmjs.com/package/@reaatech/rag-eval-metrics) — Heuristic metrics (lower cost alternative)
- [`@reaatech/rag-eval-suite`](https://www.npmjs.com/package/@reaatech/rag-eval-suite) — Central orchestrator

## License

[MIT](https://github.com/reaatech/rag-eval-pack/blob/main/LICENSE)
