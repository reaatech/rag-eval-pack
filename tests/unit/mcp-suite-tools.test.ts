import { describe, it, expect } from 'vitest';
import { handleSuiteTool } from '../../src/mcp-server/tools/suite/index.js';
import type { EvaluationSample, EvalSuiteConfig } from '../../src/types/domain.js';

describe('MCP Suite Tools', () => {
  const samples: EvaluationSample[] = [
    {
      query: 'What is the refund policy?',
      context: ['Refunds are processed within 14 days of purchase.'],
      ground_truth: 'Refunds are processed within 14 days of purchase.',
      generated_answer: 'Refunds are processed within 14 days of purchase.',
    },
  ];

  const config: EvalSuiteConfig = {
    metrics: ['faithfulness'],
    judge: { enabled: false },
  };

  it('should return results with the same run id reported at start', async () => {
    const runResponse = await handleSuiteTool('rag_eval.suite.run', { samples, config });
    const runData = JSON.parse(runResponse.content[0]!.text) as { run_id: string };

    let resultsPayload: Record<string, unknown> | null = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      const resultsResponse = await handleSuiteTool('rag_eval.suite.results', {
        run_id: runData.run_id,
      });
      const payload = JSON.parse(resultsResponse.content[0]!.text) as Record<string, unknown>;
      if (!('error' in payload)) {
        resultsPayload = payload;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    expect(resultsPayload).not.toBeNull();
    expect(resultsPayload?.run_id).toBe(runData.run_id);
  });
});
