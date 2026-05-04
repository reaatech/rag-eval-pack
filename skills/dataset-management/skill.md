# Dataset Management Skill

## Overview

Dataset Management handles the creation, validation, versioning, and maintenance of evaluation datasets for RAG systems. It ensures high-quality, representative test data for reliable evaluation.

## What It Measures

- **Dataset Quality**: Completeness, validity, and representativeness
- **Format Compliance**: Adherence to expected schema
- **Version Tracking**: Changes and evolution over time
- **Coverage**: Domain and query type representation

## Supported Formats

| Format | Description | Use Case |
|--------|-------------|----------|
| JSONL | One sample per line | Large datasets, streaming |
| JSON | Array of samples | Small to medium datasets |
| YAML | Human-readable config | Configuration-heavy datasets |

## Usage

```typescript
import { DatasetLoader } from '@reaatech/rag-eval-dataset';

const loader = new DatasetLoader();

// Load from file
const samples = await loader.load('datasets/eval-samples.jsonl');

// Load from string
const inlineSamples = await loader.loadFromString(
  '{"query": "test", "context": ["ctx"], "ground_truth": "gt", "generated_answer": "ans"}',
  'jsonl'
);

console.log(`Loaded ${samples.length} samples`);
```

## Sample Format (JSONL)

```jsonl
{"query": "What is the refund policy?", "context": ["Refunds within 14 days."], "ground_truth": "Refunds within 14 days.", "generated_answer": "You have 14 days for refunds."}
```

## Best Practices

1. **Representative samples**: Cover all query types and domains
2. **Quality ground truth**: Ensure accurate, complete expected answers
3. **Version datasets**: Track changes for reproducibility
4. **Validate regularly**: Check format and content integrity
5. **Balance difficulty**: Include easy, medium, and hard samples
