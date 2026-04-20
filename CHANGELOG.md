# Changelog

All notable changes to rag-eval-pack will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Four core RAG evaluation metrics: faithfulness, relevance, context precision, context recall
- LLM-as-judge engine with provider-agnostic support (Claude, GPT-4, Gemini)
- Judge calibration with temperature scaling and multi-judge consensus
- Cost tracking with per-sample, per-run, and budget enforcement
- CI regression gates: threshold gates and baseline comparison gates
- Three-layer MCP server architecture:
  - `rag_eval.judge.*` — Atomic operations for mid-task self-evaluation
  - `rag_eval.suite.*` — Orchestrated runs for eval-driven development
  - `rag_eval.gate.*` — CI-style pass/fail gates
- CLI tool with commands: evaluate, gate, compare, cost, report, judge, mcp-server
- Dataset management with JSONL, JSON, and YAML support
- Structured logging with PII redaction
- Docker support with multi-stage build
- GitHub Actions CI/CD workflows
- Comprehensive test suite with unit and integration tests
- Example datasets and configurations
- Agent skills documentation

### Changed
- Initial release

## [0.1.0] - 2026-04-16

### Added
- Initial release with core functionality
