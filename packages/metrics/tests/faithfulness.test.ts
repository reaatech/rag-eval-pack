import type { EvaluationSample } from '@reaatech/rag-eval-core';
import { FaithfulnessScorer } from '@reaatech/rag-eval-metrics';
import { describe, expect, it } from 'vitest';

function makeSample(overrides: Partial<EvaluationSample> = {}): EvaluationSample {
  return {
    query: 'test query',
    context: ['Refunds are processed within 14 days of purchase.'],
    ground_truth: 'Refunds within 14 days.',
    generated_answer: 'You can request a refund within 14 days.',
    ...overrides,
  };
}

describe('FaithfulnessScorer', () => {
  describe('score', () => {
    it('scores high when all statements are supported', async () => {
      const scorer = new FaithfulnessScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Refunds are processed within 14 days of purchase.'],
          generated_answer: 'Refunds are processed within 14 days.',
        }),
      );

      expect(result.score).toBe(1);
      expect(result.total_statements).toBe(1);
      expect(result.supported_count).toBe(1);
      expect(result.statement_support?.[0]?.supported).toBe(true);
    });

    it('scores low when no statements are supported', async () => {
      const scorer = new FaithfulnessScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Shipping takes 5-7 business days.'],
          generated_answer: 'Refunds take 30 days and require a phone call.',
        }),
      );

      expect(result.score).toBe(0);
      expect(result.supported_count).toBe(0);
    });

    it('scores partial when some statements are supported', async () => {
      const scorer = new FaithfulnessScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Refunds are processed within 14 days. Contact support.'],
          generated_answer: 'Refunds are processed within 14 days. You must call us.',
        }),
      );

      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(1);
      expect(result.statement_support?.some((s) => s.supported)).toBe(true);
      expect(result.statement_support?.some((s) => !s.supported)).toBe(true);
    });

    it('handles empty generated answer', async () => {
      const scorer = new FaithfulnessScorer();
      const result = await scorer.score(makeSample({ generated_answer: '' }));

      expect(result.score).toBe(0);
      expect(result.total_statements).toBe(0);
      expect(result.supported_count).toBe(0);
    });

    it('handles answer with no sentence punctuation', async () => {
      const scorer = new FaithfulnessScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Refunds within 14 days'],
          generated_answer: 'refunds within 14 days',
        }),
      );

      expect(result.total_statements).toBe(1);
      expect(result.score).toBe(1);
    });

    it('handles statement with no significant words', async () => {
      const scorer = new FaithfulnessScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Some content here.'],
          generated_answer: 'The is a it.',
        }),
      );

      expect(result.total_statements).toBe(1);
      expect(result.supported_count).toBe(0);
      expect(result.score).toBe(0);
    });

    it('scores exactly 1 when all statements have high keyword overlap', async () => {
      const scorer = new FaithfulnessScorer();
      const result = await scorer.score(
        makeSample({
          context: ['refund policy requires contacting support'],
          generated_answer: 'Refund policy requires contacting support.',
        }),
      );

      expect(result.score).toBe(1);
    });

    it('returns statement_support for every extracted statement', async () => {
      const scorer = new FaithfulnessScorer();
      const result = await scorer.score(
        makeSample({
          context: ['First policy. Second rule.'],
          generated_answer: 'First policy. Second rule.',
        }),
      );

      expect(result.statement_support).toHaveLength(result.total_statements);
    });

    it('rounds score to 3 decimal places', async () => {
      const scorer = new FaithfulnessScorer();
      const result = await scorer.score(
        makeSample({
          context: ['a b c d e f g h i j k l m n o p q r s t u v w x y z very long context'],
          generated_answer: 'Statement one. Statement two. Statement three. Statement four.',
        }),
      );

      const decimalPlaces = (result.score.toString().split('.')[1] ?? '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(3);
    });
  });

  describe('scoreBatch', () => {
    it('scores multiple samples', async () => {
      const scorer = new FaithfulnessScorer();
      const samples = [
        makeSample({
          context: ['Refunds within 14 days.'],
          generated_answer: 'Refunds within 14 days.',
        }),
        makeSample({
          context: ['Shipping takes 5-7 days.'],
          generated_answer: 'Weather is nice.',
        }),
      ];

      const results = await scorer.scoreBatch(samples);
      expect(results).toHaveLength(2);
      expect(results[0]?.score).toBeGreaterThanOrEqual(0);
      expect(results[1]?.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('generateExplanation', () => {
    it('explains when no statements exist', async () => {
      const scorer = new FaithfulnessScorer();
      const result = await scorer.score(makeSample({ generated_answer: '' }));

      expect(result.explanation).toBe('No statements to evaluate');
    });

    it('explains perfect score', async () => {
      const scorer = new FaithfulnessScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Refunds within 14 days.'],
          generated_answer: 'Refunds within 14 days.',
        }),
      );

      expect(result.explanation).toContain('All');
      expect(result.explanation).toContain('supported by the context');
    });

    it('explains zero score', async () => {
      const scorer = new FaithfulnessScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Shipping policy.'],
          generated_answer: 'Refund policy details.',
        }),
      );

      expect(result.explanation).toContain('None');
      expect(result.explanation).toContain('are supported');
    });

    it('explains partial score', async () => {
      const scorer = new FaithfulnessScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Refunds within 14 days. Other policies apply.'],
          generated_answer: 'Refunds within 14 days. Call for details.',
        }),
      );

      expect(result.explanation).toContain('of');
      expect(result.explanation).toContain('statements supported');
    });
  });

  describe('normalizeWord', () => {
    it('handles short words', async () => {
      const scorer = new FaithfulnessScorer();
      const result = await scorer.score(
        makeSample({
          context: ['cat dog'],
          generated_answer: 'cat dog.',
        }),
      );

      expect(result.total_statements).toBeGreaterThanOrEqual(0);
    });

    it('handles words ending with ing', async () => {
      const scorer = new FaithfulnessScorer();
      const result = await scorer.score(
        makeSample({
          context: ['processing running walking'],
          generated_answer: 'processing running walking.',
        }),
      );

      expect(result.score).toBe(1);
    });

    it('handles words ending with ed', async () => {
      const scorer = new FaithfulnessScorer();
      const result = await scorer.score(
        makeSample({
          context: ['processed called refunded'],
          generated_answer: 'processed called refunded.',
        }),
      );

      expect(result.score).toBe(1);
    });

    it('handles words ending with s (non-ss)', async () => {
      const scorer = new FaithfulnessScorer();
      const result = await scorer.score(
        makeSample({
          context: ['policies days refunds'],
          generated_answer: 'policies days refunds.',
        }),
      );

      expect(result.score).toBe(1);
    });
  });

  describe('extractStatements', () => {
    it('splits by multiple sentences', async () => {
      const scorer = new FaithfulnessScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Content for matching.'],
          generated_answer: 'First sentence. Second sentence! Third question?',
        }),
      );

      expect(result.total_statements).toBe(3);
    });

    it('trims whitespace from sentences', async () => {
      const scorer = new FaithfulnessScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Content for matching.'],
          generated_answer: '  First.   Second.  ',
        }),
      );

      expect(result.total_statements).toBe(2);
      expect(result.statements[0]).toBe('First.');
      expect(result.statements[1]).toBe('Second.');
    });
  });

  describe('checkStatementSupport', () => {
    it('detects verbatim match', async () => {
      const scorer = new FaithfulnessScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Exact text here.'],
          generated_answer: 'Exact text here.',
        }),
      );

      expect(result.supported_count).toBe(1);
      expect(result.statement_support?.[0]?.reasoning).toContain('verbatim');
    });

    it('detects keyword overlap below threshold', async () => {
      const scorer = new FaithfulnessScorer();
      const result = await scorer.score(
        makeSample({
          context: ['The quick brown fox jumps.'],
          generated_answer: 'Completely unrelated topic.',
        }),
      );

      expect(result.supported_count).toBe(0);
    });

    it('detects partial keyword overlap', async () => {
      const scorer = new FaithfulnessScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Refund policy requires customer support contact.'],
          generated_answer: 'Refund policy needs support.',
        }),
      );

      expect(result.score).toBe(1);
    });
  });
});
