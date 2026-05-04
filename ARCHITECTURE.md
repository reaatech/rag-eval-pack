# rag-eval-pack — Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                  │
│  │     CLI     │    │   Library   │    │  MCP Client │                  │
│  │  (packages/ │    │  (import)   │    │  (Agent)    │                  │
│  │   cli)      │    │             │    │             │                  │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                  │
│         │                   │                   │                         │
│         └───────────────────┼───────────────────┘                         │
│                             │                                               │
└─────────────────────────────┼─────────────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Evaluation Suite (@reaatech/rag-eval-suite)         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Three-Layer Architecture                       │   │
│  │                                                                   │   │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │   │
│  │  │rag_eval.    │───▶│rag_eval.    │───▶│rag_eval.    │           │   │
│  │  │judge.*      │    │suite.*      │    │gate.*       │           │   │
│  │  │(Atomic)     │    │(Orchestrated)│   │(CI Gates)   │           │   │
│  │  └─────────────┘    └─────────────┘    └─────────────┘           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Metrics Engine (@reaatech/rag-eval-metrics)       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Faithfulness│  │  Relevance  │  │  Context    │  │  Context    │    │
│  │  Scorer     │  │   Scorer    │  │ Precision   │  │   Recall    │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
│         │                 │                │                │           │
│         └─────────────────┼────────────────┼────────────────┘           │
│                           ▼                                            │
│                  ┌─────────────────┐                                    │
│                  │    LLM Judge    │  (@reaatech/rag-eval-judge)        │
│                  │   (Calibrated)  │                                    │
│                  └─────────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Cross-Cutting Packages                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │  Dataset Manager │  │   Observability  │  │   Cost Tracker   │       │
│  │  (rag-eval-      │  │  (rag-eval-      │  │  (rag-eval-      │       │
│  │   dataset)       │  │   observability) │  │   cost)          │       │
│  │  - Loading       │  │  - Tracing (OTel)│  │  - Pricing       │       │
│  │  - Validation    │  │  - Metrics (OTel)│  │  - Budgeting     │       │
│  │  - Generation    │  │  - Logging (pino)│  │  - Reporting     │       │
│  │  - Versioning    │  │  - Dashboard     │  │  - Enforcement   │       │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Package Architecture

### Dependency Graph

```
core ← metrics ← suite ← mcp-server, cli
  ↑       ↑
  ├── cost ← judge ← suite, cli
  ├── gate ← suite, mcp-server, cli
  ├── dataset ← suite, cli
  └── observability (standalone, re-exported by cli)
```

### Package Roles

| Package | Role | Depends On | Key Exports |
|---------|------|------------|-------------|
| `@reaatech/rag-eval-core` | Foundation types + Zod schemas | (leaf) | `EvaluationSample`, `EvalSuiteConfig`, `GateConfig`, `JudgeConfig`, `CostBreakdown`, schemas |
| `@reaatech/rag-eval-metrics` | Heuristic metric scorers | core | `FaithfulnessScorer`, `RelevanceScorer`, `ContextPrecisionScorer`, `ContextRecallScorer`, `MetricsEngine` |
| `@reaatech/rag-eval-cost` | Cost tracking infrastructure | core | `CostTracker`, `Pricing`, `BudgetManager`, `CostReporter` |
| `@reaatech/rag-eval-judge` | LLM-as-judge | core, cost | `JudgeEngine`, `JudgeCalibrator`, `JudgeCostTracker`, prompts |
| `@reaatech/rag-eval-gate` | Quality gates | core | `GateEngine`, `ThresholdGates`, `BaselineGates`, `CIIntegration` |
| `@reaatech/rag-eval-dataset` | Dataset management | core | `DatasetLoader`, `DatasetValidator`, `DatasetGenerator`, `DatasetVersioning` |
| `@reaatech/rag-eval-observability` | Logging, tracing, metrics | core | `createLogger`, `traceEvalRun`, `recordEvalRun`, `Dashboard` |
| `@reaatech/rag-eval-suite` | Central orchestrator | core, metrics, cost, judge, gate, dataset | `EvaluationSuite` |
| `@reaatech/rag-eval-mcp-server` | MCP server tools | core, metrics, gate, suite | `createMcpServer`, `handleJudgeTool`, `handleSuiteTool`, `handleGateTool` |
| `@reaatech/rag-eval-cli` | CLI + barrel re-export | all of the above | CLI commands, master barrel |

---

## Design Principles

