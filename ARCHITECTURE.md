# rag-eval-pack — Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                  │
│  │     CLI     │    │   Library   │    │  MCP Client │                  │
│  │   (npx)     │    │  (import)   │    │  (Agent)    │                  │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                  │
│         │                   │                   │                         │
│         └───────────────────┼───────────────────┘                         │
│                             │                                               │
└─────────────────────────────┼─────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Evaluation Core Engine                              │
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
│                        Metrics Engine                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Faithfulness│  │  Relevance  │  │  Context    │  │  Context    │    │
│  │  Scorer     │  │   Scorer    │  │ Precision   │  │   Recall    │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
│         │                 │                │                │           │
│         └─────────────────┼────────────────┼────────────────┘           │
│                           ▼                                            │
│                  ┌─────────────────┐                                    │
│                  │    LLM Judge    │                                    │
│                  │   (Calibrated)  │                                    │
│                  └─────────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Cross-Cutting Concerns                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │  Dataset Manager │  │   Observability  │  │  Reproducibility │       │
│  │  - Versioning    │  │  - Tracing (OTel)│  │  - Seed mgmt     │       │
│  │  - Validation    │  │  - Metrics (OTel)│  │  - Deterministic │       │
│  │  - Generation    │  │  - Logging (pino)│  │  - Versioning    │       │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Design Principles

### 1. Three-Layer Architecture
- **rag_eval.judge.*** — Atomic, stateless operations for mid-task self-evaluation
- **rag_eval.suite.*** — Orchestrated runs for eval-driven development
- **rag_eval.gate.*** — CI-style pass/fail gates for regression prevention

### 2. Provider-Agnostic
- Any LLM provider can be used for judging (Claude, GPT-4, Gemini, open-source)
- Unified interface for all providers
- Provider-specific optimizations are encapsulated

### 3. Reproducibility First
- Same inputs always produce same outputs (deterministic seed management)
- Version all configuration and evaluation datasets
- Track eval run metadata for auditability

### 4. Cost-Aware Evaluation
- LLM-as-judge costs tracked per-request
- Budget limits enforced (soft and hard)
- Cost estimation before running expensive operations

### 5. CI-Native Design
- Exit codes suitable for automation
- JUnit XML and GitHub Actions output formatting
- Fast gate evaluation with caching

---

## Component Deep Dive

### Three-Layer MCP Tool Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                 Layer 1: rag_eval.judge.* (Atomic)                   │
│                                                                      │
│  Fast, stateless, composable operations for mid-task self-evaluation │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │  faithfulness   │    │    relevance    │    │context_precision│  │
│  │                 │    │                 │    │                 │  │
│  │ Score answer    │    │ Score answer    │    │ Score context   │  │
│  │ faithfulness to │    │ relevance to    │    │ ranking quality │  │
│  │ context         │    │ user query      │    │                 │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐                         │
│  │  context_recall │    │    cost_check   │                         │
│  │                 │    │                 │                         │
│  │ Score context   │    │ Verify cost     │                         │
│  │ coverage of     │    │ within budget   │                         │
│  │ ground truth    │    │                 │                         │
│  └─────────────────┘    └─────────────────┘                         │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│               Layer 2: rag_eval.suite.* (Orchestrated)               │
│                                                                      │
│  Stateful, longer-running operations for eval-driven development     │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │      run        │    │     status      │    │     results     │  │
│  │                 │    │                 │    │                 │  │
│  │ Execute full    │    │ Get evaluation  │    │ Retrieve eval   │  │
│  │ evaluation suite│    │ run status      │    │ results         │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐                         │
│  │     compare     │    │     baseline    │                         │
│  │                 │    │                 │                         │
│  │ Compare two     │    │ Set/update      │                         │
│  │ evaluation runs │    │ baseline        │                         │
│  └─────────────────┘    └─────────────────┘                         │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                   Layer 3: rag_eval.gate.* (CI Gates)                │
│                                                                      │
│  Opinionated, blocking operations for CI/CD                          │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │       run       │    │     config      │    │       diff      │  │
│  │                 │    │                 │    │                 │  │
│  │ Run CI-style    │    │ Get/set gate    │    │ Get detailed    │  │
│  │ pass/fail gate  │    │ configuration   │    │ diff from base  │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Faithfulness Scorer

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Faithfulness Scorer                              │
│                                                                      │
│  Input: { query, context[], generated_answer }                      │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │   Statement     │    │    Entailment   │    │    Score        │  │
│  │   Extraction    │    │    Check        │    │   Aggregation   │  │
│  │                 │    │                 │    │                 │  │
│  │ - Extract       │    │ - LLM judge     │    │ - Percentage of │  │
│  │   atomic        │    │ - Context       │    │   statements    │  │
│  │   statements    │    │   entailment    │    │   supported by  │  │
│  │   from answer   │    │   verification  │    │   context       │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                      │
│  Output: FaithfulnessResult { score, statements, supported_count }  │
└─────────────────────────────────────────────────────────────────────┘
```

### Relevance Scorer

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Relevance Scorer                                │
│                                                                      │
│  Input: { query, generated_answer }                                 │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │    Semantic     │    │    Intent       │    │    Score        │  │
│  │    Similarity   │    │    Coverage     │    │   Aggregation   │  │
│  │                 │    │                 │    │                 │  │
│  │ - Embedding-    │    │ - Query intent  │    │ - Weighted      │  │
│  │   based         │    │   extraction    │    │   combination   │  │
│  │   similarity    │    │ - Answer        │    │ - Semantic      │  │
│  │   (cosine)      │    │   coverage      │    │   similarity +  │  │
│  │                 │    │   assessment    │    │   intent score  │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                      │
│  Output: RelevanceResult { score, semantic_similarity, intent_score}│
└─────────────────────────────────────────────────────────────────────┘
```

