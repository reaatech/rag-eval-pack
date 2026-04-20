import type { EvaluationSample, ContextRecallResult, FactCoverage } from '../types/domain.js';

/**
 * Context Recall Scorer
 *
 * Measures whether the retrieved context contains all the information needed
 * to answer the query, as defined by the ground truth. Evaluates if the
 * retrieval system is finding the right documents.
 */
export class ContextRecallScorer {
  /**
   * Score context recall for a single sample
   */
  async score(sample: EvaluationSample): Promise<ContextRecallResult> {
    const { context, ground_truth } = sample;
    const contextText = context.join(' ');

    // Extract facts from ground truth
    const facts = this.extractFacts(ground_truth);

    // Check coverage of each fact in the context
    const factCoverage: FactCoverage[] = await Promise.all(
      facts.map((fact) => this.checkFactCoverage(fact, contextText))
    );

    const coveredFacts = factCoverage.filter((f) => f.covered).length;
    const totalFacts = facts.length;
    const score = totalFacts > 0 ? coveredFacts / totalFacts : 0;

    return {
      score: Math.round(score * 1000) / 1000,
      total_facts: totalFacts,
      covered_facts: coveredFacts,
      facts: factCoverage,
      explanation: this.generateExplanation(score, coveredFacts, totalFacts, factCoverage),
    };
  }

  /**
   * Score context recall for multiple samples
   */
  async scoreBatch(samples: EvaluationSample[]): Promise<ContextRecallResult[]> {
    return Promise.all(samples.map((sample) => this.score(sample)));
  }

  /**
   * Extract atomic facts from ground truth text
   * Facts are meaningful pieces of information that should be present in context
   */
  private extractFacts(text: string): string[] {
    // Split by common fact separators
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // For each sentence, extract key information
    const facts: string[] = [];

    for (const sentence of sentences) {
      // Extract meaningful phrases
      const phrases = this.extractKeyPhrases(sentence);
      facts.push(...phrases);
    }

    // If no phrases extracted, use the whole text as one fact
    if (facts.length === 0 && text.trim().length > 0) {
      facts.push(text.trim());
    }

    return facts;
  }

  /**
   * Extract key phrases from a sentence
   */
  private extractKeyPhrases(sentence: string): string[] {
    const phrases: string[] = [];

    // Remove common leading words
    const processed = sentence.replace(/^(the|a|an)\s+/i, '').trim();

    // Extract noun phrases and key information
    // Look for patterns like "X is Y", "X requires Y", etc.
    const patterns = [
      /(\w[\w\s]*?)\s+(is|are|was|were|means|requires|needs|involves)\s+(\w[\w\s]*?)[.!?,;]*/gi,
      /(\w[\w\s]*?)\s+(within|after|before|during|until)\s+(\w[\w\s]*?)[.!?,;]*/gi,
      /(\w[\w\s]*?)\s+(at|in|on|by|with|from|to)\s+(\w[\w\s]*?)[.!?,;]*/gi,
    ];

    for (const pattern of patterns) {
      const matches = processed.match(pattern);
      if (matches) {
        phrases.push(...matches.map((m) => m.trim()));
      }
    }

    // If no pattern matches, extract significant word groups
    if (phrases.length === 0) {
      const words = this.getSignificantWords(processed.toLowerCase());
      if (words.length > 0) {
        // Group words into chunks of 2-3
        for (let i = 0; i < words.length; i += 2) {
          const chunk = words.slice(i, Math.min(i + 3, words.length)).join(' ');
          if (chunk.length > 5) {
            phrases.push(chunk);
          }
        }
      }
    }

    // If still no phrases, use the whole sentence
    if (phrases.length === 0 && processed.length > 0) {
      phrases.push(processed);
    }

    return phrases;
  }

  /**
   * Check if a fact is covered by the context
   */
  private async checkFactCoverage(fact: string, context: string): Promise<FactCoverage> {
    const factLower = fact.toLowerCase();
    const contextLower = context.toLowerCase();

    // Direct match
    if (contextLower.includes(factLower)) {
      return {
        fact,
        covered: true,
        matching_context: this.findMatchingSnippet(factLower, contextLower),
      };
    }

    // Check keyword overlap
    const factWords = this.getSignificantWords(factLower);
    const contextWords = new Set(this.getWords(contextLower));

    if (factWords.length === 0) {
      return {
        fact,
        covered: false,
      };
    }

    const matchedWords = factWords.filter((w) => contextWords.has(w));
    const overlapRatio = matchedWords.length / factWords.length;

    // Consider fact covered if at least 70% of significant words match
    const covered = overlapRatio >= 0.7;

    if (covered) {
      return {
        fact,
        covered,
        matching_context: this.findMatchingSnippet(factLower, contextLower),
      };
    }
    return {
      fact,
      covered,
    };
  }

  /**
   * Find a matching snippet from context
   */
  private findMatchingSnippet(fact: string, context: string): string {
    const factWords = fact.split(/\s+/);
    const contextWords = context.split(/\s+/);

    // Find the best matching window in context
    const windowSize = Math.min(factWords.length + 2, 10);
    let bestMatch = '';
    let bestScore = 0;

    for (let i = 0; i <= contextWords.length - windowSize; i++) {
      const window = contextWords.slice(i, i + windowSize).join(' ');
      const windowLower = window.toLowerCase();

      let score = 0;
      for (const word of factWords) {
        if (windowLower.includes(word.toLowerCase())) {
          score++;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = window;
      }
    }

    return bestMatch || context.substring(0, 100);
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
   * Generate explanation for the context recall score
   */
  private generateExplanation(
    score: number,
    coveredFacts: number,
    totalFacts: number,
    factCoverage: FactCoverage[]
  ): string {
    if (totalFacts === 0) {
      return 'No facts to evaluate in ground truth';
    }

    if (score === 1) {
      return `All ${totalFacts} facts are covered by the retrieved context`;
    }

    if (score === 0) {
      return `None of the ${totalFacts} facts are covered by the retrieved context`;
    }

    const missingFacts = totalFacts - coveredFacts;
    const missingDetails = factCoverage
      .filter((f) => !f.covered)
      .map((f) => f.fact)
      .slice(0, 3)
      .join('; ');

    return `${coveredFacts} of ${totalFacts} facts covered. Missing: ${missingDetails}${missingFacts > 3 ? '...' : ''}`;
  }
}
