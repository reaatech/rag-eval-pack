/**
 * Judge prompt templates for LLM-as-judge evaluation
 */

/** Prompt template variables */
export interface PromptVariables {
  query?: string;
  context?: string;
  ground_truth?: string;
  generated_answer?: string;
}

/** Prompt template */
export interface PromptTemplate {
  system: string;
  user: string;
}

/**
 * Faithfulness evaluation prompt
 */
export const FAITHFULNESS_PROMPT: PromptTemplate = {
  system: `You are an expert evaluator of RAG (Retrieval-Augmented Generation) systems.
Your task is to evaluate whether a generated answer is faithful to the provided context.
A faithful answer only contains information that can be inferred from or is explicitly stated in the context.
An unfaithful answer contains hallucinations, fabrications, or information not supported by the context.

Rate the faithfulness on a scale from 0 to 1, where:
- 1.0 means ALL claims in the answer are fully supported by the context
- 0.5 means SOME claims are supported but others are not
- 0.0 means NO claims are supported or the answer contradicts the context

Provide your rating along with a clear explanation.`,

  user: `Context:
"""
{{context}}
"""

Generated Answer:
"""
{{generated_answer}}
"""

Rate the faithfulness (0-1) and provide your explanation.
Format your response as:
Score: [0.0-1.0]
Explanation: [your explanation]`,
};

/**
 * Relevance evaluation prompt
 */
export const RELEVANCE_PROMPT: PromptTemplate = {
  system: `You are an expert evaluator of RAG (Retrieval-Augmented Generation) systems.
Your task is to evaluate whether a generated answer is relevant to the user's query.
A relevant answer directly addresses the user's question and provides useful information.
An irrelevant answer does not address the query or provides unrelated information.

Rate the relevance on a scale from 0 to 1, where:
- 1.0 means the answer fully addresses all aspects of the query
- 0.5 means the answer partially addresses the query
- 0.0 means the answer does not address the query at all

Provide your rating along with a clear explanation.`,

  user: `Query:
"""
{{query}}
"""

Generated Answer:
"""
{{generated_answer}}
"""

Rate the relevance (0-1) and provide your explanation.
Format your response as:
Score: [0.0-1.0]
Explanation: [your explanation]`,
};

/**
 * Context precision evaluation prompt
 */
export const CONTEXT_PRECISION_PROMPT: PromptTemplate = {
  system: `You are an expert evaluator of RAG (Retrieval-Augmented Generation) systems.
Your task is to evaluate the quality of retrieved context chunks for answering a query.
Consider whether the most relevant information appears early in the context.

Rate the context precision on a scale from 0 to 1, where:
- 1.0 means all relevant information is at the beginning of the context
- 0.5 means relevant information is mixed throughout
- 0.0 means relevant information is at the end or missing

Provide your rating along with a clear explanation.`,

  user: `Query:
"""
{{query}}
"""

Expected Answer (Ground Truth):
"""
{{ground_truth}}
"""

Retrieved Context Chunks:
{{context}}

Rate the context precision (0-1) and provide your explanation.
Format your response as:
Score: [0.0-1.0]
Explanation: [your explanation]`,
};

/**
 * Context recall evaluation prompt
 */
export const CONTEXT_RECALL_PROMPT: PromptTemplate = {
  system: `You are an expert evaluator of RAG (Retrieval-Augmented Generation) systems.
Your task is to evaluate whether the retrieved context contains all the information needed to answer the query.
Compare the context against the ground truth answer to determine coverage.

Rate the context recall on a scale from 0 to 1, where:
- 1.0 means the context contains ALL information needed to answer the query
- 0.5 means the context contains SOME but not all needed information
- 0.0 means the context is missing most or all needed information

Provide your rating along with a clear explanation.`,

  user: `Query:
"""
{{query}}
"""

Expected Answer (Ground Truth):
"""
{{ground_truth}}
"""

Retrieved Context:
"""
{{context}}
"""

Rate the context recall (0-1) and provide your explanation.
Format your response as:
Score: [0.0-1.0]
Explanation: [your explanation]`,
};

/**
 * Overall quality evaluation prompt
 */
export const OVERALL_QUALITY_PROMPT: PromptTemplate = {
  system: `You are an expert evaluator of RAG (Retrieval-Augmented Generation) systems.
Your task is to provide an overall quality assessment of a generated answer.
Consider faithfulness to context, relevance to query, completeness, and clarity.

Rate the overall quality on a scale from 0 to 1, where:
- 1.0 means excellent quality - faithful, relevant, complete, and clear
- 0.5 means acceptable quality - some issues but generally useful
- 0.0 means poor quality - unfaithful, irrelevant, or misleading

Provide your rating along with a clear explanation.`,

  user: `Query:
"""
{{query}}
"""

Context:
"""
{{context}}
"""

Expected Answer (Ground Truth):
"""
{{ground_truth}}
"""

Generated Answer:
"""
{{generated_answer}}
"""

Rate the overall quality (0-1) and provide your explanation.
Format your response as:
Score: [0.0-1.0]
Explanation: [your explanation]`,
};

/**
 * Apply variables to a prompt template
 */
export function applyPromptTemplate(
  template: PromptTemplate,
  variables: PromptVariables,
): { system: string; user: string } {
  const applyVariables = (text: string): string => {
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      if (value !== undefined) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      }
    }
    // Remove any remaining unfilled placeholders
    result = result.replace(/\{\{[^}]+\}\}/g, '');
    return result;
  };

  return {
    system: applyVariables(template.system),
    user: applyVariables(template.user),
  };
}

/**
 * Parse judge response to extract score and explanation
 */
export function parseJudgeResponse(response: string): { score: number; explanation: string } {
  const scoreMatch = response.match(/Score:\s*([0-9]*\.?[0-9]+)/i);
  const explanationMatch = response.match(/Explanation:\s*(.*)/is);

  const score = scoreMatch ? Number.parseFloat(scoreMatch[1] ?? '0.5') : 0.5;
  const explanation = explanationMatch ? explanationMatch[1]?.trim() : response;

  // Clamp score to [0, 1]
  const clampedScore = Math.max(0, Math.min(1, score));

  return { score: clampedScore, explanation };
}
