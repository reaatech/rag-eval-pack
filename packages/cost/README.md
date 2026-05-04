# @reaatech/rag-eval-cost

[![npm version](https://img.shields.io/npm/v/@reaatech/rag-eval-cost.svg)](https://www.npmjs.com/package/@reaatech/rag-eval-cost)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/rag-eval-pack/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/rag-eval-pack/ci.yml?branch=main&label=CI)](https://github.com/reaatech/rag-eval-pack/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Cost tracking, pricing, budgeting, and reporting infrastructure for RAG evaluations. Tracks per-sample token consumption, enforces budget limits with configurable alert thresholds, and generates cost reports in JSON and JUnit XML formats.

## Installation

```bash
npm install @reaatech/rag-eval-cost
# or
pnpm add @reaatech/rag-eval-cost
```

## Feature Overview

- **Multi-provider pricing** — built-in pricing for Anthropic (Claude), OpenAI (GPT), and Google (Gemini) models
- **Per-sample cost tracking** — record costs by sample ID, metric, and provider with token-level detail
- **Budget enforcement** — configurable per-run budget limits with hard/soft stop modes
- **Alert thresholds** — trigger actions at 50%, 75%, and 90% of budget with configurable callbacks
- **Report generation** — JSON cost reports and JUnit XML for CI integration
- **Extensible pricing** — add custom model pricing for any provider

## Quick Start

```typescript
import { CostTracker, Pricing, BudgetManager, CostReporter } from "@reaatech/rag-eval-cost";

// Track costs with budget limits
const tracker = new CostTracker({ budgetLimit: 10.00, hardLimit: false });

const result = tracker.recordCost(
  "sample-1",
  0.025,
  { input: 500, output: 75, total: 575 },
  "faithfulness",
  "anthropic"
);

console.log(result.withinBudget); // true
console.log(tracker.getTotalCost()); // 0.025

// Generate report for CI
const reporter = new CostReporter();
const report = reporter.generateReport(tracker.getBreakdown());
console.log(report.totalCost);       // 0.025
console.log(report.costPerSample);   // 0.025
```

## API Reference

### `CostTracker`

Per-evaluation cost accounting with budget limits.

```typescript
import { CostTracker, type CostTrackerOptions } from "@reaatech/rag-eval-cost";

const tracker = new CostTracker({
  budgetLimit: 50.00,
  hardLimit: true,
  alertThresholds: [0.5, 0.75, 0.9],
});
```

#### `CostTrackerOptions`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `budgetLimit` | `number` | `Infinity` | Maximum total cost before stopping |
| `hardLimit` | `boolean` | `false` | If `true`, `shouldStop` returns `true` when budget exceeded |
| `alertThresholds` | `number[]` | `[0.5, 0.75, 0.9]` | Budget usage percentages that trigger alerts |

#### Instance Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `recordCost(id, cost, tokens?, metric?, provider?)` | `{ cost, withinBudget, shouldStop }` | Record a cost entry and check budget |
| `getTotalCost()` | `number` | Total accumulated cost |
| `getCount()` | `number` | Number of recorded samples |
| `getAverageCost()` | `number` | Mean cost per sample |
| `getBreakdown()` | `CostBreakdown` | Cost breakdown by metric, provider, and per-sample |
| `isWithinBudget()` | `boolean` | Whether total cost is within budget |
| `reset()` | `void` | Clear all recorded costs |

### `Pricing`

Provider model pricing lookup and cost calculation.

```typescript
import { Pricing, type ModelPricing } from "@reaatech/rag-eval-cost";

const pricing = new Pricing();

// Look up pricing for a model
const config = pricing.getPricing("claude-opus", "anthropic");
console.log(config.input);  // 15.00 (per million tokens)
console.log(config.output); // 75.00 (per million tokens)

// Calculate cost from token counts
const cost = pricing.calculateCost("gpt-4", "openai", 1000000, 500000);
console.log(cost); // 25.00
```

#### Built-in Pricing

| Model | Provider | Input $/1M | Output $/1M |
|-------|----------|------------|-------------|
| `claude-opus` | anthropic | 15.00 | 75.00 |
| `claude-sonnet-4-6` | anthropic | 3.00 | 15.00 |
| `claude-haiku-4-5` | anthropic | 0.80 | 4.00 |
| `gpt-4` | openai | 30.00 | 60.00 |
| `gpt-4-turbo` | openai | 10.00 | 30.00 |
| `gpt-4o` | openai | 5.00 | 15.00 |
| `gemini-pro` | google | 2.50 | 7.50 |
| `gemini-flash` | google | 0.075 | 0.30 |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getPricing(model, provider)` | `ModelPricing` | Get pricing config for a model |
| `calculateCost(model, provider, inputTokens, outputTokens)` | `number` | Calculate cost from token counts |
| `addModelPricing(pricing)` | `void` | Register custom model pricing |

### `BudgetManager`

Budget enforcement with alert thresholds.

```typescript
import { BudgetManager } from "@reaatech/rag-eval-cost";

const manager = new BudgetManager({
  budgetLimit: 10.00,
  hardLimit: true,
  alertThresholds: [0.5, 0.75, 0.9],
});

const result = manager.recordSpend(7.00);
console.log(result.withinBudget); // true
console.log(manager.getBudgetUsage()); // 0.7

const alerts = manager.getActiveAlerts();
// → [{ threshold: 0.5, message: "Budget 50% used", level: "warn" }]
```

#### `BudgetManagerOptions`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `budgetLimit` | `number` | (required) | Maximum budget |
| `hardLimit` | `boolean` | `false` | Stop execution when budget exceeded |
| `alertThresholds` | `number[]` | `[0.5, 0.75, 0.9]` | Usage thresholds for alerts |

### `CostReporter`

Report generation in multiple formats.

```typescript
import { CostReporter } from "@reaatech/rag-eval-cost";

const reporter = new CostReporter();

const report = reporter.generateReport(breakdown);
// → { totalCost: 1.50, costPerSample: 0.075, trend: "stable", ... }

const xml = reporter.generateJUnitXml(breakdown);
// → <testsuite name="CostReport" tests="1" ...>
```

| Method | Returns | Description |
|--------|---------|-------------|
| `generateReport(breakdown)` | `CostReport` | Generate JSON cost report with trends |
| `generateJUnitXml(breakdown)` | `string` | Generate JUnit XML for CI reporting |
| `addHistoricalCost(date, cost)` | `void` | Add historical data for trend calculation |

## Usage Patterns

### Budget Enforcement in Pipelines

```typescript
const tracker = new CostTracker({ budgetLimit: 10.00, hardLimit: true });

for (const sample of samples) {
  const { shouldStop } = tracker.recordCost(sample.id, sample.cost, sample.tokens, sample.metric);
  if (shouldStop) {
    console.warn("Budget exceeded — stopping evaluation");
    break;
  }
  await evaluateSample(sample);
}
```

### CI Cost Gate

```typescript
import { CostReporter, CostTracker } from "@reaatech/rag-eval-cost";

const tracker = new CostTracker({ budgetLimit: 50.00 });
// ... run evaluations ...

const reporter = new CostReporter();
const xml = reporter.generateJUnitXml(tracker.getBreakdown());
writeFileSync("reports/cost-report.xml", xml);

// Fail CI if over budget
if (!tracker.isWithinBudget()) {
  console.error(`Budget exceeded: $${tracker.getTotalCost()}`);
  process.exit(1);
}
```

## Related Packages

- [`@reaatech/rag-eval-core`](https://www.npmjs.com/package/@reaatech/rag-eval-core) — Types and schemas
- [`@reaatech/rag-eval-judge`](https://www.npmjs.com/package/@reaatech/rag-eval-judge) — LLM judge (uses pricing for cost estimation)
- [`@reaatech/rag-eval-suite`](https://www.npmjs.com/package/@reaatech/rag-eval-suite) — Central orchestrator (uses tracker for budget enforcement)

## License

[MIT](https://github.com/reaatech/rag-eval-pack/blob/main/LICENSE)
