import type { EvaluationSample, JudgeConfig } from '@reaatech/rag-eval-core';
import { JudgeEngine } from '@reaatech/rag-eval-judge';
import { JudgeCalibrator } from '@reaatech/rag-eval-judge';
import { JudgeCostTracker } from '@reaatech/rag-eval-judge';
import { describe, expect, it, vi } from 'vitest';

describe('JudgeEngine', () => {
  const sampleData: EvaluationSample = {
    query: 'What is the refund policy?',
    context: ['Refunds are processed within 14 days of purchase.'],
    ground_truth: 'Refunds must be requested within 14 days.',
    generated_answer: 'You can request a refund within 14 days.',
  };

  const defaultConfig: JudgeConfig = {
    model: 'claude-opus',
    enabled: false, // Disable actual API calls
  };

  describe('constructor', () => {
    it('should create judge engine with config', () => {
      const engine = new JudgeEngine(defaultConfig);
      expect(engine).toBeDefined();
    });

    it('should work without model specified', () => {
      const engine = new JudgeEngine({});
      expect(engine).toBeDefined();
    });
  });

  describe('evaluate', () => {
    it('should evaluate faithfulness metric', async () => {
      const engine = new JudgeEngine(defaultConfig);
      const result = await engine.evaluate(sampleData, 'faithfulness');

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.metric).toBe('faithfulness');
    });

    it('should evaluate relevance metric', async () => {
      const engine = new JudgeEngine(defaultConfig);
      const result = await engine.evaluate(sampleData, 'relevance');

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.metric).toBe('relevance');
    });

    it('should evaluate context_precision metric', async () => {
      const engine = new JudgeEngine(defaultConfig);
      const result = await engine.evaluate(sampleData, 'context_precision');

      expect(result).toBeDefined();
      expect(result.metric).toBe('context_precision');
    });

    it('should evaluate context_recall metric', async () => {
      const engine = new JudgeEngine(defaultConfig);
      const result = await engine.evaluate(sampleData, 'context_recall');

      expect(result).toBeDefined();
      expect(result.metric).toBe('context_recall');
    });

    it('should evaluate overall metric', async () => {
      const engine = new JudgeEngine(defaultConfig);
      const result = await engine.evaluate(sampleData, 'overall');

      expect(result).toBeDefined();
      expect(result.metric).toBe('overall');
    });

    it('should return mock score when no API key available', async () => {
      const config: JudgeConfig = {
        model: 'claude-opus',
      };
      // Without API key, it falls back to mock response
      const engine = new JudgeEngine(config);
      const result = await engine.evaluate(sampleData, 'faithfulness');

      // Mock returns a score between 0 and 1
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.metric).toBe('faithfulness');
    });

    it('should resolve provider credentials from the target model', async () => {
      const previousAnthropicKey = process.env.ANTHROPIC_API_KEY;
      const previousOpenAIKey = process.env.OPENAI_API_KEY;

      process.env.ANTHROPIC_API_KEY = undefined;
      process.env.OPENAI_API_KEY = 'openai-test-key';

      try {
        const engine = new JudgeEngine({ model: 'claude-opus' });
        const openAIMock = vi
          .spyOn(engine as never, 'callOpenAI' as never)
          .mockResolvedValue('Score: 0.90\nExplanation: OpenAI path used.');

        const result = await engine.evaluate(sampleData, 'faithfulness', 'gpt-4o');

        expect(openAIMock).toHaveBeenCalledOnce();
        expect(result.provider).toBe('openai');
        expect(result.model).toBe('gpt-4o');
        expect(result.score).toBe(0.9);
      } finally {
        if (previousAnthropicKey === undefined) {
          process.env.ANTHROPIC_API_KEY = undefined;
        } else {
          process.env.ANTHROPIC_API_KEY = previousAnthropicKey;
        }

        if (previousOpenAIKey === undefined) {
          process.env.OPENAI_API_KEY = undefined;
        } else {
          process.env.OPENAI_API_KEY = previousOpenAIKey;
        }
      }
    });
  });

  describe('evaluateWithConsensus', () => {
    it('should fall back to single evaluation when consensus disabled', async () => {
      const engine = new JudgeEngine(defaultConfig);
      const result = await engine.evaluateWithConsensus(sampleData, 'faithfulness');

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should use consensus when enabled with weighted voting', async () => {
      const config: JudgeConfig = {
        model: 'claude-opus',
        consensus: {
          enabled: true,
          models: [
            { id: 'claude-opus', weight: 0.5 },
            { id: 'gpt-4', weight: 0.3 },
          ],
          voting_strategy: 'weighted',
        },
      };
      const engine = new JudgeEngine(config);
      const result = await engine.evaluateWithConsensus(sampleData, 'faithfulness');

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should use majority voting strategy', async () => {
      const config: JudgeConfig = {
        model: 'claude-opus',
        consensus: {
          enabled: true,
          models: [{ id: 'claude-opus' }],
          voting_strategy: 'majority',
        },
      };
      const engine = new JudgeEngine(config);
      const result = await engine.evaluateWithConsensus(sampleData, 'faithfulness');

      expect(result).toBeDefined();
    });

    it('should use unanimous voting strategy', async () => {
      const config: JudgeConfig = {
        model: 'claude-opus',
        consensus: {
          enabled: true,
          models: [{ id: 'claude-opus' }],
          voting_strategy: 'unanimous',
        },
      };
      const engine = new JudgeEngine(config);
      const result = await engine.evaluateWithConsensus(sampleData, 'faithfulness');

      expect(result).toBeDefined();
    });
  });

  describe('evaluateBatch', () => {
    it('should evaluate multiple samples', async () => {
      const engine = new JudgeEngine(defaultConfig);
      const samples: EvaluationSample[] = [sampleData, sampleData];

      const results = await engine.evaluateBatch(samples, 'faithfulness');

      expect(results).toHaveLength(2);
      expect(results[0]?.score).toBeGreaterThanOrEqual(0);
    });

    it('should evaluate batch with consensus', async () => {
      const config: JudgeConfig = {
        model: 'claude-opus',
        consensus: {
          enabled: true,
          models: [{ id: 'claude-opus' }],
          voting_strategy: 'weighted',
        },
      };
      const engine = new JudgeEngine(config);
      const samples: EvaluationSample[] = [sampleData];

      const results = await engine.evaluateBatch(samples, 'faithfulness', true);

      expect(results).toHaveLength(1);
    });
  });
});

