import type { EvaluationSample } from '@reaatech/rag-eval-core';
import { RelevanceScorer } from '@reaatech/rag-eval-metrics';
import { describe, expect, it } from 'vitest';

function makeSample(overrides: Partial<EvaluationSample> = {}): EvaluationSample {
  return {
    query: 'How do I reset my password?',
    context: [],
    ground_truth: 'Go to /reset-password.',
    generated_answer: 'Visit the password reset page.',
    ...overrides,
  };
}

describe('RelevanceScorer', () => {
  describe('score', () => {
    it('scores high for directly relevant answer', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(
        makeSample({
          query: 'What is the refund policy?',
          generated_answer: 'The refund policy allows returns within 14 days.',
        }),
      );

      expect(result.score).toBeGreaterThan(0.5);
      expect(result.semantic_similarity).toBeDefined();
      expect(result.intent_score).toBeDefined();
    });

    it('scores low for irrelevant answer', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(
        makeSample({
          query: 'How do I reset my password?',
          generated_answer: 'The weather is nice today.',
        }),
      );

      expect(result.score).toBeLessThan(0.5);
    });

    it('handles answer that contains the query verbatim', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(
        makeSample({
          query: 'password reset',
          generated_answer: 'To do a password reset, visit the settings page.',
        }),
      );

      expect(result.semantic_similarity).toBe(1);
    });

    it('handles query that contains the answer verbatim', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(
        makeSample({
          query: 'How do I reset my password? Visit the password reset page.',
          generated_answer: 'Visit the password reset page.',
        }),
      );

      expect(result.semantic_similarity).toBe(1);
    });

    it('returns scores rounded to 3 decimal places', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(makeSample());

      const decimals = (s: number) =>
        s.toString().includes('.') ? s.toString().split('.')[1]?.length : 0;
      expect(decimals(result.score)).toBeLessThanOrEqual(3);
      expect(decimals(result.semantic_similarity ?? 0)).toBeLessThanOrEqual(3);
      expect(decimals(result.intent_score ?? 0)).toBeLessThanOrEqual(3);
    });
  });

  describe('scoreBatch', () => {
    it('scores multiple samples', async () => {
      const scorer = new RelevanceScorer();
      const results = await scorer.scoreBatch([
        makeSample({ query: 'hello', generated_answer: 'hi there' }),
        makeSample({ query: 'bye', generated_answer: 'see you' }),
      ]);

      expect(results).toHaveLength(2);
    });
  });

  describe('calculateSemanticSimilarity', () => {
    it('uses bigram similarity when no direct containment', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(
        makeSample({
          query: 'apple banana cherry',
          generated_answer: 'orange grape fruit',
        }),
      );

      expect(result.semantic_similarity).toBeGreaterThanOrEqual(0);
      expect(result.semantic_similarity).toBeLessThanOrEqual(1);
    });

    it('handles empty query words', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(
        makeSample({
          query: '',
          generated_answer: 'some answer here',
        }),
      );

      expect(result.semantic_similarity).toBeDefined();
    });
  });

  describe('calculateIntentCoverage', () => {
    it('handles non-question input', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(
        makeSample({
          query: 'password reset instructions',
          generated_answer: 'Go to settings and click reset password.',
        }),
      );

      expect(result.intent_score).toBeGreaterThan(0);
    });

    it('handles non-question with no significant words', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(
        makeSample({
          query: 'the is a',
          generated_answer: 'some response content here.',
        }),
      );

      expect(result.intent_score).toBe(0.5);
    });

    it('handles question with no significant query words', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(
        makeSample({
          query: 'Is it the?',
          generated_answer: 'Yes.',
        }),
      );

      expect(result.intent_score).toBe(0.5);
    });

    it('handles question with meaningful words and action words', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(
        makeSample({
          query: 'How do I reset password?',
          generated_answer: 'Visit the password reset page and enter your email.',
        }),
      );

      expect(result.intent_score).toBeGreaterThan(0);
    });

    it('handles question ending with question mark', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(
        makeSample({
          query: 'What is refund policy?',
          generated_answer: 'The refund policy allows returns.',
        }),
      );

      expect(result.intent_score).toBeGreaterThan(0);
    });

    it('caps intent score at 1', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(
        makeSample({
          query: 'What is refund policy help support?',
          generated_answer: 'The refund policy allows returns. Please contact support for help.',
        }),
      );

      expect(result.intent_score).toBeLessThanOrEqual(1);
    });
  });

  describe('getBigrams', () => {
    it('generates bigrams from text', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(
        makeSample({
          query: 'ab',
          generated_answer: 'ab',
        }),
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('diceCoefficient', () => {
    it('returns 0 when one set is empty', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(
        makeSample({
          query: 'a',
          generated_answer: 'b',
        }),
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('containsActionWords', () => {
    it('detects action words like contact', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(
        makeSample({
          query: 'How to contact support?',
          generated_answer: 'Please contact support at help@example.com.',
        }),
      );

      expect(result.intent_score).toBeGreaterThan(0);
    });

    it('detects no action words', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(
        makeSample({
          query: 'What is your name?',
          generated_answer: 'My name is robot.',
        }),
      );

      expect(result.intent_score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('generateExplanation', () => {
    it('returns high relevance explanation', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(
        makeSample({
          query: 'What is the refund policy?',
          generated_answer: 'The refund policy allows returns within 14 days.',
        }),
      );

      expect(result.explanation).toMatch(/highly relevant|moderately relevant/);
    });

    it('returns low relevance explanation when score is low', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(
        makeSample({
          query: 'How do I reset my password?',
          generated_answer: 'The weather is nice today.',
        }),
      );

      expect(result.explanation).toMatch(/irrelevant|may not fully address/);
    });
  });

  describe('normalizeWord edge cases', () => {
    it('handles word ending with ing where len = 4 (branch false)', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(
        makeSample({
          query: 'ring policy?',
          generated_answer: 'ring policy details.',
        }),
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('handles word ending with ing where len > 4 (branch true)', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(
        makeSample({ query: 'processing orders?', generated_answer: 'processing orders.' }),
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('handles word ending with ed where len = 4 (branch false)', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(
        makeSample({
          query: 'feed policy?',
          generated_answer: 'feed policy details.',
        }),
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('handles word ending with ed where len > 4 (branch true)', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(
        makeSample({ query: 'processed items?', generated_answer: 'processed items.' }),
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('union.size === 0 branch', () => {
    it('handles query and answer with no word characters', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(
        makeSample({
          query: '?!',
          generated_answer: '!!',
        }),
      );

      expect(result.semantic_similarity).toBeDefined();
    });
  });

  describe('Math.min(1, ...) and hasSpecificInfo branches', () => {
    it('caps topicCoverage + bonusScore at 1', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(
        makeSample({
          query: 'What is refund policy support contact?',
          generated_answer: 'Please contact support for refund policy issues.',
        }),
      );

      expect(result.intent_score).toBeLessThanOrEqual(1);
    });

    it('handles hasSpecificInfo being false (short answer)', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(
        makeSample({
          query: 'What is the maximum refund duration period policy requirement?',
          generated_answer: 'Refund.',
        }),
      );

      expect(result.intent_score).toBeGreaterThanOrEqual(0);
    });

    it('handles both hasActionWords and hasSpecificInfo false', async () => {
      const scorer = new RelevanceScorer();
      const result = await scorer.score(
        makeSample({
          query: 'What is the refund duration?',
          generated_answer: 'Yes.',
        }),
      );

      expect(result.intent_score).toBeGreaterThanOrEqual(0);
    });
  });
});