### 1. Composable Packages
- Each package has a single, well-defined responsibility
- Packages depend only on what's below them in the dependency graph
- `@reaatech/rag-eval-core` is the universal leaf — every package depends on it
- The CLI package is the master barrel, re-exporting everything for convenience

### 2. Three-Layer Tool Architecture
- **rag_eval.judge.*** — Atomic, stateless operations for mid-task self-evaluation
- **rag_eval.suite.*** — Orchestrated runs for eval-driven development
- **rag_eval.gate.*** — CI-style pass/fail gates for regression prevention

### 3. Provider-Agnostic
- Any LLM provider can be used for judging (Claude, GPT-4, Gemini)
- Unified interface for all providers via `JudgeEngine`
- Provider-specific optimizations are encapsulated within the judge package

### 4. Reproducibility First
- Same inputs always produce same outputs (deterministic seed management)
- All configuration and datasets are versionable
- Run metadata tracked for auditability via `run_id`

### 5. Cost-Aware Evaluation
- LLM-as-judge costs tracked per-request with token-level detail
- Budget limits enforced at sample, run, and daily levels
- Cost estimation before running expensive operations via `JudgeCostTracker.estimateCost()`

### 6. CI-Native Design
- Exit codes suitable for automation (0 = pass, 1 = fail)
- JUnit XML and GitHub Actions output formatting via `CostReporter`
- `CIIntegration` for formatted CI annotations

---

## Build System

### Monorepo Tooling

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Root Orchestration                             │
│                                                                      │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐         │
│  │  pnpm    │   │  turbo   │   │  biome   │   │changesets│         │
│  │workspaces│   │  build   │   │ lint +   │   │ version  │         │
│  │ 10.22    │   │  orchest │   │ format   │   │ publish  │         │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘         │
│       │               │               │               │               │
│       ▼               ▼               ▼               ▼               │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                    Per-Package Build                           │    │
│  │                                                                │    │
│  │  tsup src/index.ts --format cjs,esm --dts --clean              │    │
│  │                                                                │    │
│  │  → dist/index.js      (ESM)                                    │    │
│  │  → dist/index.cjs     (CJS)                                    │    │
│  │  → dist/index.d.ts    (types)                                  │    │
│  └──────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Build Pipeline (turbo.json)

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],    // Build dependencies first
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]       // Tests need built artifacts
    },
    "typecheck": {
      "dependsOn": ["^build"]      // Cross-package types resolved via tsconfig.typecheck.json
    }
  }
}
```

---

## Component Deep Dive

### Faithfulness Scorer

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Faithfulness Scorer                              │
│  Package: @reaatech/rag-eval-metrics                                 │
│                                                                      │
│  Input: { query, context[], generated_answer }                      │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │   Statement     │    │    Entailment   │    │    Score        │  │
│  │   Extraction    │    │    Check        │    │   Aggregation   │  │
│  │                 │    │                 │    │                 │  │
│  │ - NLP-based     │    │ - Context       │    │ - Percentage of │  │
│  │   decomposition │    │   entailment    │    │   statements    │  │
│  │ - Atomic claims │    │   verification  │    │   supported by  │  │
│  │                 │    │ - Per-statement │    │   context       │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                      │
│  Output: { score, statements, supported_count, total_count }        │
└─────────────────────────────────────────────────────────────────────┘
```

### Relevance Scorer

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Relevance Scorer                                │
│  Package: @reaatech/rag-eval-metrics                                 │
│                                                                      │
│  Input: { query, generated_answer }                                 │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │    Semantic     │    │    Intent       │    │    Score        │  │
│  │    Similarity   │    │    Coverage     │    │   Aggregation   │  │
│  │                 │    │                 │    │                 │  │
│  │ - Embedding-    │    │ - Decompose     │    │ - Weighted      │  │
│  │   based         │    │   query into    │    │   combination   │  │
│  │   similarity    │    │   intents       │    │ - Semantic      │  │
│  │   (cosine)      │    │ - Check answer  │    │   similarity +  │  │
│  │                 │    │   coverage      │    │   intent score  │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                      │
│  Output: { score, semantic_similarity, intent_score, intents }      │
└─────────────────────────────────────────────────────────────────────┘
```

### Context Precision Scorer

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Context Precision Scorer                          │
│  Package: @reaatech/rag-eval-metrics                                 │
│                                                                      │
│  Input: { query, context[], ground_truth }                          │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │    Relevance    │    │    Average      │    │   Normalized    │  │
│  │    Assessment   │    │   Precision     │    │   DCG (NDCG)    │  │
│  │                 │    │   (MAP)         │    │                 │  │
│  │ - Assess each   │    │ - Calculate     │    │ - Discounted    │  │
│  │   context       │    │   precision at  │    │   cumulative    │  │
│  │   chunk for     │    │   each relevant │    │   gain          │  │
│  │   relevance     │    │   chunk         │    │ - Normalized    │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                      │
│  Output: { score, map, ndcg, relevant_ranks }                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Context Recall Scorer

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Context Recall Scorer                            │
│  Package: @reaatech/rag-eval-metrics                                 │
│                                                                      │
│  Input: { query, context[], ground_truth }                          │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │  Ground Truth   │    │    Coverage     │    │    Score        │  │
│  │  Decomposition  │    │    Check        │    │  Calculation    │  │
│  │                 │    │                 │    │                 │  │
│  │ - Extract       │    │ - Check if each │    │ - Percentage of │  │
│  │   atomic        │    │   ground truth  │    │   ground truth  │  │
│  │   facts from    │    │   fact is       │    │   facts covered │  │
│  │   ground truth  │    │   present in    │    │   by context    │  │
│  │                 │    │   any context   │    │                 │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                      │
│  Output: { score, total_facts, covered_facts }                      │
└─────────────────────────────────────────────────────────────────────┘
```

