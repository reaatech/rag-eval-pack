import type {
  EvaluationSample,
  FaithfulnessResult,
  StatementSupport,
} from '@reaatech/rag-eval-core';
import { getSignificantWords, splitSentences } from './text-utils.js';

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
      statements.map((statement) => this.checkStatementSupport(statement, contextText)),
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
    const sentences = splitSentences(text);

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
    context: string,
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
    const statementWords = getSignificantWords(statementLower);
    const contextWords = new Set(getSignificantWords(contextLower));

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