### Context Precision Scorer

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Context Precision Scorer                          │
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
│  Output: ContextPrecisionResult { score, map, ndcg, ranked_scores } │
└─────────────────────────────────────────────────────────────────────┘
```

### Context Recall Scorer

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Context Recall Scorer                            │
│                                                                      │
│  Input: { query, context[], ground_truth }                          │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │  Ground Truth   │    │    Coverage     │    │    Score        │  │
│  │  Analysis       │    │    Check        │    │  Calculation    │  │
│  │                 │    │                 │    │                 │  │
│  │ - Extract       │    │ - Check if each │    │ - Percentage of │  │
│  │   atomic        │    │   ground truth  │    │   ground truth  │  │
│  │   facts from    │    │   fact is       │    │   facts covered │  │
│  │   ground truth  │    │   present in    │    │   by context    │  │
│  │                 │    │   any context   │    │                 │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                      │
│  Output: ContextRecallResult { score, total_facts, covered_facts }  │
└─────────────────────────────────────────────────────────────────────┘
```

### LLM Judge with Calibration

```
┌─────────────────────────────────────────────────────────────────────┐
│                  LLM Judge with Calibration                          │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │    Engine       │    │   Calibrator    │    │    Prompts      │  │
│  │                 │    │                 │    │                 │  │
│  │ - Provider-     │    │ - Human label   │    │ - Faithfulness  │  │
│  │   agnostic      │    │   alignment     │    │ - Relevance     │  │
│  │ - Batch         │    │ - Temperature   │    │ - Context       │  │
│  │   processing    │    │   scaling       │    │   quality       │  │
│  │ - Parallel      │    │ - Multi-judge   │    │ - Overall       │  │
│  │   requests      │    │   consensus     │    │   quality       │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                      │
│  Output: JudgeScore { score, explanation, confidence, calibrated }  │
└─────────────────────────────────────────────────────────────────────┘
```

### Cost Tracker

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Cost Tracker                                   │
│                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │    Tracker      │    │ Budget Manager  │    │    Reporter     │  │
│  │                 │    │                 │    │                 │  │
│  │ - Per-eval      │    │ - Budget        │    │ - Cost per      │  │
│  │   cost          │    │   enforcement   │    │   evaluation    │  │
│  │ - Provider-     │    │ - Alerts and    │    │ - Cost per      │  │
│  │   agnostic      │    │   warnings      │    │   metric        │  │
│  │ - Metric        │    │ - Optimization  │    │ - Trends        │  │
│  │   breakdown     │    │   recommend     │    │ - Export        │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                      │
│  Output: CostBreakdown { total_cost, per_metric, per_sample }       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Complete Evaluation Flow

