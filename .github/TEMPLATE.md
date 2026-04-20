# Template Repository Configuration

This is a template repository for rag-eval-pack. To use this template:

1. Click "Use this template" on GitHub
2. Name your new repository
3. Update configuration:

```yaml
# In your .env file
ANTHROPIC_API_KEY=your-key-here
OPENAI_API_KEY=your-key-here
GOOGLE_API_KEY=your-key-here

# In datasets/your-dataset.jsonl
{"query": "...", "context": [...], "ground_truth": "...", "generated_answer": "..."}
```

## Quick Start

```bash
# Run evaluation
npx rag-eval-pack evaluate -d datasets/eval-samples.jsonl -c eval-config.yaml

# Run gates
npx rag-eval-pack gate -r results.json -g gates.yaml

# Start MCP server
npx rag-eval-pack mcp-server
```

## Customization

- Edit `datasets/examples/` to add your evaluation data
- Edit `gates.yaml` to set your quality thresholds
- Edit `eval-config.yaml` to configure metrics and judge models