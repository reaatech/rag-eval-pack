import { describe, it, expect } from 'vitest';
import { EvalSuiteConfigSchema } from '../../src/types/schemas.js';

describe('Schemas', () => {
  it('should retain supported judge and gate configuration fields', () => {
    const parsed = EvalSuiteConfigSchema.parse({
      metrics: ['faithfulness'],
      judge: {
        enabled: false,
        cost: {
          budget_limit: 5,
          max_per_judgment: 0.25,
          alert_thresholds: [0.5],
        },
      },
      gates: [
        {
          name: 'min-faithfulness',
          type: 'threshold',
          metric: 'avg_faithfulness',
          operator: '>=',
          threshold: 0.85,
        },
      ],
    });

    expect(parsed.judge?.enabled).toBe(false);
    expect(parsed.judge?.cost?.budget_limit).toBe(5);
    expect(parsed.gates).toHaveLength(1);
  });
});
