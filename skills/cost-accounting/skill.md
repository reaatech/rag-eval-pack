# Cost Accounting Skill

## Overview

Cost Accounting tracks and manages the expenses associated with RAG evaluation, particularly LLM API calls for judging. It provides per-sample, per-run, and per-day cost tracking with budget enforcement.

## What It Measures

- **Per-Sample Cost**: Cost to evaluate each individual sample
- **Per-Run Cost**: Total cost for an evaluation run
- **Per-Metric Cost**: Breakdown by metric type (faithfulness, relevance, etc.)
- **Budget Usage**: Real-time tracking against configured limits

## Cost Components

| Component | Typical Cost (USD) |
|-----------|-------------------|
| Heuristic metrics | $0.000 |
| LLM Judge (faithfulness) | $0.01 |
| LLM Judge (relevance) | $0.005 |
| **Total with LLM judge** | **$0.015/sample** |

## Usage

```typescript
import { CostTracker } from 'rag-eval-pack';

const tracker = new CostTracker({
  budgetLimit: 10.00,
  hardLimit: true,
  alertThresholds: [0.5, 0.75, 0.9],
});

tracker.recordCost('sample-1', 0.015, { input: 500, output: 50 }, 'faithfulness');

console.log(`Total: $${tracker.getTotalCost()}`);
console.log(`Within budget: ${tracker.isWithinBudget()}`);
console.log(`Remaining: $${tracker.getRemainingBudget()}`);
```

## MCP Tool

```json
{
  "name": "rag_eval.judge.cost_check",
  "arguments": {
    "total_cost": 5.00,
    "budget_limit": 10.00,
    "samples_evaluated": 100
  }
}
```

## Best Practices

1. **Set budget limits**: Configure daily, per-run, and per-sample limits
2. **Monitor alerts**: Pay attention to threshold warnings
3. **Optimize judge usage**: Use heuristic metrics when possible
4. **Track trends**: Monitor cost per sample over time
5. **Use cheaper models**: Consider smaller models for routine evaluation
