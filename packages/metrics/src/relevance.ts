import type { EmbeddingProvider, EvaluationSample, RelevanceResult } from '@reaatech/rag-eval-core';
import {
  cosineSimilarity,
  diceCoefficient,
  getBigrams,
  getSignificantWords,
  getWords,
  normalizeWord,
} from './text-utils.js';

/** Options for the relevance scorer. */
export interface RelevanceScorerOptions {
  /**
   * Optional embedding provider. When supplied, true semantic similarity
   * (cosine of embeddings) is computed and used as the primary signal, and
   * exposed as `semantic_similarity`. Without it, scoring is purely lexical
   * and only `lexical_similarity` is populated.
   */
  embeddingProvider?: EmbeddingProvider;
}

/**
 * Relevance Scorer
 *
 * Measures whether a RAG system's generated answer actually addresses the
 * user's query. By default this uses lexical heuristics (word/character
 * overlap + intent coverage) — fast and dependency-free, but blind to
 * paraphrase. Supply an `embeddingProvider` for true semantic similarity.
 */
export class RelevanceScorer {
  private embeddingProvider?: EmbeddingProvider;

  constructor(options: RelevanceScorerOptions = {}) {
    this.embeddingProvider = options.embeddingProvider;
  }

  /**
   * Score relevance for a single sample
   */
  async score(sample: EvaluationSample): Promise<RelevanceResult> {
    const { query, generated_answer } = sample;

    // Lexical similarity is always computed (cheap, deterministic).
    const lexicalSimilarity = this.calculateLexicalSimilarity(query, generated_answer);

    // Semantic similarity only when an embedding provider is configured.
    const semanticSimilarity = this.embeddingProvider
      ? await this.calculateSemanticSimilarity(query, generated_answer)
      : undefined;

    // Intent coverage: does the answer address the parts of the query?
    const intentScore = this.calculateIntentCoverage(query, generated_answer);

    // Prefer the semantic signal when available, else fall back to lexical.
    const primarySimilarity = semanticSimilarity ?? lexicalSimilarity;
    const score = Math.round((primarySimilarity * 0.6 + intentScore * 0.4) * 1000) / 1000;

    const result: RelevanceResult = {
      score,
      lexical_similarity: Math.round(lexicalSimilarity * 1000) / 1000,
      intent_score: Math.round(intentScore * 1000) / 1000,
      explanation: this.generateExplanation(score, primarySimilarity, intentScore),
    };
    if (semanticSimilarity !== undefined) {
      result.semantic_similarity = Math.round(semanticSimilarity * 1000) / 1000;
    }
    return result;
  }

  /**
   * Score relevance for multiple samples
   */
  async scoreBatch(samples: EvaluationSample[]): Promise<RelevanceResult[]> {
    return Promise.all(samples.map((sample) => this.score(sample)));
  }

  /**
   * True semantic similarity via embeddings (cosine of query/answer vectors).
   */
  private async calculateSemanticSimilarity(query: string, answer: string): Promise<number> {
    if (!this.embeddingProvider) return 0;
    const [queryVec, answerVec] = await this.embeddingProvider.embed([query, answer]);
    if (!queryVec || !answerVec) return 0;
    // Cosine can be negative; clamp to [0, 1] to stay on the metric scale.
    return Math.max(0, Math.min(1, cosineSimilarity(queryVec, answerVec)));
  }

  /**
   * Lexical similarity using word overlap (Jaccard) and character bigram
   * similarity (Dice). Surface-form only — does not capture paraphrase.
   */
  private calculateLexicalSimilarity(query: string, answer: string): number {
    const queryLower = query.toLowerCase();
    const answerLower = answer.toLowerCase();

    // Check for direct containment
    if (answerLower.includes(queryLower) || queryLower.includes(answerLower)) {
      return 1.0;
    }

    // Word-level Jaccard similarity
    const queryWords = new Set(getWords(queryLower));
    const answerWords = new Set(getWords(answerLower));

    const intersection = [...queryWords].filter((w) => answerWords.has(w));
    const union = new Set([...queryWords, ...answerWords]);

    const jaccard = union.size > 0 ? intersection.length / union.size : 0;

    // Character bigram similarity (Dice coefficient)
    const queryBigrams = getBigrams(queryLower);
    const answerBigrams = getBigrams(answerLower);
    const bigramSimilarity = diceCoefficient(queryBigrams, answerBigrams);

    // Weighted average of word and character similarity
    return jaccard * 0.4 + bigramSimilarity * 0.6;
  }

