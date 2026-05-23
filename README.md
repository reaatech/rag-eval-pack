# rag-eval-pack

[![CI](https://github.com/reaatech/rag-eval-pack/actions/workflows/ci.yml/badge.svg)](https://github.com/reaatech/rag-eval-pack/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue)](https://www.typescriptlang.org/)

> Production-grade RAG evaluation toolkit with LLM-as-judge, cost accounting, and CI/CD regression gates.

This monorepo provides a composable suite of packages for evaluating Retrieval-Augmented Generation (RAG) systems across four core metrics — faithfulness, relevance, context precision, and context recall — with heuristic scoring, LLM-based judging, budget enforcement, and automated quality gating for CI pipelines.

## Features

- **Four evaluation metrics** — faithfulness, relevance, context precision, and context recall with heuristic scorers
- **LLM-as-judge** — multi-provider judging (Anthropic, OpenAI, Google) with calibration and consensus voting
- **Cost accounting** — per-sample and per-run token tracking with budget enforcement and alert thresholds
- **Quality gates** — threshold and baseline-comparison gates with formatted CI output and exit codes
- **MCP server** — three-layer tool API (`judge.*`, `suite.*`, `gate.*`) for agent-driven evaluation
- **Dataset management** — multi-format loading, Zod validation, synthetic generation, and version tracking
- **Observability** — structured Pino logging, OpenTelemetry tracing, and Prometheus-compatible metrics
- **Dual ESM/CJS** — every package ships `cjs` and `esm` output for maximum compatibility

## Installation

### Using the packages

Packages are published under the `@reaatech` scope and can be installed individually:

```bash
# Core types and schemas
pnpm add @reaatech/rag-eval-core

# Metric scorers
pnpm add @reaatech/rag-eval-metrics

# LLM judge
pnpm add @reaatech/rag-eval-judge

# Cost tracking
pnpm add @reaatech/rag-eval-cost

# Quality gates
pnpm add @reaatech/rag-eval-gate

# Dataset management
pnpm add @reaatech/rag-eval-dataset

# Central orchestrator
pnpm add @reaatech/rag-eval-suite

# MCP server
pnpm add @reaatech/rag-eval-mcp-server @modelcontextprotocol/sdk

# CLI tool
pnpm add @reaatech/rag-eval-cli

# Observability utilities
pnpm add @reaatech/rag-eval-observability
```

### Contributing

```bash
# Clone the repository
git clone https://github.com/reaatech/rag-eval-pack.git
cd rag-eval-pack

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run the test suite
pnpm test

# Run linting
pnpm lint
```

## Quick Start

Evaluate a RAG system's output in a few lines:

```typescript
import { EvaluationSuite } from "@reaatech/rag-eval-suite";

const suite = new EvaluationSuite({
  metrics: ["faithfulness", "relevance", "context_precision", "context_recall"],
  judge: { model: "claude-opus-4-7" },
  gates: [
    { name: "min-faithfulness", type: "threshold", metric: "avg_faithfulness", operator: ">=", threshold: 0.85 },
  ],
  cost: { budget_limit: 10.00 },
});

const result = await suite.runFromFile("datasets/eval-samples.jsonl");

console.log("Overall score:", result.results.metrics.overall_score);
console.log("Faithfulness:", result.results.metrics.avg_faithfulness);
console.log("Total cost:", result.results.total_cost);
console.log("Gates passed:", result.gate_result?.passed);
```

Or use the CLI:

```bash
rag-eval-pack evaluate --dataset dataset.jsonl --output results.json
rag-eval-pack gate --results results.json --gates gates.yaml
rag-eval-pack report --results results.json --output report.md
```

See [`datasets/examples/`](./datasets/examples/) for sample datasets and configuration files.

## Packages

| Package | Description |
| ------- | ----------- |
| [`@reaatech/rag-eval-core`](./packages/core) | Canonical types, Zod schemas, and domain models |
| [`@reaatech/rag-eval-metrics`](./packages/metrics) | Heuristic metric scorers (faithfulness, relevance, precision, recall) |
| [`@reaatech/rag-eval-judge`](./packages/judge) | LLM-as-judge with calibration, consensus, and cost tracking |
| [`@reaatech/rag-eval-cost`](./packages/cost) | Pricing, budgeting, and cost reporting |
| [`@reaatech/rag-eval-gate`](./packages/gate) | Quality gates and CI regression checks |
| [`@reaatech/rag-eval-dataset`](./packages/dataset) | Dataset loading, validation, generation, and versioning |
| [`@reaatech/rag-eval-suite`](./packages/suite) | Central orchestration engine |
| [`@reaatech/rag-eval-mcp-server`](./packages/mcp-server) | MCP server for agent-driven evaluation |
| [`@reaatech/rag-eval-cli`](./packages/cli) | CLI entry point and commands |
| [`@reaatech/rag-eval-observability`](./packages/observability) | Structured logging, tracing, and metrics |

## Documentation

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — System design, package relationships, and data flows
- [`AGENTS.md`](./AGENTS.md) — Coding conventions, tool architecture, and development guidelines
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — Contribution workflow and release process
- [`DEV_PLAN.md`](./DEV_PLAN.md) — Development checklist and roadmap

## License

[MIT](LICENSE)
