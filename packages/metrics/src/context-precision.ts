import type { ContextPrecisionResult, EvaluationSample } from '@reaatech/rag-eval-core';

/**
 * Context Precision Scorer
 *
 * Measures whether the most relevant context chunks are ranked highest
 * in the retrieval results. Uses MAP (Mean Average Precision) and NDCG
 * (Normalized Discounted Cumulative Gain) metrics.
 */
export class ContextPrecisionScorer {
  /**
   * Score context precision for a single sample
   */
  async score(sample: EvaluationSample): Promise<ContextPrecisionResult> {
    const { query, context, ground_truth } = sample;

    // Assess relevance of each context chunk
    const chunkRelevanceScores = await Promise.all(
      context.map((chunk) => this.assessChunkRelevance(query, chunk, ground_truth)),
    );

    // Calculate MAP (Mean Average Precision)
    const map = this.calculateMAP(chunkRelevanceScores);

    // Calculate NDCG (Normalized Discounted Cumulative Gain)
    const ndcg = this.calculateNDCG(chunkRelevanceScores);

    // Overall score is average of MAP and NDCG
    const score = Math.round(((map + ndcg) / 2) * 1000) / 1000;

    return {
      score,
      map: Math.round(map * 1000) / 1000,
      ndcg: Math.round(ndcg * 1000) / 1000,
      chunk_relevance_scores: chunkRelevanceScores.map((s) => Math.round(s * 1000) / 1000),
      explanation: this.generateExplanation(score, map, ndcg, chunkRelevanceScores),
    };
  }

  /**
   * Score context precision for multiple samples
   */
  async scoreBatch(samples: EvaluationSample[]): Promise<ContextPrecisionResult[]> {
    return Promise.all(samples.map((sample) => this.score(sample)));
  }

  /**
   * Assess relevance of a single context chunk
   */
  private async assessChunkRelevance(
    query: string,
    chunk: string,
    groundTruth: string,
  ): Promise<number> {
    const chunkLower = chunk.toLowerCase();
    const groundTruthLower = groundTruth.toLowerCase();

    // Check if chunk contains ground truth information
    if (chunkLower.includes(groundTruthLower)) {
      return 1.0;
    }

    // Check keyword overlap with ground truth
    const groundTruthWords = this.getSignificantWords(groundTruthLower);
    const chunkWords = new Set(this.getWords(chunkLower));

    if (groundTruthWords.length === 0) {
      return 0.5;
    }

    const matchedWords = groundTruthWords.filter((w) => chunkWords.has(w));
    const groundTruthCoverage = matchedWords.length / groundTruthWords.length;

    // Also check overlap with query
    const queryWords = this.getSignificantWords(query.toLowerCase());
    const queryMatched = queryWords.filter((w) => chunkWords.has(w));
    const queryCoverage = queryWords.length > 0 ? queryMatched.length / queryWords.length : 0;

    // Weighted score: 70% ground truth coverage, 30% query relevance
    return groundTruthCoverage * 0.7 + queryCoverage * 0.3;
  }

  /**
   * Calculate Mean Average Precision (MAP)
   * For a single query, this is Average Precision (AP)
   */
  private calculateMAP(relevanceScores: number[]): number {
    if (relevanceScores.length === 0) return 0;

    // Convert scores to binary relevance (threshold at 0.5)
    const binaryRelevance: number[] = relevanceScores.map((s) => (s >= 0.5 ? 1 : 0));

    let precisionSum = 0;
    let relevantCount = 0;
    const totalRelevant = binaryRelevance.reduce((sum, r) => sum + (r as number), 0);

    if (totalRelevant === 0) return 0;

    for (let i = 0; i < binaryRelevance.length; i++) {
      if (binaryRelevance[i] === 1) {
        relevantCount++;
        const precisionAtI = relevantCount / (i + 1);
        precisionSum += precisionAtI;
      }
    }

    return precisionSum / totalRelevant;
  }

