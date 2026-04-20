# rag-eval-pack

**RAG evaluation metrics with LLM-as-judge, cost accounting, and CI gates.**

A comprehensive TypeScript toolkit for evaluating Retrieval-Augmented Generation (RAG) systems. Provides four core metrics (faithfulness, answer relevance, context precision, context recall), LLM-as-judge with calibration, cost tracking, and CI-style regression gates.

## Quick Start

```bash
# Install
npm install rag-eval-pack

# Run evaluation
npx rag-eval-pack evaluate \
  --dataset datasets/eval-samples.jsonl \
  --config eval-config.yaml \
  --output results.json

# Run CI gate
npx rag-eval-pack gate \
  --results results.json \
  --gates gates.yaml \
  --baseline results/baseline.json
```

## Features

- **Four Core Metrics** — Faithfulness, relevance, context precision, context recall
- **LLM-as-Judge** — Provider-agnostic with calibration and consensus voting
- **Cost Accounting** — Per-sample, per-run, and per-day cost tracking with budget limits
- **CI Gates** — Threshold and baseline-comparison gates for regression prevention
- **Three-Layer MCP Tools** — Atomic (judge), orchestrated (suite), and CI (gate) layers
- **Observability** — OpenTelemetry tracing, metrics, and structured logging

## Ecosystem

This pack is designed to work alongside:

- **[hybrid-rag-qdrant](https://github.com/reaatech/hybrid-rag-qdrant)** — Hybrid search RAG pipeline (dense + sparse retrieval with Qdrant). Feed its outputs directly into `rag-eval-pack` for quality evaluation.
- **[agent-eval-harness](https://github.com/reaatech/agent-eval-harness)** — Agent trajectory evaluation. Use it to assess end-to-end agent behavior, then use `rag-eval-pack` to evaluate the RAG-specific quality of retrieved answers.

## Installation

```bash
npm install rag-eval-pack
```

### Environment Variables

```bash
# LLM API keys (at least one required)
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
export GOOGLE_API_KEY=...

# Optional: Observability
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export OTEL_SERVICE_NAME=rag-eval-pack
```

## Usage

### Programmatic API

```typescript
import {
  EvaluationSuite,
  FaithfulnessScorer,
  GateEngine,
  type GateConfig,
} from 'rag-eval-pack';

// Single metric scoring (heuristic, no LLM call)
const faithfulness = new FaithfulnessScorer();
const result = await faithfulness.score({
  query: 'What is the refund policy?',
  context: ['Refunds within 14 days.'],
  ground_truth: 'Refunds must be requested within 14 days.',
  generated_answer: 'You have 14 days to request a refund.',
});
console.log(`Faithfulness: ${result.score}`);

// Full evaluation suite with LLM judge
const suite = new EvaluationSuite({
  metrics: ['faithfulness', 'relevance', 'context_precision', 'context_recall'],
  judge: { model: 'claude-sonnet-4-6' },
  cost: { budget_limit: 10.00 },
});

const { results, gate_result } = await suite.runFromFile(
  'datasets/eval-samples.jsonl'
);
console.log(`Overall: ${results.metrics.overall_score}`);

// CI gate
const gates: GateConfig[] = [
  {
    name: 'min-faithfulness',
    type: 'threshold',
    metric: 'avg_faithfulness',
    operator: '>=',
    threshold: 0.85,
  },
];
const gate = new GateEngine(gates);
const gateResult = gate.evaluate(results);
if (!gateResult.passed) {
  console.log('Gates failed:', gateResult.failures);
  process.exit(1);
}
```

### CLI

```bash
# Evaluate
npx rag-eval-pack evaluate \
  --dataset datasets/eval-samples.jsonl \
  --config eval-config.yaml \
  --output results.json \
  --format json,markdown

# Gate check
npx rag-eval-pack gate \
  --results results.json \
  --gates gates.yaml \
  --baseline baseline.json

# Cost report
npx rag-eval-pack cost \
  --results results.json \
  --format json

# MCP server
npx rag-eval-pack mcp-server
```

## Configuration

### Evaluation Config

```yaml
# eval-config.yaml
evaluation:
  metrics:
    - faithfulness
    - relevance
    - context_precision
    - context_recall

  judge:
    model: claude-sonnet-4-6
    calibration:
      enabled: true
      method: temperature_scaling
      human_labels: calibration/human-labels.jsonl
    consensus:
      enabled: true
      voting_strategy: weighted
      models:
        - id: claude-opus-4-7
          weight: 1
        - id: gpt-4o
          weight: 1

  cost:
    budget_limit: 10.00
    max_cost_per_sample: 0.10

  execution:
    parallel_jobs: 5
    retry_attempts: 3
```

### Gate Config

```yaml
# gates.yaml
gates:
  - name: min-faithfulness
    type: threshold
    metric: avg_faithfulness
    operator: ">="
    threshold: 0.85

  - name: min-relevance
    type: threshold
    metric: avg_relevance
    operator: ">="
    threshold: 0.80

  - name: no-regression
    type: baseline-comparison
    metric: overall_score
    allow_regression: false
```

### Dataset Format (JSONL)

```jsonl
{"query": "What is the refund policy?", "context": ["Refunds within 14 days.", "Contact support for help."], "ground_truth": "Refunds must be requested within 14 days by contacting support.", "generated_answer": "You have 14 days to request a refund."}
{"query": "How do I reset my password?", "context": ["Visit /reset-password.", "Enter your email."], "ground_truth": "Go to /reset-password and enter your email.", "generated_answer": "Visit the password reset page and provide your email."}
```

## MCP Tools

The pack exposes three layers of MCP tools for agent integration:

### Layer 1: rag_eval.judge.* (Atomic)

| Tool | Description |
|------|-------------|
| `rag_eval.judge.faithfulness` | Score answer faithfulness to context |
| `rag_eval.judge.relevance` | Score answer relevance to query |
| `rag_eval.judge.context_precision` | Score context ranking quality |
| `rag_eval.judge.context_recall` | Score ground truth coverage |
| `rag_eval.judge.cost_check` | Verify cost within budget |

### Layer 2: rag_eval.suite.* (Orchestrated)

| Tool | Description |
|------|-------------|
| `rag_eval.suite.run` | Execute full evaluation suite |
| `rag_eval.suite.status` | Get evaluation run status |
| `rag_eval.suite.results` | Retrieve evaluation results |
| `rag_eval.suite.compare` | Compare two evaluation runs |
| `rag_eval.suite.baseline` | Set baseline for regression |

### Layer 3: rag_eval.gate.* (CI Gates)

| Tool | Description |
|------|-------------|
| `rag_eval.gate.run` | Run CI-style pass/fail gate |
| `rag_eval.gate.config` | Get/set gate configuration |
| `rag_eval.gate.diff` | Get detailed diff from baseline |

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed system design.

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   RAG       │────▶│  rag-eval-   │────▶│  Evaluation │
│   System    │     │  pack        │     │  Results    │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │  Three-Layer     │
                  │  MCP Tools:      │
                  │  - judge.*       │
                  │  - suite.*       │
                  │  - gate.*        │
                  └──────────────────┘
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test
npm run test:coverage

# Lint
npm run lint
npm run lint:fix

# Type check
npm run typecheck
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Run linter: `npm run lint`
6. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## License

MIT — see [LICENSE](LICENSE) for details.

## References

- [AGENTS.md](AGENTS.md) — Agent development guide
- [ARCHITECTURE.md](ARCHITECTURE.md) — System design deep dive
- [DEV_PLAN.md](DEV_PLAN.md) — Development checklist
- [MCP Specification](https://modelcontextprotocol.io/)
