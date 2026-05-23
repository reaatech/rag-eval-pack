---
"@reaatech/rag-eval-cli": minor
"@reaatech/rag-eval-mcp-server": minor
"@reaatech/rag-eval-judge": minor
"@reaatech/rag-eval-core": patch
"@reaatech/rag-eval-metrics": patch
"@reaatech/rag-eval-cost": patch
"@reaatech/rag-eval-gate": patch
"@reaatech/rag-eval-dataset": patch
"@reaatech/rag-eval-suite": patch
"@reaatech/rag-eval-observability": patch
---

Prep packages for first npm publish.

- **cli**: add the `rag-eval-pack` executable bin.
- **mcp-server**: add the `rag-eval-mcp-server` executable bin via a dedicated entry that starts the stdio server reliably (the previous import-time self-exec guard broke under bundling).
- **judge**: move `@anthropic-ai/sdk`, `openai`, and `@google/generative-ai` to optional `peerDependencies` so consumers only install the provider they use; bump `@anthropic-ai/sdk` to 0.98.0.
- **all packages**: declare `engines.node >= 20` and `sideEffects: false`.
