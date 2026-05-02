# Context Recall Evaluation Skill

## Overview

Context Recall measures whether the retrieved context contains all the information needed to answer the query, based on the ground truth answer.

## What It Measures

- **Ground Truth Coverage**: Whether all facts in the ground truth are present in context
- **Missing Information Detection**: Identifies gaps in retrieved information
- **Recall@K**: Proportion of relevant information found in top-K results

## Score Interpretation

| Score Range | Interpretation |
|-------------|----------------|
| 0.90 - 1.0 | Excellent - All ground truth facts covered |
| 0.75 - 0.89 | Good - Most facts covered |
| 0.50 - 0.74 | Fair - Some missing information |
| 0.0 - 0.49 | Poor - Significant information gaps |

## Usage

```typescript
import { ContextRecallScorer } from '@reaatech/rag-eval-metrics';

const scorer = new ContextRecallScorer();
const result = await scorer.score({
  query: 'What is the refund policy?',
  context: [
    'Refunds within 14 days.',
    'Contact support for help.',
  ],
  ground_truth: 'Refunds must be requested within 14 days by contacting support.',
});

console.log(`Context Recall: ${result.score}`);
```

## MCP Tool

```json
{
  "name": "rag_eval.judge.context_recall",
  "arguments": {
    "query": "What is the refund policy?",
    "context": ["Refunds within 14 days.", "Contact support."],
    "ground_truth": "Refunds within 14 days by contacting support."
  }
}
```

## Best Practices

1. **Target >0.90**: Good retrieval should capture most relevant information
2. **Investigate low scores**: May indicate poor query understanding or indexing
3. **Balance with precision**: High recall + low precision = too much noise
4. **Monitor for missing facts**: Low recall means users won't get complete answers
