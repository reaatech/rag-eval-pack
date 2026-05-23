---
"@reaatech/rag-eval-core": minor
"@reaatech/rag-eval-metrics": minor
"@reaatech/rag-eval-judge": minor
"@reaatech/rag-eval-gate": minor
"@reaatech/rag-eval-cli": patch
---

Enhance metric honesty, judge flexibility, and gate robustness ahead of first publish.

- **metrics**: extract the duplicated stop-word/stemmer/tokenizer logic into a shared `text-utils` module and drop the unused `compromise` and `natural` dependencies.
- **metrics/core**: rename the relevance scorer's lexical output to `lexical_similarity` (it was misleadingly called `semantic_similarity`). `semantic_similarity` is now only populated when an `EmbeddingProvider` is supplied, enabling true (paraphrase-aware) semantic scoring on `RelevanceScorer` and the new `AnswerCorrectnessScorer`.
- **metrics/core**: add `RetrievalScorer` (MRR, nDCG, precision/recall/hit@k from `retrieved_chunk_ids` vs. `relevant_chunk_ids`) and `AnswerCorrectnessScorer` (generated answer vs. ground truth).
- **judge/core**: support explicit `provider`, `base_url`, and `api_key` in `JudgeConfig` so OpenAI-compatible gateways, proxies, and self-hosted/local models work without relying on model-name keyword inference.
- **judge**: confidence is now the judge's self-reported certainty (parsed from the response) or, for consensus, derived from inter-judge agreement — instead of the previous circular distance-from-0.5 heuristic.
- **gate/core**: baseline-comparison gates gain a `tolerance` band so sampling noise doesn't trip CI, and all gates gain a `warn` vs. `fail` `severity`. `GateResult` now carries a `warnings` array; CI reports surface warnings without failing the build.
