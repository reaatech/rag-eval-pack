import type { EvaluationSample, RelevanceResult } from '@reaatech/rag-eval-core';

/**
 * Relevance Scorer
 *
 * Measures whether a RAG system's generated answer actually addresses the user's query.
 * Assesses semantic similarity and intent coverage.
 */
export class RelevanceScorer {
  /**
   * Score relevance for a single sample
   */
  async score(sample: EvaluationSample): Promise<RelevanceResult> {
    const { query, generated_answer } = sample;

    // Calculate semantic similarity
    const semanticSimilarity = this.calculateSemanticSimilarity(query, generated_answer);

    // Calculate intent coverage
    const intentScore = this.calculateIntentCoverage(query, generated_answer);

    // Weighted combination: 60% semantic, 40% intent
    const score = Math.round((semanticSimilarity * 0.6 + intentScore * 0.4) * 1000) / 1000;

    return {
      score,
      semantic_similarity: Math.round(semanticSimilarity * 1000) / 1000,
      intent_score: Math.round(intentScore * 1000) / 1000,
      explanation: this.generateExplanation(score, semanticSimilarity, intentScore),
    };
  }

  /**
   * Score relevance for multiple samples
   */
  async scoreBatch(samples: EvaluationSample[]): Promise<RelevanceResult[]> {
    return Promise.all(samples.map((sample) => this.score(sample)));
  }

  /**
   * Calculate semantic similarity using word overlap and character n-gram similarity
   */
  private calculateSemanticSimilarity(query: string, answer: string): number {
    const queryLower = query.toLowerCase();
    const answerLower = answer.toLowerCase();

    // Check for direct containment
    if (answerLower.includes(queryLower) || queryLower.includes(answerLower)) {
      return 1.0;
    }

    // Word-level Jaccard similarity
    const queryWords = new Set(this.getWords(queryLower));
    const answerWords = new Set(this.getWords(answerLower));

    const intersection = [...queryWords].filter((w) => answerWords.has(w));
    const union = new Set([...queryWords, ...answerWords]);

    const jaccard = union.size > 0 ? intersection.length / union.size : 0;

    // Character bigram similarity (Dice coefficient)
    const queryBigrams = this.getBigrams(queryLower);
    const answerBigrams = this.getBigrams(answerLower);
    const bigramSimilarity = this.diceCoefficient(queryBigrams, answerBigrams);

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
      const queryWords = this.getSignificantWords(queryLower);
      const answerWords = new Set(this.getWords(answerLower).map((w) => this.normalizeWord(w)));
      const matchedWords = queryWords.filter((w) => answerWords.has(w));
      return queryWords.length > 0 ? matchedWords.length / queryWords.length : 0.5;
    }

    // Extract key topics/entities from query
    const queryWords = this.getSignificantWords(queryLower);

    if (queryWords.length === 0) {
      return 0.5;
    }

    // Check how many query topics are addressed in the answer
    const answerWords = new Set(this.getWords(answerLower).map((w) => this.normalizeWord(w)));
    const matchedTopics = queryWords.filter((w) => answerWords.has(w));

    // Also check for synonyms/common responses
    const hasActionWords = this.containsActionWords(answerLower);
    const hasSpecificInfo = answerLower.length > queryLower.length * 0.5;

    const topicCoverage = matchedTopics.length / queryWords.length;
    const bonusScore = (hasActionWords ? 0.1 : 0) + (hasSpecificInfo ? 0.1 : 0);

    return Math.min(1, topicCoverage + bonusScore);
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

    const words = this.getWords(text);
    const numbers = text.match(/\d{2,}/g) ?? [];
    const allTokens = [...words, ...numbers].map((w) => this.normalizeWord(w));
    return allTokens.filter((word) => word.length > 2 && !stopWords.has(word));
  }

  /**
   * Normalize a word by stripping common English inflections
   */
  private normalizeWord(word: string): string {
    const len = word.length;
    if (len <= 3) return word;
    if (word.endsWith('ing') && len > 4) return word.slice(0, -3);
    if (word.endsWith('ed') && len > 4) return word.slice(0, -2);
    if (word.endsWith('s') && !word.endsWith('ss') && len > 3) return word.slice(0, -1);
    return word;
  }

  /**
   * Get character bigrams from text
   */
  private getBigrams(text: string): Set<string> {
    const bigrams = new Set<string>();
    for (let i = 0; i < text.length - 1; i++) {
      bigrams.add(text.substring(i, i + 2));
    }
    return bigrams;
  }

  /**
   * Calculate Dice coefficient between two sets of bigrams
   */
  private diceCoefficient(bigrams1: Set<string>, bigrams2: Set<string>): number {
    if (bigrams1.size === 0 || bigrams2.size === 0) {
      return 0;
    }

    let intersection = 0;
    for (const bigram of bigrams1) {
      if (bigrams2.has(bigram)) {
        intersection++;
      }
    }

    return (2 * intersection) / (bigrams1.size + bigrams2.size);
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

    const words = this.getWords(text);
    return words.some((word) => actionWords.has(word));
  }

  /**
   * Generate explanation for the relevance score
   */
  private generateExplanation(
    score: number,
    semanticSimilarity: number,
    intentScore: number,
  ): string {
    if (score >= 0.8) {
      return `Answer is highly relevant (semantic: ${semanticSimilarity.toFixed(2)}, intent: ${intentScore.toFixed(2)})`;
    }
    if (score >= 0.6) {
      return `Answer is moderately relevant (semantic: ${semanticSimilarity.toFixed(2)}, intent: ${intentScore.toFixed(2)})`;
    }
    if (score >= 0.4) {
      return `Answer may not fully address the query (semantic: ${semanticSimilarity.toFixed(2)}, intent: ${intentScore.toFixed(2)})`;
    }
    return `Answer appears irrelevant to the query (semantic: ${semanticSimilarity.toFixed(2)}, intent: ${intentScore.toFixed(2)})`;
  }
}
