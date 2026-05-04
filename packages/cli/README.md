# @reaatech/rag-eval-cli

[![npm version](https://img.shields.io/npm/v/@reaatech/rag-eval-cli.svg)](https://www.npmjs.com/package/@reaatech/rag-eval-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/rag-eval-pack/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/rag-eval-pack/ci.yml?branch=main&label=CI)](https://github.com/reaatech/rag-eval-pack/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

CLI entry point and commands for the RAG evaluation toolkit. Also serves as the master barrel package, re-exporting the full API surface of all `@reaatech/rag-eval-*` packages for programmatic consumers.

## Installation

```bash
npm install @reaatech/rag-eval-cli
# or
pnpm add @reaatech/rag-eval-cli
```

## Feature Overview

- **Seven CLI commands** — evaluate, gate, compare, cost, report, judge, and mcp-server
- **Multi-format output** — write results as JSON, Markdown, or both simultaneously
- **Config-driven evaluation** — load suite configuration from YAML or JSON files
- **Master barrel export** — re-exports all types, scorers, judges, trackers, gates, and tools from sibling packages
- **Dual ESM/CJS** — works as both a CLI tool and an importable library

## Quick Start

### CLI Usage

```bash
# Run evaluation suite on a dataset
rag-eval-pack evaluate --dataset dataset.jsonl --output results.json

# Run quality gates against results
rag-eval-pack gate --results results.json --gates gates.yaml

# Compare two evaluation runs
rag-eval-pack compare --baseline baseline.json --candidate candidate.json

# View cost breakdown
rag-eval-pack cost --results results.json

# Generate markdown report
rag-eval-pack report --results results.json --output report.md

# Run LLM judge on a dataset
rag-eval-pack judge --dataset dataset.jsonl --metric faithfulness

# Start MCP server
rag-eval-pack mcp-server
```

### Programmatic Usage

```typescript
import {
  EvaluationSuite,
  FaithfulnessScorer,
  GateEngine,
  JudgeEngine,
} from "@reaatech/rag-eval-cli";

// The CLI package re-exports everything from all @reaatech/rag-eval-* packages
// Use it as a single dependency if you need the full toolkit

const suite = new EvaluationSuite({
  metrics: ["faithfulness", "relevance"],
});
const result = await suite.runFromFile("dataset.jsonl");
```

## Commands

### `evaluate`

Run the evaluation suite on a dataset.

```bash
rag-eval-pack evaluate \
  --dataset datasets/samples.jsonl \
  --config eval-config.yaml \
  --output results/results.json \
  --format json,markdown \
  --no-judge
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--dataset` | `string` | (required) | Path to evaluation dataset (JSONL, JSON, YAML) |
| `--config` | `string` | — | Path to evaluation config (YAML or JSON) |
| `--output` | `string` | — | Output file path for results |
| `--format` | `string` | `"json"` | Output formats: `json`, `markdown`, or `json,markdown` |
| `--no-judge` | `boolean` | `false` | Skip LLM judge evaluation |

### `gate`

Run CI gates against evaluation results.

```bash
rag-eval-pack gate \
  --results results/results.json \
  --gates gates.yaml \
  --baseline results/baseline.json
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--results` | `string` | (required) | Path to evaluation results JSON |
| `--gates` | `string` | (required) | Path to gate config (YAML or JSON) |
| `--baseline` | `string` | — | Path to baseline results for comparison gates |

### `compare`

Compare two evaluation runs.

```bash
rag-eval-pack compare \
  --baseline results/v1.json \
  --candidate results/v2.json \
  --output diff.json
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--baseline` | `string` | (required) | Path to baseline evaluation results |
| `--candidate` | `string` | (required) | Path to candidate evaluation results |
| `--output` | `string` | — | Output file for diff |

### `cost`

Display cost breakdown for an evaluation run.

```bash
rag-eval-pack cost --results results/results.json
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--results` | `string` | (required) | Path to evaluation results JSON |

### `report`

Generate a formatted report from evaluation results.

```bash
rag-eval-pack report \
  --results results/results.json \
  --gates gates.yaml \
  --output report.md
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--results` | `string` | (required) | Path to evaluation results JSON |
| `--gates` | `string` | — | Path to gate config for gate status in report |
| `--output` | `string` | (required) | Output file path for report |

### `judge`

Run LLM judge evaluation on a dataset.

```bash
rag-eval-pack judge \
  --dataset dataset.jsonl \
  --metric faithfulness \
  --model claude-opus \
  --output judge-results.json
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--dataset` | `string` | (required) | Path to dataset (JSONL, JSON, YAML) |
| `--metric` | `string` | `"faithfulness"` | Metric to evaluate |
| `--model` | `string` | `"claude-opus"` | LLM model to use |
| `--output` | `string` | — | Output file for judge results |
| `--consensus` | `boolean` | `false` | Enable consensus voting |

### `mcp-server`

Start the MCP server for agent integration.

```bash
rag-eval-pack mcp-server
```

The server uses stdio transport. Configure in MCP client settings (e.g., `claude_desktop_config.json`) to expose evaluation tools.

## Configuration

### Suite Config (YAML)

```yaml
# eval-config.yaml
metrics:
  - faithfulness
  - relevance
  - context_precision
  - context_recall

judge:
  model: claude-opus
  enabled: true
  consensus:
    enabled: false

cost:
  budget_limit: 10.00
  hard_limit: true
  alert_thresholds: [0.5, 0.75, 0.9]

execution:
  parallel_jobs: 5
```

### Gate Config (YAML)

```yaml
# gates.yaml
gates:
  - name: min-faithfulness
    type: threshold
    metric: avg_faithfulness
    operator: ">="
    threshold: 0.85

  - name: max-cost-per-sample
    type: threshold
    metric: cost_per_sample
    operator: "<="
    threshold: 0.05

  - name: no-regression
    type: baseline-comparison
    metric: overall_score
    allow_regression: false
```

## Related Packages

- [`@reaatech/rag-eval-core`](https://www.npmjs.com/package/@reaatech/rag-eval-core) — Types and schemas
- [`@reaatech/rag-eval-metrics`](https://www.npmjs.com/package/@reaatech/rag-eval-metrics) — Metric scorers
- [`@reaatech/rag-eval-judge`](https://www.npmjs.com/package/@reaatech/rag-eval-judge) — LLM judge
- [`@reaatech/rag-eval-cost`](https://www.npmjs.com/package/@reaatech/rag-eval-cost) — Cost tracking
- [`@reaatech/rag-eval-gate`](https://www.npmjs.com/package/@reaatech/rag-eval-gate) — Quality gates
- [`@reaatech/rag-eval-dataset`](https://www.npmjs.com/package/@reaatech/rag-eval-dataset) — Dataset management
- [`@reaatech/rag-eval-suite`](https://www.npmjs.com/package/@reaatech/rag-eval-suite) — Orchestrator
- [`@reaatech/rag-eval-observability`](https://www.npmjs.com/package/@reaatech/rag-eval-observability) — Observability
- [`@reaatech/rag-eval-mcp-server`](https://www.npmjs.com/package/@reaatech/rag-eval-mcp-server) — MCP server

## License

[MIT](https://github.com/reaatech/rag-eval-pack/blob/main/LICENSE)