  /**
   * Calculate intent coverage - does the answer address all parts of the query?
   */
  private calculateIntentCoverage(query: string, answer: string): number {
    const queryLower = query.toLowerCase();
    const answerLower = answer.toLowerCase();

    // Extract question words/phrases from query
    const questionPatterns = [
      /what\s+(is|are|was|were|do|does|did)\s+/i,
      /how\s+(do|does|did|can|could|should|would)\s+/i,
      /when\s+(do|does|did|can|could|should|would|is|are|was|were)\s+/i,
      /where\s+(do|does|did|can|could|should|would|is|are|was|were)\s+/i,
      /why\s+(do|does|did|can|could|should|would|is|are|was|were)\s+/i,
      /who\s+(do|does|did|can|could|should|would|is|are|was|were)\s+/i,
      /which\s+/i,
    ];

    // Check if query is a question
    const isQuestion = questionPatterns.some((p) => p.test(query)) || query.trim().endsWith('?');

    if (!isQuestion) {
      // For non-questions, use simple keyword matching
      const queryWords = getSignificantWords(queryLower);
      const answerWords = new Set(getWords(answerLower).map((w) => normalizeWord(w)));
      const matchedWords = queryWords.filter((w) => answerWords.has(w));
      return queryWords.length > 0 ? matchedWords.length / queryWords.length : 0.5;
    }

    // Extract key topics/entities from query
    const queryWords = getSignificantWords(queryLower);

    if (queryWords.length === 0) {
      return 0.5;
    }

    // Check how many query topics are addressed in the answer
    const answerWords = new Set(getWords(answerLower).map((w) => normalizeWord(w)));
    const matchedTopics = queryWords.filter((w) => answerWords.has(w));

    // Also check for synonyms/common responses
    const hasActionWords = this.containsActionWords(answerLower);
    const hasSpecificInfo = answerLower.length > queryLower.length * 0.5;

    const topicCoverage = matchedTopics.length / queryWords.length;
    const bonusScore = (hasActionWords ? 0.1 : 0) + (hasSpecificInfo ? 0.1 : 0);

    return Math.min(1, topicCoverage + bonusScore);
  }

  /**
   * Check if text contains action words (indicating a helpful response)
   */
  private containsActionWords(text: string): boolean {
    const actionWords = new Set([
      'can',
      'could',
      'should',
      'would',
      'will',
      'may',
      'might',
      'need',
      'must',
      'have',
      'get',
      'go',
      'visit',
      'contact',
      'call',
      'email',
      'send',
      'click',
      'select',
      'choose',
      'enter',
      'provide',
      'submit',
      'request',
      'follow',
    ]);

    const words = getWords(text);
    return words.some((word) => actionWords.has(word));
  }

  /**
   * Generate explanation for the relevance score
   */
  private generateExplanation(
    score: number,
    primarySimilarity: number,
    intentScore: number,
  ): string {
    if (score >= 0.8) {
      return `Answer is highly relevant (similarity: ${primarySimilarity.toFixed(2)}, intent: ${intentScore.toFixed(2)})`;
    }
    if (score >= 0.6) {
      return `Answer is moderately relevant (similarity: ${primarySimilarity.toFixed(2)}, intent: ${intentScore.toFixed(2)})`;
    }
    if (score >= 0.4) {
      return `Answer may not fully address the query (similarity: ${primarySimilarity.toFixed(2)}, intent: ${intentScore.toFixed(2)})`;
    }
    return `Answer appears irrelevant to the query (similarity: ${primarySimilarity.toFixed(2)}, intent: ${intentScore.toFixed(2)})`;
  }
}
