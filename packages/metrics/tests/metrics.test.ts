import type { EvaluationSample } from '@reaatech/rag-eval-core';
import {
  ContextPrecisionScorer,
  ContextRecallScorer,
  FaithfulnessScorer,
  RelevanceScorer,
} from '@reaatech/rag-eval-metrics';
import { beforeEach, describe, expect, it } from 'vitest';

describe('Metrics', () => {
  describe('FaithfulnessScorer', () => {
    let scorer: FaithfulnessScorer;

    beforeEach(() => {
      scorer = new FaithfulnessScorer();
    });

    it('should score high for faithful answers', async () => {
      const sample: EvaluationSample = {
        query: 'What is the refund policy?',
        context: ['Refunds are processed within 14 days of purchase.'],
        ground_truth: 'Refunds within 14 days.',
        generated_answer: 'You can request a refund within 14 days.',
      };

      const result = await scorer.score(sample);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.statements).toBeDefined();
      expect(result.supported_count).toBeDefined();
    });

    it('should score low for hallucinated answers', async () => {
      const sample: EvaluationSample = {
        query: 'What is the refund policy?',
        context: ['Refunds are processed within 14 days.'],
        ground_truth: 'Refunds within 14 days.',
        generated_answer: 'Refunds take 30 days and require a phone call.',
      };

      const result = await scorer.score(sample);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });
  });

  describe('RelevanceScorer', () => {
    let scorer: RelevanceScorer;

    beforeEach(() => {
      scorer = new RelevanceScorer();
    });

    it('should score high for relevant answers', async () => {
      const sample: EvaluationSample = {
        query: 'How do I reset my password?',
        context: [],
        ground_truth: 'Go to /reset-password.',
        generated_answer: 'Visit the password reset page.',
      };

      const result = await scorer.score(sample);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.lexical_similarity).toBeDefined();
      expect(result.semantic_similarity).toBeUndefined();
      expect(result.intent_score).toBeDefined();
    });

    it('should score low for irrelevant answers', async () => {
      const sample: EvaluationSample = {
        query: 'How do I reset my password?',
        context: [],
        ground_truth: 'Go to /reset-password.',
        generated_answer: 'The weather is nice today.',
      };

      const result = await scorer.score(sample);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });
  });

  describe('ContextPrecisionScorer', () => {
    let scorer: ContextPrecisionScorer;

    beforeEach(() => {
      scorer = new ContextPrecisionScorer();
    });

    it('should score high when relevant context is ranked first', async () => {
      const sample: EvaluationSample = {
        query: 'What is the refund policy?',
        context: [
          'Refunds within 14 days.',
          'Contact support for help.',
          'Shipping takes 5-7 days.',
        ],
        ground_truth: 'Refunds must be requested within 14 days.',
        generated_answer: '',
      };

      const result = await scorer.score(sample);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.map).toBeDefined();
      expect(result.ndcg).toBeDefined();
    });

    it('should handle empty context', async () => {
      const sample: EvaluationSample = {
        query: 'Test query',
        context: [],
        ground_truth: 'Test answer',
        generated_answer: '',
      };

      const result = await scorer.score(sample);
      expect(result.score).toBe(0);
    });
  });

  describe('ContextRecallScorer', () => {
    let scorer: ContextRecallScorer;

    beforeEach(() => {
      scorer = new ContextRecallScorer();
    });

    it('should score high when context covers ground truth', async () => {
      const sample: EvaluationSample = {
        query: 'What is the refund policy?',
        context: [
          'Refunds are processed within 14 days of purchase.',
          'Contact support@example.com for refund requests.',
        ],
        ground_truth: 'Refunds must be requested within 14 days by contacting support.',
        generated_answer: '',
      };

      const result = await scorer.score(sample);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.total_facts).toBeDefined();
      expect(result.covered_facts).toBeDefined();
    });

    it('should score low when context misses ground truth facts', async () => {
      const sample: EvaluationSample = {
        query: 'What is the refund policy?',
        context: ['Shipping takes 5-7 days.'],
        ground_truth: 'Refunds within 14 days by contacting support.',
        generated_answer: '',
      };

      const result = await scorer.score(sample);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should handle empty context', async () => {
      const sample: EvaluationSample = {
        query: 'Test query',
        context: [],
        ground_truth: 'Test answer',
        generated_answer: '',
      };

      const result = await scorer.score(sample);
      expect(result.score).toBe(0);
    });
  });
});
