# @reaatech/rag-eval-mcp-server

[![npm version](https://img.shields.io/npm/v/@reaatech/rag-eval-mcp-server.svg)](https://www.npmjs.com/package/@reaatech/rag-eval-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/rag-eval-pack/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/rag-eval-pack/ci.yml?branch=main&label=CI)](https://github.com/reaatech/rag-eval-pack/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

MCP (Model Context Protocol) server exposing RAG evaluation tools as a three-layer API: atomic judge operations, orchestrated suite runs, and CI-style regression gates. Connect from MCP clients like Claude Desktop or Cursor to evaluate RAG systems in real time.

## Installation

```bash
npm install @reaatech/rag-eval-mcp-server @modelcontextprotocol/sdk
# or
pnpm add @reaatech/rag-eval-mcp-server @modelcontextprotocol/sdk
```

## Feature Overview

- **Three-layer tool architecture** — `rag_eval.judge.*` (atomic), `rag_eval.suite.*` (orchestrated), `rag_eval.gate.*` (CI gates)
- **Judge tools** — faithfulness, relevance, context precision, context recall, and cost check
- **Suite tools** — run, status, results, compare, and baseline management
- **Gate tools** — run gates, get/set config, and diff from baseline
- **Stdio transport** — standard MCP transport for local agent integration
- **Programmatic and standalone modes** — embed as a library or run as a standalone server

## Quick Start

### Standalone Server

```bash
# Start the MCP server via CLI
npx rag-eval-pack mcp-server
```

### Programmatic Usage

```typescript
import { createMcpServer, startMcpServer } from "@reaatech/rag-eval-mcp-server";

// Create a server instance
const server = createMcpServer();

// Start via stdio (for MCP client integration)
await startMcpServer();
```

## API Reference

### Server Functions

```typescript
import { createMcpServer, startMcpServer } from "@reaatech/rag-eval-mcp-server";

const server = createMcpServer();
await startMcpServer();
```

| Function | Returns | Description |
|----------|---------|-------------|
| `createMcpServer()` | `Server` | Create an MCP server with all tools registered |
| `startMcpServer()` | `Promise<void>` | Start the server via stdio transport |

### Tool Handler Functions

For programmatic invocation outside the MCP protocol:

```typescript
import { handleJudgeTool, handleSuiteTool, handleGateTool } from "@reaatech/rag-eval-mcp-server";
```

| Function | Description |
|----------|-------------|
| `handleJudgeTool(name, input)` | Invoke a judge tool programmatically |
| `handleSuiteTool(name, input)` | Invoke a suite tool programmatically |
| `handleGateTool(name, input)` | Invoke a gate tool programmatically |

Each returns an MCP-compatible `CallToolResult`.

## Tool Reference

### Layer 1: `rag_eval.judge.*` (Atomic Operations)

Fast, stateless, composable operations for mid-task self-evaluation.

#### `rag_eval.judge.faithfulness`

Check if a generated answer is faithful to the provided context.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `context` | `string[]` | Yes | Retrieved context chunks |
| `generated_answer` | `string` | Yes | RAG system's generated answer |

**Returns:** `{ score, statements, supported_count }`

#### `rag_eval.judge.relevance`

Check if an answer is relevant to the query.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | `string` | Yes | User query |
| `generated_answer` | `string` | Yes | RAG system's generated answer |

**Returns:** `{ score, semantic_similarity, intent_score }`

#### `rag_eval.judge.context_precision`

Check context ranking quality against a ground truth.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | `string` | Yes | User query |
| `context` | `string[]` | Yes | Retrieved context chunks |
| `ground_truth` | `string` | Yes | Expected answer |

**Returns:** `{ score, map, ndcg }`

#### `rag_eval.judge.context_recall`

Check ground truth coverage in retrieved context.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | `string` | Yes | User query |
| `context` | `string[]` | Yes | Retrieved context chunks |
| `ground_truth` | `string` | Yes | Expected answer |

**Returns:** `{ score, total_facts, covered_facts }`

#### `rag_eval.judge.cost_check`

Verify evaluation cost is within budget.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eval_result` | `object` | Yes | Partial evaluation result |
| `budget` | `number` | Yes | Budget limit |

**Returns:** `{ within_budget, cost }`

### Layer 2: `rag_eval.suite.*` (Orchestrated Runs)

Stateful, longer-running operations for eval-driven development.

| Tool | Description |
|------|-------------|
| `rag_eval.suite.run` | Execute a full evaluation suite with dataset and config |
| `rag_eval.suite.status` | Get the status of a running evaluation |
| `rag_eval.suite.results` | Retrieve results for a completed evaluation |
| `rag_eval.suite.compare` | Compare two evaluation runs |
| `rag_eval.suite.baseline` | Set a baseline for regression comparison |

#### `rag_eval.suite.run`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `dataset` | `string \| EvaluationSample[]` | Yes | Path to dataset or in-memory samples |
| `config` | `EvalSuiteConfig` | Yes | Evaluation configuration |

**Returns:** `{ run_id, status }`

### Layer 3: `rag_eval.gate.*` (CI Gates)

Opinionated, blocking operations for CI/CD integration.

| Tool | Description |
|------|-------------|
| `rag_eval.gate.run` | Run CI-style pass/fail gate evaluation |
| `rag_eval.gate.config` | Get or set gate configuration |
| `rag_eval.gate.diff` | Get detailed diff from baseline |

#### `rag_eval.gate.run`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `results` | `EvalResults` | Yes | Evaluation results to gate |
| `gate_config` | `GateConfig[]` | Yes | Gate configuration |

**Returns:** `{ passed, failures[] }`

## Usage Patterns

### Agent Self-Evaluation Mid-Task

```typescript
import { handleJudgeTool } from "@reaatech/rag-eval-mcp-server";

const response = await handleJudgeTool("rag_eval.judge.faithfulness", {
  context: [
    "Refunds are processed within 14 days of purchase.",
    "Contact support@example.com for refund requests.",
  ],
  generated_answer: "You can request a refund within 14 days by emailing support.",
});

const result = JSON.parse(response.content[0].text);
if (result.score < 0.85) {
  // Trigger fallback: retrieve more context
}
```

### CI Pipeline Gate

```typescript
const gateResponse = await handleGateTool("rag_eval.gate.run", {
  results: latestEvalResults,
  gate_config: [
    { name: "min-faithfulness", type: "threshold", metric: "avg_faithfulness", operator: ">=", threshold: 0.85 },
    { name: "no-regression", type: "baseline-comparison", metric: "overall_score", allow_regression: false },
  ],
});

const gateResult = JSON.parse(gateResponse.content[0].text);
if (!gateResult.passed) {
  console.error("Gates failed:", gateResult.failures);
  process.exit(1);
}
```

## Related Packages

- [`@reaatech/rag-eval-core`](https://www.npmjs.com/package/@reaatech/rag-eval-core) — Types and schemas
- [`@reaatech/rag-eval-metrics`](https://www.npmjs.com/package/@reaatech/rag-eval-metrics) — Metric scorers used by judge tools
- [`@reaatech/rag-eval-gate`](https://www.npmjs.com/package/@reaatech/rag-eval-gate) — Gate engine used by gate tools
- [`@reaatech/rag-eval-suite`](https://www.npmjs.com/package/@reaatech/rag-eval-suite) — Suite engine used by suite tools
- [`@reaatech/rag-eval-cli`](https://www.npmjs.com/package/@reaatech/rag-eval-cli) — CLI with `mcp-server` command

## License

[MIT](https://github.com/reaatech/rag-eval-pack/blob/main/LICENSE)
