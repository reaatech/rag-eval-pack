# Contributing to rag-eval-pack

Thank you for your interest in contributing to rag-eval-pack.

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Use Node 22: `nvm use` (or ensure .nvmrc is activated)
4. Run tests: `npm test`
5. Run typecheck: `npm run typecheck`
6. Run lint: `npm run lint`

## Project Structure

- `src/` — TypeScript source code
  - `metrics/` — RAG evaluation metric implementations
  - `judge/` — LLM-as-judge engine
  - `cost/` — Cost tracking and budget management
  - `gate/` — CI regression gates
  - `dataset/` — Dataset loading and validation
  - `mcp-server/` — MCP server implementation
  - `observability/` — Logging, tracing, metrics
- `tests/` — Unit and integration tests
- `skills/` — Agent skill documentation

## Adding New Metrics

1. Create a new file in `src/metrics/` (e.g., `new-metric.ts`)
2. Implement the scorer class with a `score(sample: EvaluationSample)` method
3. Export from `src/metrics/index.ts`
4. Add unit tests in `tests/unit/metrics.test.ts`

## Adding New Judge Prompts

1. Add prompt templates to `src/judge/prompts.ts`
2. Follow the existing pattern for `FAITHFULNESS_PROMPT`, `RELEVANCE_PROMPT`, etc.
3. Use `applyPromptTemplate()` to render prompts with variables

## Code Style

- Use TypeScript with strict mode
- Use single quotes for strings
- Use 2-space indentation
- Add trailing commas
- Run `npm run prettier:fix` before committing

## Commit Messages

Follow conventional commits format:
- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation
- `test:` — Tests
- `refactor:` — Code refactoring

## Pull Requests

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Ensure all tests pass: `npm test`
5. Ensure typecheck passes: `npm run typecheck`
6. Submit a pull request

## Reporting Issues

When reporting issues, include:
- rag-eval-pack version
- Node.js version
- Operating system
- Steps to reproduce
- Expected vs actual behavior

## License

By contributing, you agree that your contributions will be licensed under the MIT License.