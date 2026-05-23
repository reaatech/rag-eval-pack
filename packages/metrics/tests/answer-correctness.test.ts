import type { EmbeddingProvider, EvaluationSample } from '@reaatech/rag-eval-core';
import { AnswerCorrectnessScorer } from '@reaatech/rag-eval-metrics';
import { describe, expect, it } from 'vitest';

function makeSample(overrides: Partial<EvaluationSample> = {}): EvaluationSample {
  return {
    query: 'What is the refund window?',
    context: ['c'],
    ground_truth: 'Refunds are available within 14 days of purchase.',
    generated_answer: 'You can get a refund within 14 days of purchase.',
    ...overrides,
  };
}

describe('AnswerCorrectnessScorer', () => {
  it('scores high when the answer matches the ground truth', async () => {
    const scorer = new AnswerCorrectnessScorer();
    const result = await scorer.score(makeSample());
    expect(result.score).toBeGreaterThan(0.5);
    expect(result.lexical_similarity).toBeDefined();
    expect(result.semantic_similarity).toBeUndefined();
  });

  it('scores low when the answer diverges from the ground truth', async () => {
    const scorer = new AnswerCorrectnessScorer();
    const result = await scorer.score(
      makeSample({ generated_answer: 'The store opens at 9am on weekdays.' }),
    );
    expect(result.score).toBeLessThan(0.5);
  });

  it('uses an embedding provider for semantic similarity when supplied', async () => {
    const identity: EmbeddingProvider = {
      embed: async (texts) => texts.map(() => [1, 0, 0]),
    };
    const scorer = new AnswerCorrectnessScorer({ embeddingProvider: identity });
    const result = await scorer.score(
      makeSample({ generated_answer: 'totally different surface text' }),
    );
    // Identical vectors → cosine 1, so semantic dominates the lexical mismatch.
    expect(result.semantic_similarity).toBe(1);
    expect(result.score).toBe(1);
  });

  it('scores a batch', async () => {
    const scorer = new AnswerCorrectnessScorer();
    const results = await scorer.scoreBatch([makeSample(), makeSample()]);
    expect(results).toHaveLength(2);
  });
});