  /**
   * Calculate Normalized Discounted Cumulative Gain (NDCG)
   */
  private calculateNDCG(relevanceScores: number[]): number {
    if (relevanceScores.length === 0) return 0;

    // Calculate DCG
    let dcg = 0;
    for (let i = 0; i < relevanceScores.length; i++) {
      // Using gain = 2^rel - 1 for graded relevance
      const score = relevanceScores[i] ?? 0;
      const gain = 2 ** score - 1;
      const discount = Math.log2(i + 2); // i+2 because positions are 1-indexed
      dcg += gain / discount;
    }

    // Calculate ideal DCG (IDCG) - best possible ordering
    const idealScores = [...relevanceScores].sort((a, b) => b - a);
    let idcg = 0;
    for (let i = 0; i < idealScores.length; i++) {
      const score = idealScores[i] ?? 0;
      const gain = 2 ** score - 1;
      const discount = Math.log2(i + 2);
      idcg += gain / discount;
    }

    if (idcg === 0) return 0;

    return dcg / idcg;
  }

  /**
   * Get words from text
   */
  private getWords(text: string): string[] {
    return text.match(/[a-z]+/g) ?? [];
  }

  /**
   * Get significant words (filtering stop words)
   */
  private getSignificantWords(text: string): string[] {
    const stopWords = new Set([
      'a',
      'an',
      'the',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'shall',
      'can',
      'to',
      'of',
      'in',
      'for',
      'on',
      'with',
      'at',
      'by',
      'from',
      'as',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'between',
      'out',
      'off',
      'over',
      'under',
      'again',
      'further',
      'then',
      'once',
      'here',
      'there',
      'when',
      'where',
      'why',
      'how',
      'all',
      'each',
      'every',
      'both',
      'few',
      'more',
      'most',
      'other',
      'some',
      'such',
      'no',
      'nor',
      'not',
      'only',
      'own',
      'same',
      'so',
      'than',
      'too',
      'very',
      'just',
      'and',
      'but',
      'or',
      'if',
      'while',
      'because',
      'until',
      'about',
      'against',
      'up',
      'down',
      'it',
      'its',
      'i',
      'me',
      'my',
      'myself',
      'we',
      'our',
      'ours',
      'ourselves',
      'you',
      'your',
      'yours',
      'yourself',
      'yourselves',
      'he',
      'him',
      'his',
      'himself',
      'she',
      'her',
      'hers',
      'herself',
      'they',
      'them',
      'their',
      'theirs',
      'themselves',
      'what',
      'which',
      'who',
      'whom',
      'this',
      'that',
      'these',
      'those',
    ]);

    return this.getWords(text).filter((word) => word.length > 2 && !stopWords.has(word));
  }

  /**
   * Generate explanation for the context precision score
   */
  private generateExplanation(
    score: number,
    map: number,
    ndcg: number,
    relevanceScores: number[],
  ): string {
    const relevantChunks = relevanceScores.filter((s) => s >= 0.5).length;
    const totalChunks = relevanceScores.length;

    if (score >= 0.8) {
      return `Excellent context ranking. ${relevantChunks}/${totalChunks} chunks relevant. MAP: ${map.toFixed(2)}, NDCG: ${ndcg.toFixed(2)}`;
    }
    if (score >= 0.6) {
      return `Good context ranking. ${relevantChunks}/${totalChunks} chunks relevant. MAP: ${map.toFixed(2)}, NDCG: ${ndcg.toFixed(2)}`;
    }
    if (score >= 0.4) {
      return `Moderate context ranking. ${relevantChunks}/${totalChunks} chunks relevant. Consider improving retrieval. MAP: ${map.toFixed(2)}, NDCG: ${ndcg.toFixed(2)}`;
    }
    return `Poor context ranking. Only ${relevantChunks}/${totalChunks} chunks relevant. Retrieval needs improvement. MAP: ${map.toFixed(2)}, NDCG: ${ndcg.toFixed(2)}`;
  }
}
