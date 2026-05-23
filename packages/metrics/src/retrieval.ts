import type { EvaluationSample, RetrievalResult } from '@reaatech/rag-eval-core';

/** Options for the retrieval scorer. */
export interface RetrievalScorerOptions {
  /** Cutoff rank for @k metrics. Defaults to the number of retrieved chunks. */
  k?: number;
}

/**
 * Retrieval Scorer
 *
 * Standard information-retrieval ranking metrics — MRR, nDCG, precision@k,
 * recall@k, and hit@k — computed from the ranked `retrieved_chunk_ids` and the
 * ground-truth `relevant_chunk_ids` on a sample. These require chunk-ID labels
 * and complement the text-based context precision/recall scorers.
 */
export class RetrievalScorer {
  private defaultK?: number;

  constructor(options: RetrievalScorerOptions = {}) {
    this.defaultK = options.k;
  }

  /**
   * Score retrieval ranking for a single sample.
   * Async to match the other scorers' interface (no awaited work here).
   */
  async score(sample: EvaluationSample): Promise<RetrievalResult> {
    const retrieved = sample.retrieved_chunk_ids ?? [];
    const relevant = new Set(sample.relevant_chunk_ids ?? []);
    const k = Math.max(0, this.defaultK ?? retrieved.length);
    const topK = retrieved.slice(0, k);

    const mrr = this.reciprocalRank(retrieved, relevant);
    const ndcg = this.ndcg(retrieved, relevant);
    const relevantInTopK = topK.filter((id) => relevant.has(id)).length;
    const precisionAtK = topK.length > 0 ? relevantInTopK / topK.length : 0;
    const recallAtK = relevant.size > 0 ? relevantInTopK / relevant.size : 0;
    const hitAtK = relevantInTopK > 0 ? 1 : 0;

    return {
      mrr: round(mrr),
      ndcg: round(ndcg),
      precision_at_k: round(precisionAtK),
      recall_at_k: round(recallAtK),
      hit_at_k: hitAtK,
      k,
      explanation: this.explain(relevant.size, retrieved.length, k, relevantInTopK),
    };
  }

  /**
   * Score retrieval ranking for multiple samples.
   */
  async scoreBatch(samples: EvaluationSample[]): Promise<RetrievalResult[]> {
    return Promise.all(samples.map((sample) => this.score(sample)));
  }

  /** Reciprocal rank of the first relevant chunk. */
  private reciprocalRank(retrieved: string[], relevant: Set<string>): number {
    for (let i = 0; i < retrieved.length; i++) {
      const id = retrieved[i];
      if (id !== undefined && relevant.has(id)) {
        return 1 / (i + 1);
      }
    }
    return 0;
  }

  /** Binary-relevance nDCG over the retrieved ranking. */
  private ndcg(retrieved: string[], relevant: Set<string>): number {
    if (retrieved.length === 0 || relevant.size === 0) return 0;

    let dcg = 0;
    for (let i = 0; i < retrieved.length; i++) {
      const id = retrieved[i];
      if (id !== undefined && relevant.has(id)) {
        dcg += 1 / Math.log2(i + 2);
      }
    }

    // Ideal DCG: all relevant chunks ranked first (capped at list length).
    const idealHits = Math.min(relevant.size, retrieved.length);
    let idcg = 0;
    for (let i = 0; i < idealHits; i++) {
      idcg += 1 / Math.log2(i + 2);
    }

    return idcg === 0 ? 0 : dcg / idcg;
  }

  private explain(
    relevantCount: number,
    retrievedCount: number,
    k: number,
    relevantInTopK: number,
  ): string {
    if (retrievedCount === 0) {
      return 'No retrieved_chunk_ids provided — retrieval metrics are 0';
    }
    if (relevantCount === 0) {
      return 'No relevant_chunk_ids provided — cannot judge retrieval relevance';
    }
    return `${relevantInTopK}/${k} top-${k} chunks relevant (${relevantCount} relevant overall, ${retrievedCount} retrieved)`;
  }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
