import type {
  AnswerCorrectnessResult,
  EmbeddingProvider,
  EvaluationSample,
} from '@reaatech/rag-eval-core';
import {
  cosineSimilarity,
  diceCoefficient,
  getBigrams,
  getSignificantWords,
} from './text-utils.js';

/** Options for the answer-correctness scorer. */
export interface AnswerCorrectnessScorerOptions {
  /**
   * Optional embedding provider. When supplied, semantic similarity to the
   * ground truth is computed and used as the primary signal; otherwise scoring
   * is lexical only.
   */
  embeddingProvider?: EmbeddingProvider;
}

/**
 * Answer Correctness Scorer
 *
 * Measures how well the generated answer matches the ground-truth answer.
 * Unlike faithfulness (answer vs. context) and relevance (answer vs. query),
 * this compares the answer directly against the reference answer.
 */
export class AnswerCorrectnessScorer {
  private embeddingProvider?: EmbeddingProvider;

  constructor(options: AnswerCorrectnessScorerOptions = {}) {
    this.embeddingProvider = options.embeddingProvider;
  }

  /**
   * Score answer correctness for a single sample.
   */
  async score(sample: EvaluationSample): Promise<AnswerCorrectnessResult> {
    const { generated_answer, ground_truth } = sample;

    const lexicalSimilarity = this.lexicalSimilarity(generated_answer, ground_truth);
    const semanticSimilarity = this.embeddingProvider
      ? await this.semanticSimilarity(generated_answer, ground_truth)
      : undefined;

    const primary = semanticSimilarity ?? lexicalSimilarity;
    const score = Math.round(primary * 1000) / 1000;

    const result: AnswerCorrectnessResult = {
      score,
      lexical_similarity: Math.round(lexicalSimilarity * 1000) / 1000,
      explanation: this.explain(score),
    };
    if (semanticSimilarity !== undefined) {
      result.semantic_similarity = Math.round(semanticSimilarity * 1000) / 1000;
    }
    return result;
  }

  /**
   * Score answer correctness for multiple samples.
   */
  async scoreBatch(samples: EvaluationSample[]): Promise<AnswerCorrectnessResult[]> {
    return Promise.all(samples.map((sample) => this.score(sample)));
  }

  private async semanticSimilarity(answer: string, groundTruth: string): Promise<number> {
    if (!this.embeddingProvider) return 0;
    const [answerVec, truthVec] = await this.embeddingProvider.embed([answer, groundTruth]);
    if (!answerVec || !truthVec) return 0;
    return Math.max(0, Math.min(1, cosineSimilarity(answerVec, truthVec)));
  }

  /** Token-level F1 over significant words, blended with character bigram Dice. */
  private lexicalSimilarity(answer: string, groundTruth: string): number {
    const answerLower = answer.toLowerCase();
    const truthLower = groundTruth.toLowerCase();

    const answerTokens = getSignificantWords(answerLower);
    const truthTokens = getSignificantWords(truthLower);
    const truthSet = new Set(truthTokens);
    const answerSet = new Set(answerTokens);

    let f1 = 0;
    if (answerSet.size > 0 && truthSet.size > 0) {
      const overlap = [...truthSet].filter((t) => answerSet.has(t)).length;
      const precision = overlap / answerSet.size;
      const recall = overlap / truthSet.size;
      f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    }

    const bigramSimilarity = diceCoefficient(getBigrams(answerLower), getBigrams(truthLower));

    // Token F1 carries the bulk of the signal; bigrams reward surface overlap.
    return f1 * 0.7 + bigramSimilarity * 0.3;
  }

  private explain(score: number): string {
    if (score >= 0.8) return 'Answer closely matches the ground truth';
    if (score >= 0.6) return 'Answer substantially matches the ground truth';
    if (score >= 0.4) return 'Answer partially matches the ground truth';
    return 'Answer diverges from the ground truth';
  }
}