describe('JudgeCalibrator', () => {
  describe('constructor', () => {
    it('should create calibrator with default method', () => {
      const calibrator = new JudgeCalibrator();
      expect(calibrator).toBeDefined();
      expect(calibrator.isTrained()).toBe(false);
    });

    it('should create calibrator with specified method', () => {
      const calibrator = new JudgeCalibrator({ method: 'isotonic_regression' });
      expect(calibrator).toBeDefined();
      expect(calibrator.getMethod()).toBe('isotonic_regression');
    });
  });

  describe('addDataPoint', () => {
    it('should add calibration data points', () => {
      const calibrator = new JudgeCalibrator();
      calibrator.addDataPoint(0.7, 0.8);
      calibrator.addDataPoint(0.5, 0.6);

      expect(calibrator.isTrained()).toBe(false);
    });
  });

  describe('loadData', () => {
    it('should load calibration data from array', () => {
      const calibrator = new JudgeCalibrator();
      calibrator.loadData([
        { rawScore: 0.7, humanScore: 0.8 },
        { rawScore: 0.5, humanScore: 0.6 },
      ]);

      expect(calibrator.isTrained()).toBe(false);
    });
  });

  describe('train', () => {
    it('should train with temperature scaling', async () => {
      const calibrator = new JudgeCalibrator({ method: 'temperature_scaling' });
      calibrator.loadData([
        { rawScore: 0.7, humanScore: 0.75 },
        { rawScore: 0.5, humanScore: 0.55 },
        { rawScore: 0.3, humanScore: 0.35 },
      ]);

      await calibrator.train();

      expect(calibrator.isTrained()).toBe(true);
    });

    it('should train with isotonic regression', async () => {
      const calibrator = new JudgeCalibrator({ method: 'isotonic_regression' });
      calibrator.loadData([
        { rawScore: 0.7, humanScore: 0.75 },
        { rawScore: 0.5, humanScore: 0.55 },
      ]);

      await calibrator.train();

      expect(calibrator.isTrained()).toBe(true);
    });

    it('should throw when no data available', async () => {
      const calibrator = new JudgeCalibrator();

      await expect(calibrator.train()).rejects.toThrow('No calibration data available');
    });
  });

  describe('apply', () => {
    it('should apply calibration to raw score', async () => {
      const calibrator = new JudgeCalibrator({ method: 'temperature_scaling' });
      calibrator.loadData([
        { rawScore: 0.8, humanScore: 0.85 },
        { rawScore: 0.6, humanScore: 0.65 },
      ]);

      await calibrator.train();

      const calibrated = calibrator.apply(0.7);
      expect(calibrated).toBeGreaterThanOrEqual(0);
      expect(calibrated).toBeLessThanOrEqual(1);
    });

    it('should return raw score when not trained', () => {
      const calibrator = new JudgeCalibrator();
      const result = calibrator.apply(0.7);
      expect(result).toBe(0.7);
    });

    it('should throw when apply called without training and data available', async () => {
      const calibrator = new JudgeCalibrator();
      calibrator.addDataPoint(0.7, 0.8);

      // The error is thrown synchronously
      expect(() => calibrator.apply(0.7)).toThrow('Calibrator must be trained');
    });

    it('should use isotonic regression for calibration', async () => {
      const calibrator = new JudgeCalibrator({ method: 'isotonic_regression' });
      calibrator.loadData([
        { rawScore: 0.3, humanScore: 0.35 },
        { rawScore: 0.5, humanScore: 0.55 },
        { rawScore: 0.7, humanScore: 0.75 },
      ]);

      await calibrator.train();

      const calibrated = calibrator.apply(0.5);
      expect(calibrated).toBeGreaterThanOrEqual(0);
      expect(calibrated).toBeLessThanOrEqual(1);
    });
  });

  describe('getMetrics', () => {
    it('should return zero metrics when not trained', () => {
      const calibrator = new JudgeCalibrator();
      const metrics = calibrator.getMetrics();

      expect(metrics.meanAbsoluteError).toBe(0);
      expect(metrics.rootMeanSquareError).toBe(0);
    });

    it('should return metrics after training', async () => {
      const calibrator = new JudgeCalibrator({ method: 'temperature_scaling' });
      calibrator.loadData([
        { rawScore: 0.8, humanScore: 0.85 },
        { rawScore: 0.6, humanScore: 0.65 },
      ]);

      await calibrator.train();

      const metrics = calibrator.getMetrics();
      expect(metrics.meanAbsoluteError).toBeGreaterThanOrEqual(0);
      expect(metrics.rootMeanSquareError).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('JudgeCostTracker', () => {
  describe('constructor', () => {
    it('should create cost tracker', () => {
      const tracker = new JudgeCostTracker({});
      expect(tracker).toBeDefined();
    });

    it('should create cost tracker with budget limit', () => {
      const tracker = new JudgeCostTracker({ budgetLimit: 10.0 });
      expect(tracker).toBeDefined();
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost for claude-opus', () => {
      const tracker = new JudgeCostTracker({});
      const estimate = tracker.estimateCost('claude-opus', 'anthropic', 'test input text');

      expect(estimate.cost).toBeGreaterThanOrEqual(0);
      expect(estimate.tokens.input).toBeGreaterThan(0);
    });

    it('should estimate cost for gpt-4', () => {
      const tracker = new JudgeCostTracker({});
      const estimate = tracker.estimateCost('gpt-4', 'openai', 'test input text');

      expect(estimate.cost).toBeGreaterThanOrEqual(0);
    });

    it('should estimate cost for gemini', () => {
      const tracker = new JudgeCostTracker({});
      const estimate = tracker.estimateCost('gemini-pro', 'google', 'test input text');

      expect(estimate.cost).toBeGreaterThanOrEqual(0);
    });

    it('should handle unknown model', () => {
      const tracker = new JudgeCostTracker({});
      const estimate = tracker.estimateCost('unknown-model', 'mock', 'test input text');

      expect(estimate.cost).toBe(0);
    });
  });

  describe('recordCost', () => {
    it('should record cost for a judgment', () => {
      const tracker = new JudgeCostTracker({});
      tracker.recordCost(1, 'claude-opus', 'anthropic', 100, 50, 'faithfulness');

      expect(tracker.getTotalCost()).toBeGreaterThan(0);
    });

    it('should track costs by sample', () => {
      const tracker = new JudgeCostTracker({});
      tracker.recordCost(1, 'claude-opus', 'anthropic', 100, 50, 'faithfulness');
      tracker.recordCost(2, 'gpt-4', 'openai', 80, 40, 'relevance');

      expect(tracker.getTotalCost()).toBeGreaterThan(0);
    });
  });

  describe('budget tracking', () => {
    it('should track budget usage', () => {
      const tracker = new JudgeCostTracker({ budgetLimit: 1.0 });
      tracker.recordCost(1, 'claude-opus', 'anthropic', 1000, 500, 'faithfulness');

      expect(tracker.getBudgetUsage()).toBeGreaterThanOrEqual(0);
    });

    it('should check if within budget', () => {
      const tracker = new JudgeCostTracker({ budgetLimit: 100.0 });
      tracker.recordCost(1, 'claude-opus', 'anthropic', 100, 50, 'faithfulness');

      expect(tracker.isWithinBudget()).toBe(true);
    });

    it('should exceed budget when limit is low', () => {
      const tracker = new JudgeCostTracker({ budgetLimit: 0.001 });
      tracker.recordCost(1, 'claude-opus', 'anthropic', 10000, 5000, 'faithfulness');

      expect(tracker.isWithinBudget()).toBe(false);
    });
  });

  describe('getBreakdown', () => {
    it('should return cost breakdown', () => {
      const tracker = new JudgeCostTracker({});
      tracker.recordCost(1, 'claude-opus', 'anthropic', 100, 50, 'faithfulness');

      const breakdown = tracker.getBreakdown();
      expect(breakdown).toBeDefined();
    });
  });

  describe('alerts', () => {
    it('should track alert thresholds', () => {
      const tracker = new JudgeCostTracker({
        budgetLimit: 10.0,
        alertThresholds: [0.5, 0.75, 0.9],
      });

      // Record some costs
      tracker.recordCost(1, 'claude-opus', 'anthropic', 5000, 2500, 'faithfulness');

      // Check that budget usage is tracked
      const usage = tracker.getBudgetUsage();
      expect(usage).toBeGreaterThanOrEqual(0);
    });
  });
});
