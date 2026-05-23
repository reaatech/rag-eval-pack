/**
 * Metrics module exports
 */

export {
  AnswerCorrectnessScorer,
  type AnswerCorrectnessScorerOptions,
} from './answer-correctness.js';
export { ContextPrecisionScorer } from './context-precision.js';
export { ContextRecallScorer } from './context-recall.js';
export { MetricsEngine } from './engine.js';
export { FaithfulnessScorer } from './faithfulness.js';
export { RelevanceScorer, type RelevanceScorerOptions } from './relevance.js';
export { RetrievalScorer, type RetrievalScorerOptions } from './retrieval.js';
export {
  cosineSimilarity,
  diceCoefficient,
  getBigrams,
  getSignificantWords,
  getWords,
  normalizeWord,
  STOP_WORDS,
  splitSentences,
} from './text-utils.js';
