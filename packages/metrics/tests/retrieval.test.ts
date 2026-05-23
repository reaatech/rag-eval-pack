import type { EvaluationSample } from '@reaatech/rag-eval-core';
import { RetrievalScorer } from '@reaatech/rag-eval-metrics';
import { describe, expect, it } from 'vitest';

function makeSample(overrides: Partial<EvaluationSample> = {}): EvaluationSample {
  return {
    query: 'q',
    context: ['c'],
    ground_truth: 'gt',
    generated_answer: 'a',
    ...overrides,
  };
}

describe('RetrievalScorer', () => {
  it('computes MRR, nDCG, precision/recall/hit@k from chunk ids', async () => {
    const scorer = new RetrievalScorer();
    const result = await scorer.score(
      makeSample({
        retrieved_chunk_ids: ['a', 'b', 'c'],
        relevant_chunk_ids: ['b'],
      }),
    );

    expect(result.k).toBe(3);
    expect(result.mrr).toBeCloseTo(0.5, 3); // first relevant at rank 2
    expect(result.ndcg).toBeCloseTo(0.631, 2);
    expect(result.precision_at_k).toBeCloseTo(1 / 3, 3);
    expect(result.recall_at_k).toBe(1);
    expect(result.hit_at_k).toBe(1);
  });

  it('rewards relevant chunks ranked higher (nDCG)', async () => {
    const scorer = new RetrievalScorer();
    const high = await scorer.score(
      makeSample({ retrieved_chunk_ids: ['x', 'y', 'z'], relevant_chunk_ids: ['x'] }),
    );
    const low = await scorer.score(
      makeSample({ retrieved_chunk_ids: ['x', 'y', 'z'], relevant_chunk_ids: ['z'] }),
    );
    expect(high.ndcg).toBeGreaterThan(low.ndcg);
    expect(high.mrr).toBeGreaterThan(low.mrr);
  });

  it('honors an explicit k cutoff', async () => {
    const scorer = new RetrievalScorer({ k: 1 });
    const result = await scorer.score(
      makeSample({ retrieved_chunk_ids: ['a', 'b'], relevant_chunk_ids: ['b'] }),
    );
    expect(result.k).toBe(1);
    expect(result.hit_at_k).toBe(0); // relevant 'b' is outside top-1
    expect(result.precision_at_k).toBe(0);
  });

  it('returns zeros when no ids are provided', async () => {
    const scorer = new RetrievalScorer();
    const result = await scorer.score(makeSample());
    expect(result.mrr).toBe(0);
    expect(result.ndcg).toBe(0);
    expect(result.hit_at_k).toBe(0);
    expect(result.explanation).toContain('No retrieved_chunk_ids');
  });

  it('scores a batch', async () => {
    const scorer = new RetrievalScorer();
    const results = await scorer.scoreBatch([
      makeSample({ retrieved_chunk_ids: ['a'], relevant_chunk_ids: ['a'] }),
      makeSample({ retrieved_chunk_ids: ['a'], relevant_chunk_ids: ['b'] }),
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]?.hit_at_k).toBe(1);
    expect(results[1]?.hit_at_k).toBe(0);
  });
});
