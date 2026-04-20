---
agent_id: "rag-eval-pack"
display_name: "RAG Eval Pack"
version: "0.1.0"
description: "Evaluation toolkit for RAG (Retrieval-Augmented Generation) systems"
type: "evaluator"
confidence_threshold: 0.9
---

# rag-eval-pack — Agent Development Guide

## What this is

This document defines how to use `rag-eval-pack` to evaluate RAG (Retrieval-Augmented Generation) systems through comprehensive metrics including faithfulness, answer relevance, context precision/recall, with cost accounting and CI gates. It covers the three-layer MCP tool architecture (judge/suite/gate), LLM-as-judge with calibration, and CI integration patterns.

**Target audience:** Engineers building production RAG systems who need to evaluate retrieval and generation quality, optimize costs, ensure quality, and prevent regressions in CI/CD pipelines.

---

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   RAG System    │────▶│  rag-eval-       │────▶│   Evaluation   │
│   (Outputs)     │     │   pack           │     │   Results      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  Three-Layer     │
                       │  MCP Tools:      │
                       │  - rag_eval.     │
                       │    judge.*       │
                       │  - rag_eval.     │
                       │    suite.*       │
                       │  - rag_eval.     │
                       │    gate.*        │
                       └──────────────────┘
```

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Faithfulness Scorer** | `src/metrics/faithfulness.ts` | Measure answer grounding in context |
| **Relevance Scorer** | `src/metrics/relevance.ts` | Measure answer relevance to query |
| **Context Precision** | `src/metrics/context-precision.ts` | Measure retrieval ranking quality |
| **Context Recall** | `src/metrics/context-recall.ts` | Measure ground truth coverage |
| **LLM Judge** | `src/judge/` | Calibrated quality scoring |
| **Cost Tracker** | `src/cost/` | Per-evaluation cost calculation |
| **Gate Engine** | `src/gate/` | CI regression gates |
| **MCP Server** | `src/mcp-server/` | Three-layer tool exposure |

---

## Three-Layer MCP Tool Architecture

The pack exposes three distinct tool groups for different use cases:

### Layer 1: rag_eval.judge.* (Atomic Operations)

Fast, stateless, composable operations for mid-task self-evaluation:

| Tool | Input | Output | Use Case |
|------|-------|--------|----------|
| `rag_eval.judge.faithfulness` | `{ context, generated_answer }` | `{ score, statements, supported_count }` | Check if answer is faithful to context |
| `rag_eval.judge.relevance` | `{ query, generated_answer }` | `{ score, semantic_similarity, intent_score }` | Check if answer addresses query |
| `rag_eval.judge.context_precision` | `{ query, context[], ground_truth }` | `{ score, map, ndcg }` | Check context ranking quality |
| `rag_eval.judge.context_recall` | `{ query, context[], ground_truth }` | `{ score, total_facts, covered_facts }` | Check ground truth coverage |
| `rag_eval.judge.cost_check` | `{ eval_result, budget }` | `{ within_budget, cost }` | Verify cost within budget |

**Example: Agent self-evaluation mid-task**

```json
{
  "name": "rag_eval.judge.faithfulness",
  "arguments": {
    "context": [
      "Refunds are processed within 14 days of purchase.",
      "Contact support@example.com for refund requests."
    ],
    "generated_answer": "You can request a refund within 14 days by emailing support@example.com."
  }
}
```

### Layer 2: rag_eval.suite.* (Orchestrated Runs)

Stateful, longer-running operations for eval-driven development:

| Tool | Input | Output | Use Case |
|------|-------|--------|----------|
| `rag_eval.suite.run` | `{ dataset, config }` | `{ run_id, status }` | Execute full evaluation suite |
| `rag_eval.suite.status` | `{ run_id }` | `{ status, progress }` | Get evaluation run status |
| `rag_eval.suite.results` | `{ run_id }` | `{ results, metrics }` | Retrieve evaluation results |
| `rag_eval.suite.compare` | `{ baseline_run, candidate_run }` | `{ diff, stats }` | Compare two evaluation runs |
| `rag_eval.suite.baseline` | `{ run_id, name }` | `{ baseline_id }` | Set baseline for regression |

**Example: Developer running eval suite**

```json
{
  "name": "rag_eval.suite.run",
  "arguments": {
    "dataset": "datasets/eval-samples.jsonl",
    "config": {
      "metrics": ["faithfulness", "relevance", "context_precision", "context_recall"],
      "judge_model": "claude-opus",
      "budget_limit": 10.00
    }
  }
}
```

### Layer 3: rag_eval.gate.* (CI Gates)

Opinionated, blocking operations for CI/CD:

| Tool | Input | Output | Use Case |
|------|-------|--------|----------|
| `rag_eval.gate.run` | `{ results, gate_config }` | `{ passed, failures }` | Run CI-style pass/fail gate |
| `rag_eval.gate.config` | `{ action, config }` | `{ config }` | Get/set gate configuration |
| `rag_eval.gate.diff` | `{ baseline, candidate }` | `{ diff, regressions }` | Get detailed diff from baseline |

**Example: CI pipeline gate check**

```json
{
  "name": "rag_eval.gate.run",
  "arguments": {
    "results": "results/eval-123.json",
    "gate_config": "gates.yaml"
  }
}
```

---

## Evaluation Sample Format

### JSONL Format (One Sample Per Line)

```jsonl
{"query": "What is the refund policy?", "context": ["Refunds are processed within 14 days of purchase.", "Contact support@example.com for refund requests."], "ground_truth": "Refunds must be requested within 14 days by contacting support.", "generated_answer": "You can request a refund within 14 days by emailing support@example.com.", "retrieved_chunk_ids": ["chunk-001", "chunk-002"], "metadata": {"source": "policy-doc-v2"}}
{"query": "How do I reset my password?", "context": ["Password reset is available at /reset-password.", "Enter your email to receive a reset link."], "ground_truth": "Go to /reset-password and enter your email.", "generated_answer": "Visit the password reset page and provide your email address.", "retrieved_chunk_ids": ["chunk-003", "chunk-004"], "metadata": {"source": "help-center"}}
```

### Required Fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `query` | yes | string | User query/question |
| `context` | yes | string[] | Retrieved context chunks |
| `ground_truth` | yes | string | Expected answer for evaluation |
| `generated_answer` | yes | string | RAG system's generated answer |
| `retrieved_chunk_ids` | no | string[] | IDs of retrieved chunks |
| `metadata` | no | object | Additional metadata |

---

## LLM-as-Judge with Calibration

### Provider-Agnostic Configuration

```yaml
# judge-config.yaml
judge:
  # Primary judge model (any provider)
  model: claude-opus
  
  # Fallback models for resilience
  fallback_models:
    - gpt-4-turbo
    - gemini-pro
  
  # Calibration settings
  calibration:
    enabled: true
    human_labels: 'calibration/human-labels.jsonl'
    calibration_method: 'temperature_scaling'
  
  # Consensus settings
  consensus:
    enabled: true
    models: [claude-opus, gpt-4-turbo]
    voting_strategy: weighted
    tie_breaker: highest_confidence
  
  # Cost controls
  cost:
    budget_limit: 50.00
    max_cost_per_judgment: 0.10
    alert_thresholds: [0.5, 0.75, 0.9]
