/**
 * Shared text utilities for heuristic (lexical) metric scorers.
 *
 * These helpers were previously duplicated across the faithfulness, relevance,
 * context-precision, and context-recall scorers. They are intentionally
 * lightweight and English-oriented — see the README for the limitations of
 * lexical scoring and when to prefer the LLM judge or an embedding provider.
 */

/** English stop words filtered out before computing lexical overlap. */
export const STOP_WORDS: ReadonlySet<string> = new Set([
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
  'having',
  'do',
  'does',
  'did',
  'doing',
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
  'ought',
]);

/** Extract lowercase alphabetic word tokens from text. */
export function getWords(text: string): string[] {
  return text.match(/[a-z]+/g) ?? [];
}

/**
 * Normalize a word by stripping common English inflections.
 * A deliberately cheap stemmer — good enough for keyword-overlap heuristics.
 */
export function normalizeWord(word: string): string {
  const len = word.length;
  if (len <= 3) return word;
  if (word.endsWith('ing') && len > 4) return word.slice(0, -3);
  if (word.endsWith('ed') && len > 4) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && len > 3) return word.slice(0, -1);
  return word;
}

/**
 * Get significant words from text: alphabetic tokens and multi-digit numbers,
 * normalized, with stop words and very short tokens removed.
 */
export function getSignificantWords(text: string): string[] {
  const words = getWords(text);
  const numbers = text.match(/\d{2,}/g) ?? [];
  const allTokens = [...words, ...numbers].map((w) => normalizeWord(w));
  return allTokens.filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

/** Split text into sentence-like statements, preserving terminal punctuation. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Build the set of character bigrams for a string. */
export function getBigrams(text: string): Set<string> {
  const bigrams = new Set<string>();
  for (let i = 0; i < text.length - 1; i++) {
    bigrams.add(text.substring(i, i + 2));
  }
  return bigrams;
}

/** Sørensen–Dice coefficient between two bigram sets (0–1). */
export function diceCoefficient(bigrams1: Set<string>, bigrams2: Set<string>): number {
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

/** Cosine similarity between two equal-length numeric vectors (0–1 for non-negative inputs). */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