```
1. Load evaluation dataset (JSONL format)
        │
2. Validate dataset structure:
   - Required fields present
   - Valid sample format
   - Ground truth format
        │
3. For each sample, calculate metrics:
   - Faithfulness: extract statements, verify entailment
   - Relevance: semantic similarity, intent coverage
   - Context Precision: MAP, NDCG calculation
   - Context Recall: ground truth coverage
        │
4. Run LLM judge (if configured):
   - Provider-agnostic evaluation
   - Batch processing with rate limiting
   - Cost tracking per judgment
        │
5. Calculate costs:
   - Per-sample token counting
   - Provider-specific pricing
   - Budget compliance check
        │
6. Aggregate results:
   - Overall score calculation
   - Per-metric breakdown
   - Summary statistics
        │
7. Evaluate gates (if configured):
   - Threshold checks
   - Baseline comparison
   - Pass/fail determination
        │
8. Export results:
    - JSON report
    - CI-compatible output
    - Observability data
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
│ - Separate keys per provider                                        │
├─────────────────────────────────────────────────────────────────────┤
│ Layer 3: Cost Controls                                               │
│ - Budget limits enforced                                            │
│ - Cost estimation before expensive operations                       │
│ - Real-time cost monitoring with alerts                             │
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
- Configurable PII patterns for redaction

---

## Observability

### Tracing

Every evaluation run generates OpenTelemetry spans:

| Span | Attributes |
|------|------------|
| `rag_eval.run` | samples, config, metrics |
| `metric.faithfulness` | statements, supported |
| `metric.relevance` | similarity, intent |
| `metric.context_precision` | map, ndcg |
| `metric.context_recall` | facts, covered |
| `judge.evaluate` | model, samples, cost |
| `gate.check` | gate_count, passed |

### Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `rag_eval.runs.total` | Counter | `status` | Total evaluation runs |
| `rag_eval.samples.evaluated` | Counter | `dataset` | Samples processed |
| `rag_eval.judge.calls` | Counter | `model`, `status` | LLM judge API calls |
| `rag_eval.judge.cost` | Histogram | `model` | Judge cost per run |
| `rag_eval.gates.result` | Gauge | `gate_name` | Gate pass/fail (1/0) |
| `rag_eval.cost.per_sample` | Histogram | `metric` | Cost per sample |
| `rag_eval.metrics.score` | Gauge | `metric` | Metric score value |

### Logging

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

## Deployment Architecture

### GCP Cloud Run

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Cloud Run Service                            │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    rag-eval-pack Container                    │    │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐                │    │
│  │  │ Eval      │  │ OTel      │  │ Secrets   │                │    │
│  │  │ Engine    │  │ Sidecar   │  │ Mounted   │                │    │
│  │  └───────────┘  └───────────┘  └───────────┘                │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Config:                                                             │
│  - Min instances: 0 (scale to zero)                                 │
│  - Max instances: 5 (configurable)                                  │
│  - Memory: 1GB, CPU: 1 vCPU                                         │
│  - Timeout: 300s (for large evals)                                  │
│                                                                      │
│  Secrets: Secret Manager → mounted as env vars                       │
│  Observability: OTel → Cloud Monitoring / Datadog                    │
│  Storage: GCS for datasets and results                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Failure Modes

| Failure | Detection | Recovery |
|---------|-----------|----------|
| Dataset load error | File not found, parse error | Return detailed error, suggest fixes |
| Invalid sample format | Missing required fields | List missing fields, show expected schema |
| LLM API error | Non-2xx response | Retry with backoff, skip sample, continue |
| Budget exceeded | Cost > budget limit | Stop judge, return partial results |
| Gate evaluation error | Invalid gate config | Log error, fail open (pass) with warning |
| Timeout | Request exceeds timeout | Return partial results, log warning |

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
| LLM Judge (faithfulness) | $0.01 |
| LLM Judge (relevance) | $0.005 |
| **Total (with LLM judge)** | **$0.015** |
| **Total (heuristic only)** | **$0.000** |

---

## References

- **AGENTS.md** — Agent development guide
- **DEV_PLAN.md** — Development checklist
- **README.md** — Quick start and overview
- **datasets/examples/** — Example evaluation datasets
- **MCP Specification** — https://modelcontextprotocol.io/
- **agent-eval-harness/ARCHITECTURE.md** — Agent trajectory evaluation patterns
- **hybrid-rag-qdrant/ARCHITECTURE.md** — RAG pipeline patterns
