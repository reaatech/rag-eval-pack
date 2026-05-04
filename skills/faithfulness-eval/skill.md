# Faithfulness Evaluation Skill

## Overview

Faithfulness measures whether a RAG system's generated answer is grounded in the provided context, without hallucinations or fabrications.

## What It Measures

- **Statement Extraction**: Identifies atomic claims in the generated answer
- **Context Entailment**: Verifies each claim against the retrieved context
- **Hallucination Detection**: Flags information not supported by context

## Score Interpretation

| Score Range | Interpretation |
|-------------|----------------|
| 0.85 - 1.0 | Excellent - All claims supported by context |
| 0.70 - 0.84 | Good - Most claims supported |
| 0.50 - 0.69 | Fair - Some hallucinations detected |
| 0.0 - 0.49 | Poor - Significant hallucinations |

## Usage

```typescript
import { FaithfulnessScorer } from '@reaatech/rag-eval-metrics';

const scorer = new FaithfulnessScorer();
const result = await scorer.score({
  context: ['Refunds are processed within 14 days.'],
  generated_answer: 'You have 14 days to request a refund.',
});

console.log(`Faithfulness: ${result.score}`);
```

## MCP Tool

```json
{
  "name": "rag_eval.judge.faithfulness",
  "arguments": {
    "context": ["Refunds within 14 days."],
    "generated_answer": "You have 14 days for refunds."
  }
}
```

## Best Practices

1. **High threshold for production**: Aim for >0.85 faithfulness
2. **Combine with other metrics**: Use alongside relevance and context quality
3. **Review low scores**: Investigate hallucination patterns
4. **Calibrate with human labels**: Improve accuracy over time
