# @reaatech/rag-eval-dataset

[![npm version](https://img.shields.io/npm/v/@reaatech/rag-eval-dataset.svg)](https://www.npmjs.com/package/@reaatech/rag-eval-dataset)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/rag-eval-pack/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/rag-eval-pack/ci.yml?branch=main&label=CI)](https://github.com/reaatech/rag-eval-pack/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Dataset management utilities for RAG evaluation. Loads evaluation samples from JSONL, JSON, and YAML files; validates samples against Zod schemas; generates synthetic datasets from templates; and tracks dataset versioning.

## Installation

```bash
npm install @reaatech/rag-eval-dataset
# or
pnpm add @reaatech/rag-eval-dataset
```

## Feature Overview

- **Multi-format loading** — read evaluation samples from JSONL, JSON array, and YAML files
- **Schema validation** — validate every sample against `EvaluationSampleSchema` with detailed error reporting
- **Duplicate detection** — identify duplicate queries and context sets across samples
- **Synthetic generation** — generate evaluation datasets from templates with configurable difficulty
- **Version tracking** — maintain dataset changelogs and version identifiers
- **Config loading** — load evaluation suite configurations from YAML or JSON files

## Quick Start

```typescript
import { DatasetLoader, DatasetValidator } from "@reaatech/rag-eval-dataset";

const loader = new DatasetLoader();

// Load samples from any supported format
const samples = await loader.load("datasets/eval-samples.jsonl");
console.log(`Loaded ${samples.length} samples`);

// Validate the dataset
const validator = new DatasetValidator();
const result = validator.validate(samples);

if (!result.valid) {
  for (const error of result.errors) {
    console.error(`[${error.field}] ${error.message}`);
  }
}
```

## API Reference

### `DatasetLoader`

Loads evaluation datasets from files or strings.

```typescript
import { DatasetLoader } from "@reaatech/rag-eval-dataset";

const loader = new DatasetLoader();
```

#### Loading Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `load(path: string)` | `Promise<EvaluationSample[]>` | Auto-detect format from file extension and load |
| `loadFromString(content, format)` | `Promise<EvaluationSample[]>` | Parse content string in specified format (`"jsonl" \| "json"`) |

#### Supported Formats

| Format | Extension | Structure |
|--------|-----------|-----------|
| JSONL | `.jsonl` | One JSON object per line |
| JSON | `.json` | Array of sample objects |
| YAML | `.yaml`, `.yml` | Array of sample objects |

Each sample is validated against `EvaluationSampleSchema` from `@reaatech/rag-eval-core`. Invalid lines in JSONL files are skipped with a warning.

#### Config Loading

```typescript
import { loadEvalConfig } from "@reaatech/rag-eval-dataset";

const config = await loadEvalConfig("eval-config.yaml");
// → EvalSuiteConfig with metrics, judge, cost, gates, execution
```

| Export | Description |
|--------|-------------|
| `loadEvalConfig(path)` | Load and validate an `EvalSuiteConfig` from YAML or JSON |

### `DatasetValidator`

Validates datasets for structural correctness and quality issues.

```typescript
import { DatasetValidator } from "@reaatech/rag-eval-dataset";

const validator = new DatasetValidator();
const result = validator.validate(samples);
```

#### `ValidationResult`

| Property | Type | Description |
|----------|------|-------------|
| `valid` | `boolean` | Whether the dataset passed all checks |
| `errors` | `ValidationError[]` | Errors found (empty if valid) |
| `warnings` | `ValidationWarning[]` | Non-blocking warnings |

#### `ValidationError`

| Property | Type | Description |
|----------|------|-------------|
| `field` | `string` | Field name or sample index |
| `message` | `string` | Human-readable error description |

#### Validations Performed

- **Schema compliance** — every sample matches `EvaluationSampleSchema`
- **Required fields** — `query`, `context`, `ground_truth`, `generated_answer`
- **Non-empty context** — context arrays must contain at least one chunk
- **Non-empty dataset** — dataset must contain at least one sample
- **Duplicate detection** — identical queries with matching context triggers a warning

### `DatasetGenerator`

Generates synthetic evaluation datasets from templates.

```typescript
import { DatasetGenerator } from "@reaatech/rag-eval-dataset";

const generator = new DatasetGenerator();
const samples = generator.generate({
  templates: myTemplates,
  count: 100,
  difficulty: "medium",
  domain: "customer-support",
});
```

#### `GeneratorConfig`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `templates` | `DatasetTemplate[]` | (required) | Templates for sample generation |
| `count` | `number` | `10` | Number of samples to generate |
| `difficulty` | `"easy" \| "medium" \| "hard"` | `"medium"` | Difficulty level |
| `domain` | `string` | — | Domain label for metadata |

### `DatasetVersioning`

Tracks dataset version history and changelogs.

```typescript
import { DatasetVersioning } from "@reaatech/rag-eval-dataset";

const versioning = new DatasetVersioning();

// Record a new version
versioning.addVersion({
  version: "v1.1.0",
  description: "Added 50 new e-commerce samples",
  timestamp: new Date().toISOString(),
});

// Get version history
const history = versioning.getHistory();
```

## Usage Patterns

### Loading and Validating a Dataset

```typescript
import { DatasetLoader, DatasetValidator } from "@reaatech/rag-eval-dataset";

const loader = new DatasetLoader();
const validator = new DatasetValidator();

try {
  const samples = await loader.load("eval-dataset.jsonl");
  const result = validator.validate(samples);

  if (!result.valid) {
    console.error("Dataset validation failed:");
    for (const error of result.errors) {
      console.error(`  - ${error.message}`);
    }
    process.exit(1);
  }

  console.log(`Ready to evaluate ${samples.length} samples`);
} catch (err) {
  console.error("Failed to load dataset:", err);
  process.exit(1);
}
```

### Loading Config from YAML

```yaml
# eval-config.yaml
metrics:
  - faithfulness
  - relevance
  - context_precision
  - context_recall

judge:
  model: claude-opus
  enabled: true

cost:
  budget_limit: 10.00

gates:
  - name: min-faithfulness
    type: threshold
    metric: avg_faithfulness
    operator: ">="
    threshold: 0.85
```

```typescript
import { loadEvalConfig } from "@reaatech/rag-eval-dataset";

const config = await loadEvalConfig("eval-config.yaml");
```

## Related Packages

- [`@reaatech/rag-eval-core`](https://www.npmjs.com/package/@reaatech/rag-eval-core) — Types and schemas
- [`@reaatech/rag-eval-suite`](https://www.npmjs.com/package/@reaatech/rag-eval-suite) — Central orchestrator
- [`@reaatech/rag-eval-cli`](https://www.npmjs.com/package/@reaatech/rag-eval-cli) — CLI with `evaluate` command

## License

[MIT](https://github.com/reaatech/rag-eval-pack/blob/main/LICENSE)
