# Answer Relevance Evaluation Skill

## Overview

Relevance measures whether a RAG system's generated answer actually addresses the user's query, assessing both semantic similarity and intent coverage.

## What It Measures

- **Semantic Similarity**: Embedding-based similarity between query and answer
- **Intent Coverage**: Whether the answer addresses the user's intent
- **Completeness**: Whether the answer fully responds to the query

## Score Interpretation

| Score Range | Interpretation |
|-------------|----------------|
| 0.80 - 1.0 | Excellent - Directly addresses query |
| 0.65 - 0.79 | Good - Relevant but may miss some aspects |
| 0.50 - 0.64 | Fair - Partially relevant |
| 0.0 - 0.49 | Poor - Off-topic or irrelevant |

## Usage

```typescript
import { RelevanceScorer } from 'rag-eval-pack';

const scorer = new RelevanceScorer();
const result = await scorer.score({
  query: 'How do I reset my password?',
  generated_answer: 'Go to the settings page and click "Reset Password".',
});

console.log(`Relevance: ${result.score}`);
```

## MCP Tool

```json
{
  "name": "rag_eval.judge.relevance",
  "arguments": {
    "query": "How do I reset my password?",
    "generated_answer": "Go to settings and click Reset Password."
  }
}
```

## Best Practices

1. **Target >0.80**: Good RAG systems should score above 0.80
2. **Check intent coverage**: Ensure answers address the actual question
3. **Monitor for partial answers**: Low relevance may indicate incomplete retrieval
4. **Combine with faithfulness**: High relevance + low faithfulness = confident but wrong
