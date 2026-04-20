import type { EvaluationSample, FaithfulnessResult, StatementSupport } from '../types/domain.js';

/**
 * Faithfulness Scorer
 *
 * Measures whether a RAG system's generated answer is grounded in and
 * consistent with the retrieved context. Detects hallucination, fabrication,
 * and context drift.
 */
export class FaithfulnessScorer {
  /**
   * Score faithfulness for a single sample
   */
  async score(sample: EvaluationSample): Promise<FaithfulnessResult> {
    const { context, generated_answer } = sample;
    const contextText = context.join(' ');

    // Extract statements from the generated answer
    const statements = this.extractStatements(generated_answer);

    // Check each statement against the context
    const statementSupport: StatementSupport[] = await Promise.all(
      statements.map((statement) => this.checkStatementSupport(statement, contextText))
    );

    const supportedCount = statementSupport.filter((s) => s.supported).length;
    const score = statements.length > 0 ? supportedCount / statements.length : 0;

    return {
      score: Math.round(score * 1000) / 1000,
      statements,
      supported_count: supportedCount,
      total_statements: statements.length,
      statement_support: statementSupport,
      explanation: this.generateExplanation(score, statementSupport),
    };
  }

  /**
   * Score faithfulness for multiple samples
   */
  async scoreBatch(samples: EvaluationSample[]): Promise<FaithfulnessResult[]> {
    return Promise.all(samples.map((sample) => this.score(sample)));
  }

  /**
   * Extract atomic statements from the generated answer
   * Uses simple sentence splitting - can be enhanced with NLP
   */
  private extractStatements(text: string): string[] {
    // Split by sentence-ending punctuation, filter empty strings
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // If no sentences found, treat the whole text as one statement
    if (sentences.length === 0 && text.trim().length > 0) {
      return [text.trim()];
    }

    return sentences;
  }

  /**
   * Check if a statement is supported by the context
   * Uses keyword overlap and semantic heuristics
   */
  private async checkStatementSupport(
    statement: string,
    context: string
  ): Promise<StatementSupport> {
    const statementLower = statement.toLowerCase();
    const contextLower = context.toLowerCase();

    // Check for direct substring match
    if (contextLower.includes(statementLower)) {
      return {
        statement,
        supported: true,
        reasoning: 'Statement found verbatim in context',
      };
    }

    // Check for keyword overlap
    const statementWords = this.getSignificantWords(statementLower);
    const contextWords = new Set(this.getSignificantWords(contextLower));

    if (statementWords.length === 0) {
      return {
        statement,
        supported: false,
        reasoning: 'No significant words to match',
      };
    }

    const matchedWords = statementWords.filter((word) => contextWords.has(word));
    const overlapRatio = matchedWords.length / statementWords.length;

    // Threshold for support - at least 60% of significant words match
    const supported = overlapRatio >= 0.6;

    return {
      statement,
      supported,
      reasoning: supported
        ? `${Math.round(overlapRatio * 100)}% keyword overlap with context`
        : `Only ${Math.round(overlapRatio * 100)}% keyword overlap with context`,
    };
  }

  /**
   * Get significant words (nouns, verbs) from text
   * Filters out stop words
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
      'am',
      'been',
      'being',
      'have',
      'has',
      'had',
      'having',
      'do',
      'does',
      'did',
      'doing',
      'would',
      'should',
      'could',
      'ought',
    ]);

    // Extract words, filter stop words and short words
    return text.match(/[a-z]+/g)?.filter((word) => word.length > 2 && !stopWords.has(word)) ?? [];
  }

  /**
   * Generate explanation for the faithfulness score
   */
  private generateExplanation(score: number, statementSupport: StatementSupport[]): string {
    const total = statementSupport.length;
    const supported = statementSupport.filter((s) => s.supported).length;

    if (total === 0) {
      return 'No statements to evaluate';
    }

    if (score === 1) {
      return `All ${total} statements are supported by the context`;
    }

    if (score === 0) {
      return `None of the ${total} statements are supported by the context`;
    }

    const unsupported = total - supported;
    return `${supported} of ${total} statements supported by context (${unsupported} unsupported)`;
  }
}