```

### Calibration Process

1. **Collect human labels** for a representative sample
2. **Run judge on same samples** to get raw scores
3. **Fit calibration model** (temperature scaling or isotonic regression)
4. **Apply calibration** to future judge scores

```typescript
import { JudgeCalibrator } from 'rag-eval-pack';

const calibrator = new JudgeCalibrator({
  humanLabelsPath: 'calibration/human-labels.jsonl',
  method: 'temperature_scaling',
});

await calibrator.calibrate();

// Apply calibration to new scores
const calibratedScore = calibrator.apply(rawScore);
```

### Consensus Voting

For higher accuracy, use multiple judges:

```yaml
consensus:
  enabled: true
  models:
    - id: claude-opus
      weight: 0.5
    - id: gpt-4-turbo
      weight: 0.3
    - id: gemini-pro
      weight: 0.2
  voting_strategy: weighted
  min_agreement: 0.7
```

---

## Cost Tracking

### Per-Evaluation Cost Calculation

```yaml
# cost-config.yaml
cost:
  # Provider pricing (per million tokens)
  pricing:
    claude-opus:
      input: 15.00
      output: 75.00
    gpt-4-turbo:
      input: 10.00
      output: 30.00
    gemini-pro:
      input: 2.50
      output: 7.50
  
  # Budget settings
  budgets:
    per_sample: 0.05
    per_run: 10.00
    daily: 100.00
  
  # Alert thresholds
  alerts:
    - threshold: 0.5
      action: log
    - threshold: 0.75
      action: notify
    - threshold: 0.9
      action: block
