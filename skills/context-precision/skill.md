# Context Precision Evaluation Skill

## Overview

Context Precision measures how well the retrieved context chunks are ranked, assessing whether relevant information appears at the top of the results.

## What It Measures

- **Ranked Relevance**: Whether relevant chunks are ranked higher
- **Mean Average Precision (MAP)**: Precision at each relevant chunk position
- **Normalized DCG (NDCG)**: Discounted cumulative gain normalized by ideal ranking

## Score Interpretation

| Score Range | Interpretation |
|-------------|----------------|
| 0.75 - 1.0 | Excellent - Relevant chunks ranked at top |
| 0.60 - 0.74 | Good - Most relevant chunks near top |
| 0.40 - 0.59 | Fair - Mixed ranking quality |
| 0.0 - 0.39 | Poor - Relevant chunks buried in results |

## Usage

```typescript
import { ContextPrecisionScorer } from 'rag-eval-pack';

const scorer = new ContextPrecisionScorer();
const result = await scorer.score({
  query: 'What is the refund policy?',
  context: [
    'Refunds within 14 days.',
    'Contact support for help.',
    'Shipping takes 3-5 days.',
  ],
  ground_truth: 'Refunds must be requested within 14 days.',
});

console.log(`Context Precision: ${result.score}`);
```

## MCP Tool

```json
{
  "name": "rag_eval.judge.context_precision",
  "arguments": {
    "query": "What is the refund policy?",
    "context": ["Refunds within 14 days.", "Contact support."],
    "ground_truth": "Refunds within 14 days."
  }
}
```

## Best Practices

1. **Target >0.75**: Good retrieval systems should score above 0.75
2. **Monitor ranking quality**: Low scores indicate poor chunk ordering
3. **Optimize retrieval**: Improve embedding quality and search algorithms
4. **Consider chunk size**: Too large or small chunks affect precision
