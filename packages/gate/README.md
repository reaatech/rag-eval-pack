# @reaatech/rag-eval-gate

[![npm version](https://img.shields.io/npm/v/@reaatech/rag-eval-gate.svg)](https://www.npmjs.com/package/@reaatech/rag-eval-gate)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/rag-eval-pack/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/rag-eval-pack/ci.yml?branch=main&label=CI)](https://github.com/reaatech/rag-eval-pack/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Quality gates and CI/CD regression checks for RAG evaluations. Provides threshold gates (metric value comparisons) and baseline-comparison gates (regression detection), with formatted CI output and configurable exit codes.

## Installation

```bash
npm install @reaatech/rag-eval-gate
# or
pnpm add @reaatech/rag-eval-gate
```

## Feature Overview

- **Threshold gates** — compare any metric against a fixed threshold with `>=`, `<=`, `>`, `<`, `==` operators
- **Baseline-comparison gates** — detect regressions by comparing candidate results against a stored baseline
- **Multi-gate evaluation** — load and evaluate multiple gates in a single pass
- **CI integration** — formatted output suitable for GitHub Actions annotations and exit code control
- **Dynamic gate management** — add, remove, and clear gates at runtime

## Quick Start

```typescript
import { GateEngine } from "@reaatech/rag-eval-gate";
import type { EvalResults } from "@reaatech/rag-eval-core";

const engine = new GateEngine();

engine.loadGates([
  {
    name: "min-faithfulness",
    type: "threshold",
    metric: "avg_faithfulness",
    operator: ">=",
    threshold: 0.85,
  },
  {
    name: "max-cost-per-sample",
    type: "threshold",
    metric: "cost_per_sample",
    operator: "<=",
    threshold: 0.05,
  },
  {
    name: "no-regression",
    type: "baseline-comparison",
    metric: "overall_score",
    allow_regression: false,
  },
]);

const result = engine.evaluate(evalResults, baselineResults);

if (!result.passed) {
  console.error("Gates failed:");
  for (const failure of result.failures) {
    console.error(`  - ${failure.gate_name}: ${failure.message}`);
  }
  process.exit(1);
}
```

## API Reference

### `GateEngine`

Manages and evaluates quality gates against evaluation results.

```typescript
import { GateEngine } from "@reaatech/rag-eval-gate";

const engine = new GateEngine();
```

#### Gate Management

| Method | Description |
|--------|-------------|
| `loadGates(gates: GateConfig[])` | Replace all gates with a new set |
| `addGate(gate: GateConfig)` | Add a single gate |
| `removeGate(name: string)` | Remove a gate by name |
| `clearGates()` | Remove all gates |
| `getGates()` | Get the current gate list |

#### Gate Evaluation

| Method | Returns | Description |
|--------|---------|-------------|
| `evaluate(results, baseline?)` | `GateResult` | Evaluate all gates against results |
| `setBaseline(baseline)` | `void` | Store a baseline for comparison gates |

### `ThresholdGates`

Evaluates threshold-based gates against metric values.

```typescript
import { ThresholdGates } from "@reaatech/rag-eval-gate";

const gates = new ThresholdGates();

const result = gates.evaluate(
  { name: "min-faithfulness", type: "threshold", metric: "avg_faithfulness", operator: ">=", threshold: 0.85 },
  0.90
);
console.log(result.passed); // true
```

#### Supported Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `>=` | Greater than or equal | `avg_faithfulness >= 0.85` |
| `<=` | Less than or equal | `cost_per_sample <= 0.05` |
| `>` | Strictly greater than | `overall_score > 0.5` |
| `<` | Strictly less than | `error_rate < 0.1` |
| `==` | Exactly equal | `total_samples == 100` |

### `BaselineGates`

Detects regressions between a candidate and baseline evaluation run.

```typescript
import { BaselineGates } from "@reaatech/rag-eval-gate";

const gates = new BaselineGates();

const result = gates.evaluate(
  { name: "no-regression", type: "baseline-comparison", metric: "overall_score", allow_regression: false },
  baselineResults,
  candidateResults
);
```

| Parameter | Description |
|-----------|-------------|
| `allow_regression: true` | Gate always passes; regression reported but not blocking |
| `allow_regression: false` | Gate fails if candidate score is more than 0.01 worse than baseline |

### `CIIntegration`

Formats gate results for CI environments.

```typescript
import { CIIntegration } from "@reaatech/rag-eval-gate";

const ci = new CIIntegration();

const output = ci.formatGateResult(gateResult);
// → Formatted lines suitable for GitHub Actions annotations

const exitCode = ci.getExitCode(gateResult);
// → 0 on pass, 1 on fail
```

| Method | Returns | Description |
|--------|---------|-------------|
| `formatGateResult(result)` | `string` | Format gate results for CI output |
| `getExitCode(result)` | `number` | Get appropriate exit code (0 or 1) |

## Usage Patterns

### CI Regression Gate

```yaml
# .github/workflows/eval.yml
- name: Run regression gates
  run: |
    node packages/cli/dist/cli.js gate \
      --results results/eval-results.json \
      --gates gates.yaml \
      --baseline results/baseline.json
  id: gate-check

- name: Fail if gates failed
  if: steps.gate-check.outcome == 'failure'
  run: exit 1
```

### Programmatic Gate Pipeline

```typescript
import { GateEngine } from "@reaatech/rag-eval-gate";
import { readFileSync } from "node:fs";

const engine = new GateEngine();

// Load gate config from YAML
engine.loadGates([
  { name: "min-faithfulness", type: "threshold", metric: "avg_faithfulness", operator: ">=", threshold: 0.85 },
  { name: "min-relevance", type: "threshold", metric: "avg_relevance", operator: ">=", threshold: 0.80 },
  { name: "min-context-recall", type: "threshold", metric: "avg_context_recall", operator: ">=", threshold: 0.90 },
  { name: "no-regression", type: "baseline-comparison", metric: "overall_score", allow_regression: false },
]);

const baseline = JSON.parse(readFileSync("results/baseline.json", "utf-8"));
engine.setBaseline(baseline);

const candidate = JSON.parse(readFileSync("results/candidate.json", "utf-8"));
const result = engine.evaluate(candidate, baseline);

for (const gate of result.gates) {
  const icon = gate.passed ? "✅" : "❌";
  console.log(`${icon} ${gate.name}: ${gate.actual_value}`);
}
```

## Related Packages

- [`@reaatech/rag-eval-core`](https://www.npmjs.com/package/@reaatech/rag-eval-core) — Gate type definitions
- [`@reaatech/rag-eval-suite`](https://www.npmjs.com/package/@reaatech/rag-eval-suite) — Central orchestrator
- [`@reaatech/rag-eval-cli`](https://www.npmjs.com/package/@reaatech/rag-eval-cli) — CLI with `gate` command

## License

[MIT](https://github.com/reaatech/rag-eval-pack/blob/main/LICENSE)
