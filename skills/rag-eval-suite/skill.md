# RAG Eval Suite Skill

## Overview

RAG Eval Suite orchestrates comprehensive evaluation of RAG systems, combining multiple metrics (faithfulness, relevance, context precision, context recall) with LLM judging, cost tracking, and CI gates in a single coordinated run.

## What It Measures

- **All Four Core Metrics**: Faithfulness, relevance, context precision, context recall
- **LLM Judge Scores**: Calibrated quality assessments
- **Cost Breakdown**: Per-sample, per-metric, and total costs
- **Gate Results**: Pass/fail for CI integration

## Usage

```typescript
import { EvaluationSuite } from '@reaatech/rag-eval-suite';

const suite = new EvaluationSuite({
  metrics: ['faithfulness', 'relevance', 'context_precision', 'context_recall'],
  judge: {
    model: 'claude-opus',
    enabled: true,
    calibration: { enabled: true },
  },
  cost: {
    budget_limit: 10.00,
    alert_thresholds: [0.5, 0.75, 0.9],
  },
  gates: [
    {
      name: 'min-faithfulness',
      type: 'threshold',
      metric: 'avg_faithfulness',
      operator: '>=',
      threshold: 0.85,
    },
  ],
});

const result = await suite.runFromFile('datasets/eval-samples.jsonl');

console.log(`Overall: ${result.results.metrics.overall_score}`);
console.log(`Gates: ${result.gate_result?.passed ? 'PASSED' : 'FAILED'}`);
```

## MCP Tool

```json
{
  "name": "rag_eval.suite.run",
  "arguments": {
    "samples": [
      {
        "query": "What is the refund policy?",
        "context": ["Refunds within 14 days."],
        "ground_truth": "Refunds within 14 days.",
        "generated_answer": "You have 14 days for refunds."
      }
    ],
    "config": {
      "metrics": ["faithfulness", "relevance"],
      "judge": { "model": "claude-opus" }
    }
  }
}
```

## Best Practices

1. **Run comprehensive evals**: Use all four metrics for complete picture
2. **Set appropriate budgets**: Balance accuracy with cost
3. **Establish baselines**: Track performance over time
4. **Configure gates**: Automate quality assurance
5. **Review results holistically**: Consider all metrics together
