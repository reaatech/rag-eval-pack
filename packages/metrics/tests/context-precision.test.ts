import type { EvaluationSample } from '@reaatech/rag-eval-core';
import { ContextPrecisionScorer } from '@reaatech/rag-eval-metrics';
import { describe, expect, it } from 'vitest';

function makeSample(overrides: Partial<EvaluationSample> = {}): EvaluationSample {
  return {
    query: 'What is the refund policy?',
    context: ['Refunds within 14 days.', 'Contact support for help.', 'Shipping takes 5-7 days.'],
    ground_truth: 'Refunds must be requested within 14 days.',
    generated_answer: '',
    ...overrides,
  };
}

describe('ContextPrecisionScorer', () => {
  describe('score', () => {
    it('scores high when relevant context is ranked first', async () => {
      const scorer = new ContextPrecisionScorer();
      const result = await scorer.score(
        makeSample({
          context: [
            'Refunds within 14 days.',
            'Contact support for help.',
            'Shipping takes 5-7 days.',
          ],
          ground_truth: 'Refunds must be requested within 14 days.',
        }),
      );

      expect(result.score).toBeGreaterThan(0);
      expect(result.map).toBeGreaterThan(0);
      expect(result.ndcg).toBeGreaterThan(0);
      expect(result.chunk_relevance_scores).toHaveLength(3);
    });

    it('scores 0 for empty context', async () => {
      const scorer = new ContextPrecisionScorer();
      const result = await scorer.score(makeSample({ context: [] }));

      expect(result.score).toBe(0);
      expect(result.map).toBe(0);
      expect(result.ndcg).toBe(0);
    });

    it('scores high when chunk contains ground truth verbatim', async () => {
      const scorer = new ContextPrecisionScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Refunds must be requested within 14 days.'],
          ground_truth: 'Refunds must be requested within 14 days.',
        }),
      );

      expect(result.chunk_relevance_scores[0]).toBe(1);
    });

    it('handles ground truth with no significant words', async () => {
      const scorer = new ContextPrecisionScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Some random content here.'],
          ground_truth: 'the is a it',
        }),
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('returns scores rounded to 3 decimal places', async () => {
      const scorer = new ContextPrecisionScorer();
      const result = await scorer.score(makeSample());

      const decimals = (s: number) => (s.toString().split('.')[1] ?? '').length;
      expect(decimals(result.score)).toBeLessThanOrEqual(3);
      expect(decimals(result.map)).toBeLessThanOrEqual(3);
      expect(decimals(result.ndcg)).toBeLessThanOrEqual(3);
    });
  });

  describe('scoreBatch', () => {
    it('scores multiple samples', async () => {
      const scorer = new ContextPrecisionScorer();
      const results = await scorer.scoreBatch([
        makeSample(),
        makeSample({ query: 'other', context: ['other context'], ground_truth: 'other' }),
      ]);

      expect(results).toHaveLength(2);
    });
  });

  describe('assessChunkRelevance', () => {
    it('scores based on ground truth word overlap and query overlap', async () => {
      const scorer = new ContextPrecisionScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Refunds policy support contact'],
          ground_truth: 'Refunds policy support contact',
        }),
      );

      expect(result.score).toBeGreaterThan(0);
    });

    it('scores low when context is unrelated to ground truth', async () => {
      const scorer = new ContextPrecisionScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Weather forecast sunny today.'],
          ground_truth: 'Refund policy requires contact.',
        }),
      );

      expect(result.score).toBeLessThan(0.5);
    });

    it('handles query with no significant words in assessChunkRelevance', async () => {
      const scorer = new ContextPrecisionScorer();
      const result = await scorer.score(
        makeSample({
          query: 'the is a',
          context: ['Weather today.'],
          ground_truth: 'Weather sunny.',
        }),
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('handles getWords returning null for text with no lowercase letters', async () => {
      const scorer = new ContextPrecisionScorer();
      const result = await scorer.score(
        makeSample({
          query: '123',
          context: ['456'],
          ground_truth: '789',
        }),
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateMAP', () => {
    it('returns 0 when no relevant documents', async () => {
      const scorer = new ContextPrecisionScorer();
      const result = await scorer.score(
        makeSample({
          context: ['First chunk.', 'Second chunk.'],
          ground_truth: 'Completely unrelated ground truth here.',
        }),
      );

      expect(result.map).toBe(0);
    });

    it('calculates perfect MAP when all relevant', async () => {
      const scorer = new ContextPrecisionScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Refunds must be requested within 14 days.'],
          ground_truth: 'Refunds must be requested within 14 days.',
        }),
      );

      expect(result.map).toBe(1);
    });

    it('handles varying relevance scores', async () => {
      const scorer = new ContextPrecisionScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Refunds within 14 days.', 'Weather is nice.', 'Policy requires contact.'],
          ground_truth: 'Refunds within 14 days by contacting support.',
        }),
      );

      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateNDCG', () => {
    it('returns 0 when IDCG is 0', async () => {
      const scorer = new ContextPrecisionScorer();
      const result = await scorer.score(
        makeSample({
          context: ['First chunk.', 'Second chunk.'],
          ground_truth: 'Completely unrelated.',
        }),
      );

      expect(result.ndcg).toBe(0);
    });

    it('calculates NDCG correctly for ideal ordering', async () => {
      const scorer = new ContextPrecisionScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Refunds must be requested within 14 days.'],
          ground_truth: 'Refunds must be requested within 14 days.',
        }),
      );

      expect(result.ndcg).toBe(1);
    });
  });

  describe('generateExplanation', () => {
    it('explains excellent ranking (score >= 0.8)', async () => {
      const scorer = new ContextPrecisionScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Refunds must be requested within 14 days.'],
          ground_truth: 'Refunds must be requested within 14 days.',
        }),
      );

      expect(result.explanation).toContain('Excellent');
      expect(result.score).toBeGreaterThanOrEqual(0.8);
    });

    it('explains good ranking (0.6 <= score < 0.8)', async () => {
      const scorer = new ContextPrecisionScorer();
      const result = await scorer.score(
        makeSample({
          context: [
            'Policy update available.',
            'Customer refund support contact',
            'Full refund policy details',
          ],
          ground_truth: 'Refund policy support contact.',
        }),
      );

      expect(result.explanation).toContain('Good');
      expect(result.score).toBeGreaterThanOrEqual(0.6);
      expect(result.score).toBeLessThan(0.8);
    });

    it('explains moderate ranking (0.4 <= score < 0.6)', async () => {
      const scorer = new ContextPrecisionScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Policy update.', 'Customer support.', 'Random stuff.'],
          ground_truth: 'Refund policy support.',
        }),
      );

      expect(result.explanation).toContain('Moderate');
      expect(result.score).toBeGreaterThanOrEqual(0.4);
      expect(result.score).toBeLessThan(0.6);
    });

    it('explains poor ranking (score < 0.4)', async () => {
      const scorer = new ContextPrecisionScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Weather sunny.', 'Traffic bad.'],
          ground_truth: 'Refunds within 14 days by contacting support.',
        }),
      );

      expect(result.explanation).toContain('Poor');
      expect(result.score).toBeLessThan(0.4);
    });
  });
});
