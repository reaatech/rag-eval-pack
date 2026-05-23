import type { EvaluationSample } from '@reaatech/rag-eval-core';
import { ContextRecallScorer } from '@reaatech/rag-eval-metrics';
import { describe, expect, it } from 'vitest';

function makeSample(overrides: Partial<EvaluationSample> = {}): EvaluationSample {
  return {
    query: 'What is the refund policy?',
    context: [
      'Refunds are processed within 14 days of purchase.',
      'Contact support@example.com for refund requests.',
    ],
    ground_truth: 'Refunds must be requested within 14 days by contacting support.',
    generated_answer: '',
    ...overrides,
  };
}

describe('ContextRecallScorer', () => {
  describe('score', () => {
    it('scores high when context covers ground truth', async () => {
      const scorer = new ContextRecallScorer();
      const result = await scorer.score(
        makeSample({
          context: [
            'Refunds are processed within 14 days of purchase.',
            'Contact support@example.com for refund requests.',
          ],
          ground_truth: 'Refunds must be requested within 14 days by contacting support.',
        }),
      );

      expect(result.score).toBeGreaterThan(0);
      expect(result.total_facts).toBeGreaterThan(0);
      expect(result.covered_facts).toBeGreaterThan(0);
    });

    it('scores low when context misses ground truth', async () => {
      const scorer = new ContextRecallScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Shipping takes 5-7 days.'],
          ground_truth: 'Refunds within 14 days by contacting support.',
        }),
      );

      expect(result.score).toBe(0);
      expect(result.covered_facts).toBe(0);
    });

    it('scores 0 for empty context', async () => {
      const scorer = new ContextRecallScorer();
      const result = await scorer.score(makeSample({ context: [] }));

      expect(result.score).toBe(0);
    });

    it('scores 1 when all facts are covered verbatim', async () => {
      const scorer = new ContextRecallScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Refunds must be requested within 14 days by contacting support.'],
          ground_truth: 'Refunds must be requested within 14 days by contacting support.',
        }),
      );

      expect(result.score).toBe(1);
      expect(result.covered_facts).toBe(result.total_facts);
    });

    it('handles ground truth with no extractable facts', async () => {
      const scorer = new ContextRecallScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Some content.'],
          ground_truth: '',
        }),
      );

      expect(result.score).toBe(0);
      expect(result.total_facts).toBe(0);
    });

    it('returns facts array with coverage info', async () => {
      const scorer = new ContextRecallScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Refunds are processed within 14 days.'],
          ground_truth: 'Refunds are processed within 14 days. Contact support.',
        }),
      );

      expect(result.facts).toBeDefined();
      expect(result.facts?.length).toBe(result.total_facts);
    });
  });

  describe('scoreBatch', () => {
    it('scores multiple samples', async () => {
      const scorer = new ContextRecallScorer();
      const results = await scorer.scoreBatch([
        makeSample(),
        makeSample({ context: ['other'], ground_truth: 'other' }),
      ]);

      expect(results).toHaveLength(2);
    });
  });

  describe('extractFacts', () => {
    it('extracts facts from multiple sentences', async () => {
      const scorer = new ContextRecallScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Content coverage here.'],
          ground_truth: 'First fact. Second fact.',
        }),
      );

      expect(result.total_facts).toBeGreaterThanOrEqual(2);
    });

    it('uses whole text when no phrases extracted', async () => {
      const scorer = new ContextRecallScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Content.'],
          ground_truth: 'xy z',
        }),
      );

      expect(result.total_facts).toBeGreaterThan(0);
    });
  });

  describe('extractKeyPhrases', () => {
    it('extracts from is/are/was/were patterns', async () => {
      const scorer = new ContextRecallScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Content.'],
          ground_truth: 'Refund policy is 14 days.',
        }),
      );

      expect(result.total_facts).toBeGreaterThan(0);
    });

    it('extracts from within/after/before patterns', async () => {
      const scorer = new ContextRecallScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Content.'],
          ground_truth: 'Return within 14 days.',
        }),
      );

      expect(result.total_facts).toBeGreaterThan(0);
    });

    it('extracts from at/in/on/by/with/from/to patterns', async () => {
      const scorer = new ContextRecallScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Content.'],
          ground_truth: 'Contact at support@example.com.',
        }),
      );

      expect(result.total_facts).toBeGreaterThan(0);
    });

    it('groups significant words when no pattern matches', async () => {
      const scorer = new ContextRecallScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Content.'],
          ground_truth: 'Refund policy example detail.',
        }),
      );

      expect(result.total_facts).toBeGreaterThan(0);
    });

    it('uses whole sentence when no phrases or significant words', async () => {
      const scorer = new ContextRecallScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Content.'],
          ground_truth: 'a an the',
        }),
      );

      expect(result.total_facts).toBe(1);
    });
  });

  describe('checkFactCoverage', () => {
    it('detects direct match', async () => {
      const scorer = new ContextRecallScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Refund policy is 14 days.'],
          ground_truth: 'Refund policy is 14 days.',
        }),
      );

      expect(result.score).toBe(1);
      expect(result.facts?.[0]?.matching_context).toBeDefined();
    });

    it('detects coverage via keyword overlap >= 0.7', async () => {
      const scorer = new ContextRecallScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Refund policy requires customer support.'],
          ground_truth: 'Refund policy support.',
        }),
      );

      expect(result.score).toBe(1);
    });

    it('detects no coverage when keyword overlap < 0.7', async () => {
      const scorer = new ContextRecallScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Completely unrelated content here.'],
          ground_truth: 'Refund policy support.',
        }),
      );

      expect(result.score).toBe(0);
    });

    it('handles fact with no significant words', async () => {
      const scorer = new ContextRecallScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Some content.'],
          ground_truth: 'a an the',
        }),
      );

      expect(result.score).toBe(0);
    });

    it('provides matching context when covered', async () => {
      const scorer = new ContextRecallScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Refund policy support contact.'],
          ground_truth: 'Refund policy support.',
        }),
      );

      const factsWithContext = result.facts?.filter((f) => f.matching_context);
      expect(factsWithContext?.length).toBeGreaterThan(0);
    });
  });

  describe('findMatchingSnippet', () => {
    it('finds best matching window in context', async () => {
      const scorer = new ContextRecallScorer();
      const result = await scorer.score(
        makeSample({
          context: ['One two three refund policy support four five.'],
          ground_truth: 'Refund policy support.',
        }),
      );

      expect(result.score).toBeGreaterThan(0);
    });

    it('fallback to first 100 characters when no match', async () => {
      const scorer = new ContextRecallScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Short context.'],
          ground_truth: 'Completely unrelated fact here.',
        }),
      );

      expect(result.score).toBe(0);
    });
  });

  describe('generateExplanation', () => {
    it('explains when no facts', async () => {
      const scorer = new ContextRecallScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Content.'],
          ground_truth: '',
        }),
      );

      expect(result.explanation).toBe('No facts to evaluate in ground truth');
    });

    it('explains perfect score', async () => {
      const scorer = new ContextRecallScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Refunds must be requested within 14 days by contacting support.'],
          ground_truth: 'Refunds must be requested within 14 days by contacting support.',
        }),
      );

      expect(result.explanation).toContain('All');
      expect(result.explanation).toContain('covered by the retrieved context');
    });

    it('explains zero score', async () => {
      const scorer = new ContextRecallScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Unrelated content.'],
          ground_truth: 'Refund policy support.',
        }),
      );

      expect(result.explanation).toContain('None');
      expect(result.explanation).toContain('are covered');
    });

    it('explains partial score with missing details', async () => {
      const scorer = new ContextRecallScorer();
      const result = await scorer.score(
        makeSample({
          context: ['Refund policy support.'],
          ground_truth: 'Refund policy support. Contact customer service. Additional detail.',
        }),
      );

      expect(result.explanation).toContain('of');
      expect(result.explanation).toContain('facts covered');
    });
  });
});
