# Evaluation Gating Skill

## Overview

Evaluation Gating provides CI-style pass/fail gates for RAG evaluation, enabling automated regression prevention and quality assurance in deployment pipelines.

## What It Measures

- **Threshold Gates**: Minimum score requirements for each metric
- **Baseline Comparison**: Regression detection against previous runs
- **Statistical Significance**: Confidence in observed differences

## Gate Types

| Type | Description | Use Case |
|------|-------------|----------|
| Threshold | Min/max score requirements | Ensure minimum quality |
| Baseline Comparison | Compare against previous run | Prevent regressions |
| Cost Threshold | Max cost per sample | Budget enforcement |

## Usage

```typescript
import { GateEngine } from 'rag-eval-pack';

const engine = new GateEngine([
  {
    name: 'min-faithfulness',
    type: 'threshold',
    metric: 'avg_faithfulness',
    operator: '>=',
    threshold: 0.85,
  },
  {
    name: 'no-regression',
    type: 'baseline-comparison',
    metric: 'overall_score',
    allow_regression: false,
  },
]);

const result = engine.evaluate(results, baseline);
console.log(`Gates: ${result.passed ? 'PASSED' : 'FAILED'}`);
```

## MCP Tool

```json
{
  "name": "rag_eval.gate.run",
  "arguments": {
    "results": { "metrics": { "avg_faithfulness": 0.87 } },
    "gate_config": [
      {
        "name": "min-faithfulness",
        "type": "threshold",
        "metric": "avg_faithfulness",
        "operator": ">=",
        "threshold": 0.85
      }
    ]
  }
}
```

## Best Practices

1. **Set realistic thresholds**: Base on historical performance
2. **Use multiple gates**: Combine threshold and baseline gates
3. **Allow small regressions**: Use statistical significance testing
4. **Document gate rationale**: Explain why each gate exists
5. **Review failures promptly**: Investigate root causes quickly