```

### Cost Breakdown

The pack tracks costs at multiple levels:

```json
{
  "run_id": "eval-123",
  "total_cost": 1.234,
  "breakdown": {
    "faithfulness_judge": 0.500,
    "relevance_judge": 0.250,
    "context_precision": 0.000,
    "context_recall": 0.000
  },
  "per_sample": [
    { "sample_id": 1, "cost": 0.012, "tokens": { "input": 500, "output": 50 } },
    { "sample_id": 2, "cost": 0.011, "tokens": { "input": 450, "output": 45 } }
  ]
}
```

---

## CI Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/eval.yml
name: RAG Evaluation

on:
  pull_request:
    branches: [main]

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run evaluation suite
        run: |
          npx rag-eval-pack evaluate \
            --dataset datasets/eval-samples.jsonl \
            --config eval-config.yaml \
            --output results.json
      
      - name: Run regression gates
        run: |
          npx rag-eval-pack gate \
            --results results.json \
            --gates gates.yaml \
            --baseline results/baseline.json
      
      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: eval-results
          path: results/
      
      - name: Comment on PR
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const results = require('./results.json');
            const comment = `## Evaluation Results
            
            **Overall Score:** ${results.overall_score}
            **Faithfulness:** ${results.avg_faithfulness}
            **Relevance:** ${results.avg_relevance}
            **Context Precision:** ${results.avg_context_precision}
            **Context Recall:** ${results.avg_context_recall}
            **Gates:** ${results.gates_passed ? '✅ Passed' : '❌ Failed'}
            
            ${results.regressions.length > 0 ? '**Regressions:**\n' + results.regressions.map(r => `- ${r.metric}: ${r.baseline} → ${r.current}`).join('\n') : ''}`;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

### Gate Configuration

```yaml
# gates.yaml
gates:
  - name: min-faithfulness
    type: threshold
    metric: avg_faithfulness_score
    operator: ">="
    threshold: 0.85

  - name: min-relevance
    type: threshold
    metric: avg_relevance_score
    operator: ">="
    threshold: 0.80

  - name: min-context-precision
    type: threshold
    metric: avg_context_precision
    operator: ">="
    threshold: 0.75

  - name: min-context-recall
    type: threshold
    metric: avg_context_recall
    operator: ">="
    threshold: 0.90

  - name: max-cost-per-sample
    type: threshold
    metric: cost_per_sample
    operator: "<="
    threshold: 0.05

  - name: no-regression
    type: baseline-comparison
    baseline: results/baseline.json
    metric: overall_score
    allow_regression: false
```

---

## Using with RAG Systems

### Integration with hybrid-rag-qdrant

Use rag-eval-pack to evaluate outputs from hybrid-rag-qdrant:

```typescript
import { RAGPipeline } from 'hybrid-rag-qdrant';
import { EvaluationEngine, FaithfulnessScorer, RelevanceScorer } from 'rag-eval-pack';

const rag = new RAGPipeline({ /* config */ });
const evalEngine = new EvaluationEngine({ /* config */ });

// Run RAG on test queries
const results = [];
for (const sample of evalDataset) {
  const ragResult = await rag.query(sample.query);
  results.push({
    query: sample.query,
    context: ragResult.chunks.map(c => c.content),
    ground_truth: sample.ground_truth,
    generated_answer: ragResult.answer,
  });
}

// Evaluate results
const evalResults = await evalEngine.evaluate(results);

console.log(`Faithfulness: ${evalResults.avg_faithfulness}`);
console.log(`Relevance: ${evalResults.avg_relevance}`);
console.log(`Context Precision: ${evalResults.avg_context_precision}`);
console.log(`Context Recall: ${evalResults.avg_context_recall}`);
```

### Multi-Agent Workflow

```
User Query → agent-mesh (orchestrator)
                  │
                  ▼
           RAG Retrieval (hybrid-rag-qdrant)
                  │
                  ▼
           Answer Generation
                  │
                  ▼
           Quality Evaluation (rag-eval-pack)
                  │
                  ▼
           Pass Quality Gates?
           ├── Yes → Return answer to user
           └── No → Retry or escalate
```

---

## Agent Workflow Patterns

### Pattern 1: Pre-computation Evaluation

Evaluate RAG outputs before serving to users:

```typescript
const evalResult = await agent.call('rag_eval.judge.faithfulness', {
  context: retrievedChunks,
  generated_answer: generatedAnswer,
});