### LLM Judge with Calibration

```
┌─────────────────────────────────────────────────────────────────────┐
│                  LLM Judge with Calibration                          │
│  Package: @reaatech/rag-eval-judge                                   │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │    Engine       │    │   Calibrator    │    │    Prompts      │  │
│  │                 │    │                 │    │                 │  │
│  │ - Provider-     │    │ - Human label   │    │ - Faithfulness  │  │
│  │   agnostic      │    │   alignment     │    │ - Relevance     │  │
│  │ - Multi-model   │    │ - Temperature   │    │ - Context       │  │
│  │   consensus     │    │   scaling       │    │   precision     │  │
│  │ - Batch         │    │ - Isotonic      │    │ - Context       │  │
│  │   processing    │    │   regression    │    │   recall        │  │
│  │                 │    │                 │    │ - Overall       │  │
│  │                 │    │                 │    │   quality       │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                      │
│  Providers: Anthropic (Claude), OpenAI (GPT), Google (Gemini)        │
│  Output: { score, explanation, provider, model, metric }            │
└─────────────────────────────────────────────────────────────────────┘
```

### Cost Tracker

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Cost Tracker                                   │
│  Package: @reaatech/rag-eval-cost                                    │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │    Tracker      │    │ Budget Manager  │    │    Reporter     │  │
│  │                 │    │                 │    │                 │  │
│  │ - Per-sample    │    │ - Budget        │    │ - Cost per      │  │
│  │   cost          │    │   enforcement   │    │   evaluation    │  │
│  │ - Provider-     │    │ - Alert         │    │ - Cost per      │  │
│  │   specific      │    │   thresholds    │    │   metric        │  │
│  │   pricing       │    │   (50/75/90%)   │    │ - JUnit XML     │  │
│  │ - Metric        │    │ - Hard/soft     │    │ - Trends        │  │
│  │   breakdown     │    │   stop modes    │    │                 │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                      │
│  Output: CostBreakdown { total, by_metric, by_provider, per_sample }│
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Complete Evaluation Flow

```
1. Load dataset via @reaatech/rag-eval-dataset
   - JSONL, JSON, or YAML formats
   - Zod validation of every sample
         │
2. Run heuristic metrics via @reaatech/rag-eval-metrics
   - Parallel execution with configurable concurrency
   - Faithfulness: statement extraction → context entailment
   - Relevance: semantic similarity + intent coverage
   - Context Precision: MAP + NDCG
   - Context Recall: fact decomposition → coverage check
         │
3. Run LLM judge via @reaatech/rag-eval-judge (if configured)
   - Provider selection with fallback
   - Optional consensus voting across multiple models
   - Optional calibration against human labels
   - Cost estimation before each call
         │
4. Track costs via @reaatech/rag-eval-cost
   - Per-sample token counting with tiktoken
   - Provider-specific pricing lookup
   - Budget enforcement with configurable thresholds
         │
5. Aggregate results via @reaatech/rag-eval-metrics (MetricsEngine)
   - Mean scores per metric
   - Standard deviation per metric
   - Overall weighted score
   - Cost per sample
         │
6. Evaluate gates via @reaatech/rag-eval-gate
   - Threshold gates (>=, <=, >, <, ==)
   - Baseline comparison gates (regression detection)
   - Pass/fail determination with failure messages
         │
7. Export results
   - SuiteRunResult with run_id, status, metrics, gate_result
   - Optional JSON/Markdown output via CLI
   - OpenTelemetry traces and metrics
   - Structured Pino logging
```

