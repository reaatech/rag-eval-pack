# @reaatech/rag-eval-observability

[![npm version](https://img.shields.io/npm/v/@reaatech/rag-eval-observability.svg)](https://www.npmjs.com/package/@reaatech/rag-eval-observability)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/rag-eval-pack/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/rag-eval-pack/ci.yml?branch=main&label=CI)](https://github.com/reaatech/rag-eval-pack/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Structured logging, OpenTelemetry tracing, and metrics for RAG evaluations. Built on [Pino](https://github.com/pinojs/pino) (v9) for logging and OpenTelemetry for distributed tracing and metrics collection.

## Installation

```bash
npm install @reaatech/rag-eval-observability
# or
pnpm add @reaatech/rag-eval-observability
```

## Feature Overview

- **Structured JSON logging** — Pino-powered, fast and low-overhead
- **Automatic pretty-printing** — human-readable output in development, raw JSON in production
- **OpenTelemetry tracing** — span creation for eval runs, metric calculations, judge calls, and gate evaluations
- **OpenTelemetry metrics** — counters, histograms, and gauges for run counts, judge costs, gate results, and metric scores
- **Dashboard output** — text and JSON dashboard formats for evaluation run summaries

## Quick Start

```typescript
import {
  createLogger,
  traceEvalRun,
  traceJudgeCall,
  recordEvalRun,
} from "@reaatech/rag-eval-observability";

// Structured logging
const logger = createLogger("rag-eval");
logger.info({ run_id: "eval-123", samples: 100 }, "Evaluation completed");

// Distributed tracing
await traceEvalRun("run-456", async (span) => {
  // Your evaluation logic here
  span.end();
});

// OpenTelemetry metrics
recordEvalRun("run-789", 100);
```

## API Reference

### Logging

#### `createLogger(name: string, options?: LoggerOptions): Logger`

Creates a configured Pino logger instance.

```typescript
import { createLogger } from "@reaatech/rag-eval-observability";

const logger = createLogger("rag-eval");
logger.info("Evaluation started");
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` parameter | `string` | (required) | Logger name, included in every log line |

**Transport behavior:**
- **Development** (`NODE_ENV !== "production"`): enables `pino-pretty` with colorized output
- **Production** (`NODE_ENV === "production"`): raw JSON output for log aggregators

### Tracing (OpenTelemetry)

#### `traceEvalRun(runId: string, fn: (span: Span) => Promise<T>): Promise<T>`

Wraps a full evaluation run in a trace span.

```typescript
import { traceEvalRun } from "@reaatech/rag-eval-observability";

const result = await traceEvalRun("run-123", async (span) => {
  // Run evaluation...
  span.end();
  return evalResults;
});
```

#### `traceMetricCalculation(runId, sampleId, metric, fn): Promise<T>`

Traces an individual metric computation.

```typescript
const score = await traceMetricCalculation("run-123", "sample-1", "faithfulness", async (span) => {
  span.end();
  return 0.95;
});
```

#### `traceJudgeCall(runId, sampleId, model, fn): Promise<T>`

Traces an LLM judge API call with provider and model attributes.

```typescript
const result = await traceJudgeCall("run-123", "sample-1", "claude-opus", async (span) => {
  span.end();
  return { score: 0.9 };
});
```

#### `traceGateEvaluation(runId, fn): Promise<T>`

Traces a gate evaluation run.

```typescript
const result = await traceGateEvaluation("run-123", async (span) => {
  span.end();
  return { passed: true };
});
```

#### `createSpan(name, attributes?): Span`

Creates a standalone span with custom attributes.

```typescript
import { createSpan } from "@reaatech/rag-eval-observability";

const span = createSpan("eval.judge.call", {
  run_id: "run-123",
  sample_id: "sample-1",
  metric: "faithfulness",
  model: "claude-opus",
});
// ... work ...
span.end();
```

#### `withSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T>`

Executes an async function within a span context.

```typescript
const result = await withSpan("eval.process", async (span) => {
  span.end();
  return processedData;
});
```

### Metrics (OpenTelemetry)

#### Metric Recording Functions

| Function | Description |
|----------|-------------|
| `recordEvalRun(runId, sampleCount)` | Record an evaluation run counter |
| `recordJudgeCall(model, provider, cost)` | Record judge call histogram with cost |
| `recordGateResult(runId, passed)` | Record gate result gauge (1/0) |
| `recordCost(runId, cost)` | Record evaluation cost histogram |
| `recordMetricScore(runId, metric, score)` | Record metric score gauge |
| `recordEvalComplete(runId, metrics, cost, durationMs)` | Record comprehensive run completion metrics |

```typescript
import { recordEvalComplete } from "@reaatech/rag-eval-observability";

recordEvalComplete("run-123", {
  avg_faithfulness: 0.85,
  avg_relevance: 0.82,
  avg_context_precision: 0.78,
  avg_context_recall: 0.91,
  overall_score: 0.84,
}, 1.25, 5000);
```

### Dashboard

#### `Dashboard`

Generates formatted evaluation dashboards.

```typescript
import { Dashboard } from "@reaatech/rag-eval-observability";
import type { EvalResults } from "@reaatech/rag-eval-core";

const dashboard = new Dashboard();

const text = dashboard.generateText(results);
console.log(text);
// → RAG Evaluation Dashboard
//   ┌─────────────────┬────────┐
//   │ Metric          │ Score  │
//   ├─────────────────┼────────┤
//   │ Faithfulness    │ 0.850  │
//   │ ...

const json = dashboard.generateJson(results);
writeFileSync("dashboard.json", JSON.stringify(json, null, 2));
```

| Method | Returns | Description |
|--------|---------|-------------|
| `generateText(results)` | `string` | Formatted text dashboard |
| `generateJson(results)` | `string` | JSON dashboard output |

## Usage Patterns

### Structured Context Logging

```typescript
import { createLogger } from "@reaatech/rag-eval-observability";

const logger = createLogger("rag-eval");

logger.info({ run_id: "eval-123", samples: 100 }, "Evaluation started");
// → {"name":"rag-eval","level":"INFO","run_id":"eval-123","samples":100,"msg":"Evaluation started"}

logger.warn({ cost: 8.50, budgetLimit: 10.00 }, "Approaching budget limit");
```

### Error Logging

```typescript
try {
  await evaluateSample(sample);
} catch (err) {
  logger.error({ err, sample_id: sample.id }, "Sample evaluation failed");
}
```

### Full Observability Pipeline

```typescript
import {
  createLogger,
  traceEvalRun,
  traceMetricCalculation,
  recordEvalRun,
  recordEvalComplete,
} from "@reaatech/rag-eval-observability";

const logger = createLogger("eval-pipeline");

async function runEvaluation(samples) {
  return traceEvalRun("eval-456", async () => {
    recordEvalRun("eval-456", samples.length);

    const results = [];
    for (const sample of samples) {
      const score = await traceMetricCalculation("eval-456", sample.id, "faithfulness", async (span) => {
        const s = await computeMetric(sample);
        span.end();
        return s;
      });
      results.push(score);
    }

    recordEvalComplete("eval-456", aggregateMetrics, totalCost, durationMs);
    logger.info("Evaluation complete");
    return results;
  });
}
```

## Related Packages

- [`@reaatech/rag-eval-core`](https://www.npmjs.com/package/@reaatech/rag-eval-core) — Types and schemas
- [`@reaatech/rag-eval-suite`](https://www.npmjs.com/package/@reaatech/rag-eval-suite) — Central orchestrator
- [`@reaatech/rag-eval-mcp-server`](https://www.npmjs.com/package/@reaatech/rag-eval-mcp-server) — MCP server

## License

[MIT](https://github.com/reaatech/rag-eval-pack/blob/main/LICENSE)