if (evalResult.score < 0.85) {
  // Trigger fallback: retrieve more context or use different strategy
  return await handleLowConfidence();
}
```

### Pattern 2: Batch Evaluation for Development

Run comprehensive evaluation on development datasets:

```typescript
const runResult = await agent.call('rag_eval.suite.run', {
  dataset: 'datasets/dev-eval.jsonl',
  config: {
    metrics: ['faithfulness', 'relevance', 'context_precision', 'context_recall'],
    judge_model: 'claude-opus',
    budget_limit: 10.00,
  },
});

const results = await agent.call('rag_eval.suite.results', {
  run_id: runResult.run_id,
});

// Analyze results for improvements
```

### Pattern 3: CI Gate Enforcement

Block deployments on quality regression:

```typescript
const gateResult = await agent.call('rag_eval.gate.run', {
  results: latestEvalResults,
  gate_config: 'gates.yaml',
});

if (!gateResult.passed) {
  // Block deployment
  process.exit(1);
}
```

### Pattern 4: Cost-Aware Evaluation

Monitor and control evaluation costs:

```typescript
// Check budget before expensive operation
const budget = await agent.call('rag_eval.judge.cost_check', {
  eval_result: partialResults,
  budget: { daily_limit: 50.00 },
});

if (!budget.within_budget) {
  // Use cheaper heuristic metrics instead of LLM judge
  return await useHeuristicMetrics();
}

// Full LLM judge evaluation
return await agent.call('rag_eval.judge.faithfulness', { /* */ });
```

---

## Security Considerations

### PII Handling

- **Never log raw content** — only hashed identifiers
- **Query text truncated in logs** — first 100 characters only
- **Exports sanitized** — PII removed before export
- **Context data protected** — sensitive information redacted

### API Key Management

- All LLM API keys from environment variables
- Never log API keys or tokens
- Separate keys per provider for isolation
- Key rotation supported without downtime

### Cost Controls

```typescript
const engine = new EvaluationEngine({
  // ... config
  costControls: {
    maxCostPerSample: 0.05,
    maxCostPerRun: 10.00,
    maxCostPerDay: 100.00,
    alertThresholds: [0.5, 0.75, 0.9],
    hardLimit: true,
  },
});
```

---

## Observability

### Structured Logging

Every evaluation run is logged with:

```json
{
  "timestamp": "2026-04-15T23:00:00Z",
  "service": "rag-eval-pack",
  "eval_run_id": "eval-123",
  "level": "info",
  "message": "Evaluation completed",
  "samples": 100,
  "avg_faithfulness": 0.87,
  "avg_relevance": 0.92,
  "avg_context_precision": 0.78,
  "avg_context_recall": 0.94,
  "judge_cost": 12.34,
  "gates_passed": true,
  "duration_ms": 45000
}
```

### OpenTelemetry Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `rag_eval.runs.total` | Counter | Total evaluation runs |
| `rag_eval.samples.evaluated` | Counter | Samples processed |
| `rag_eval.judge.calls` | Counter | LLM judge API calls |
| `rag_eval.judge.cost` | Histogram | Judge cost per run |
| `rag_eval.gates.result` | Gauge | Gate pass/fail (1/0) |
| `rag_eval.cost.per_sample` | Histogram | Cost per sample |
| `rag_eval.metrics.score` | Gauge | Metric score value |

---

## Checklist: Production Readiness

Before deploying a RAG evaluation pipeline to production:

- [ ] Evaluation dataset created with representative queries
- [ ] Baseline metrics established for all four metrics
- [ ] LLM judge calibrated against human labels
- [ ] Cost budgets configured with appropriate limits
- [ ] Quality thresholds defined and validated
- [ ] Regression gates configured with appropriate thresholds
- [ ] PII handling verified in logs
- [ ] CI integration tested (exit codes, reports)
- [ ] Cost tracking enabled and alerts configured
- [ ] Reproducibility verified (same inputs → same outputs)
- [ ] Provider fallbacks configured for resilience
- [ ] Rate limits configured per provider

---

## References

- **ARCHITECTURE.md** — System design deep dive
- **DEV_PLAN.md** — Development checklist
- **README.md** — Quick start and overview
- **datasets/examples/** — Example evaluation datasets
- **MCP Specification** — https://modelcontextprotocol.io/
- **agent-eval-harness/AGENTS.md** — Agent trajectory evaluation patterns
- **hybrid-rag-qdrant/AGENTS.md** — RAG pipeline patterns