---

## Security Model

### Defense in Depth

```
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 1: Data                                                        │
│ - PII redaction in all logs                                         │
│ - Hash sensitive identifiers                                        │
│ - Never log raw content                                             │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 2: API Keys                                                    │
│ - All LLM API keys from environment variables                       │
│ - Never log API keys or tokens                                      │
│ - Separate keys per provider (ANTHROPIC_API_KEY, OPENAI_API_KEY,    │
│   GOOGLE_API_KEY)                                                   │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 3: Cost Controls                                               │
│ - Budget limits enforced per sample, run, and day                   │
│ - Cost estimation before expensive LLM operations                   │
│ - Real-time cost monitoring with alert thresholds                   │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 4: Export Security                                             │
│ - PII sanitization before export                                    │
│ - Configurable data retention                                       │
│ - Secure transport (HTTPS) for remote exporters                     │
└─────────────────────────────────────────────────────────────────────┘
```

### PII Handling

- Evaluation content is never logged (only hashed identifiers)
- Query identifiers are hashed before logging
- Exports are sanitized to remove PII
- Context data is redacted before logging

---

## Observability

### Tracing (OpenTelemetry)

| Span | Package | Attributes |
|------|---------|------------|
| `rag_eval.run` | observability | run_id, samples, config, metrics |
| `metric.faithfulness` | observability | run_id, sample_id, statements, supported |
| `metric.relevance` | observability | run_id, sample_id, similarity, intent |
| `metric.context_precision` | observability | run_id, sample_id, map, ndcg |
| `metric.context_recall` | observability | run_id, sample_id, facts, covered |
| `judge.evaluate` | observability | run_id, sample_id, model, provider, cost |
| `gate.check` | observability | run_id, gate_count, passed |

### Metrics (OpenTelemetry)

| Metric | Type | Label | Description |
|--------|------|-------|-------------|
| `rag_eval.runs.total` | Counter | status | Total evaluation runs |
| `rag_eval.samples.evaluated` | Counter | dataset | Samples processed |
| `rag_eval.judge.calls` | Counter | model, status | LLM judge API calls |
| `rag_eval.judge.cost` | Histogram | model | Judge cost per run |
| `rag_eval.gates.result` | Gauge | gate_name | Gate pass/fail (1/0) |
| `rag_eval.cost.per_sample` | Histogram | metric | Cost per sample |
| `rag_eval.metrics.score` | Gauge | metric | Metric score value |

### Logging (Pino)

All logs are structured JSON with standard fields:

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

---

## Failure Modes

| Failure | Detection | Recovery |
|---------|-----------|----------|
| Dataset load error | File not found, parse error | Return detailed error, suggest fixes |
| Invalid sample format | Missing required fields, Zod validation error | List missing fields, show expected schema |
| LLM API error | Non-2xx response, network timeout | Retry with backoff, fallback to alternate provider, skip sample |
| Budget exceeded | Cost > budget limit | Stop LLM judge, return partial results with status "partial" |
| Gate evaluation error | Invalid gate config | Log error, fail open (pass) with warning |
| Timeout | Request exceeds timeout | Return partial results, log warning |
| Missing provider credentials | API key not set in environment | Fall back to next provider in fallback list |

---

## Performance Characteristics

### Latency Budget (Target)

| Metric | P50 | P90 | P99 |
|--------|-----|-----|-----|
| Faithfulness (heuristic) | 50ms | 100ms | 200ms |
| Relevance (heuristic) | 30ms | 60ms | 120ms |
| Context Precision | 20ms | 40ms | 80ms |
| Context Recall | 40ms | 80ms | 160ms |
| LLM Judge (per sample) | 2000ms | 4000ms | 8000ms |

### Cost Per Sample (Estimated)

| Component | Cost (USD) |
|-----------|------------|
| Heuristic metrics | $0.000 |
| LLM Judge (faithfulness, claude-opus) | $0.01 |
| LLM Judge (relevance, claude-opus) | $0.005 |
| **Total (with LLM judge)** | **$0.015** |
| **Total (heuristic only)** | **$0.000** |

---

## References

- **AGENTS.md** — Agent development guide
- **DEV_PLAN.md** — Development checklist
- **README.md** — Quick start and overview
- **datasets/examples/** — Example evaluation datasets
- **MCP Specification** — https://modelcontextprotocol.io/
