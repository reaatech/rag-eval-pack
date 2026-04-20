import { describe, it, expect } from 'vitest';
import { EvaluationSuite } from '../../src/evaluation-suite.js';
import type { EvalSuiteConfig, EvaluationSample } from '../../src/types/domain.js';

describe('EvaluationSuite', () => {
  const sample: EvaluationSample = {
    query: 'What is the refund policy?',
    context: ['Refunds are processed within 14 days of purchase.'],
    ground_truth: 'Refunds are processed within 14 days of purchase.',
    generated_answer: 'Refunds are processed within 14 days of purchase.',
  };

  it('should not double-count judge costs in total cost', async () => {
    const repeatedText = 'token '.repeat(100000);
    const suite = new EvaluationSuite({
      metrics: ['faithfulness'],
      judge: { model: 'gpt-4o' },
      cost: { budget_limit: 20 },
    });

    const result = await suite.run([
      {
        ...sample,
        query: repeatedText,
        context: [repeatedText],
        generated_answer: repeatedText,
      },
    ]);

    expect(result.results.total_cost).toBe(result.results.cost_breakdown.total);
    expect(result.results.metrics.cost_per_sample).toBe(result.results.total_cost);
  });

  it('should honor a provided run id', async () => {
    const suite = new EvaluationSuite({ metrics: ['faithfulness'] });

    const result = await suite.run([sample], 'eval-custom-id');

    expect(result.run_id).toBe('eval-custom-id');
    expect(result.results.run_id).toBe('eval-custom-id');
  });
});
