# LLM Judge for RAG Skill

## Overview

LLM-as-Judge uses large language models to evaluate RAG output quality, providing calibrated, human-like assessments of faithfulness, relevance, and overall quality.

## What It Measures

- **Faithfulness**: Whether the answer is grounded in context
- **Relevance**: Whether the answer addresses the query
- **Overall Quality**: Holistic assessment of answer quality
- **Calibration**: Alignment with human judgment

## Supported Providers

| Provider | Models | Use Case |
|----------|--------|----------|
| Anthropic | Claude Opus, Sonnet, Haiku | High-quality judgment |
| OpenAI | GPT-4 Turbo, GPT-4 | Reliable evaluation |
| Google | Gemini Pro, Ultra | Cost-effective option |

## Usage

```typescript
import { JudgeEngine } from '@reaatech/rag-eval-judge';

const judge = new JudgeEngine({
  model: 'claude-opus',
  calibration: {
    enabled: true,
    human_labels: 'calibration/human-labels.jsonl',
  },
  consensus: {
    enabled: true,
    models: ['claude-opus', 'gpt-4-turbo'],
  },
});

const result = await judge.evaluate(sample, 'faithfulness');
console.log(`Score: ${result.score}, Explanation: ${result.explanation}`);
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

1. **Calibrate regularly**: Update calibration with new human labels
2. **Use consensus for critical evals**: Multiple judges improve accuracy
3. **Monitor judge costs**: Track per-judgment expenses
4. **Review explanations**: Use judge explanations to understand scores
5. **Set fallback models**: Configure backup providers for resilience
