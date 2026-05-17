import type { EvaluationSample } from '@reaatech/rag-eval-core';
import {
  ContextPrecisionScorer,
  ContextRecallScorer,
  FaithfulnessScorer,
  RelevanceScorer,
} from '@reaatech/rag-eval-metrics';

export interface FaithfulnessInput {
  context: string[];
  generated_answer: string;
}

export interface RelevanceInput {
  query: string;
  generated_answer: string;
}

export interface ContextPrecisionInput {
  query: string;
  context: string[];
  ground_truth: string;
}

export interface CostCheckInput {
  total_cost: number;
  budget_limit: number;
  samples_evaluated?: number;
}

export function createJudgeTools(): Array<{
  name: string;
  description: string;
  inputSchema: object;
}> {
  return [
    {
      name: 'rag_eval.judge.faithfulness',
      description: 'Score answer faithfulness to context',
      inputSchema: {
        type: 'object',
        properties: {
          context: {
            type: 'array',
            items: { type: 'string' },
            description: 'Retrieved context chunks',
          },
          generated_answer: {
            type: 'string',
            description: 'Generated answer to evaluate',
          },
        },
        required: ['context', 'generated_answer'],
      },
    },
    {
      name: 'rag_eval.judge.relevance',
      description: 'Score answer relevance to query',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'User query' },
          generated_answer: { type: 'string', description: 'Generated answer to evaluate' },
        },
        required: ['query', 'generated_answer'],
      },
    },
    {
      name: 'rag_eval.judge.context_precision',
      description: 'Score context ranking quality',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'User query' },
          context: {
            type: 'array',
            items: { type: 'string' },
            description: 'Retrieved context chunks',
          },
          ground_truth: { type: 'string', description: 'Expected answer for evaluation' },
        },
        required: ['query', 'context', 'ground_truth'],
      },
    },
    {
      name: 'rag_eval.judge.context_recall',
      description: 'Score context coverage of ground truth',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'User query' },
          context: {
            type: 'array',
            items: { type: 'string' },
            description: 'Retrieved context chunks',
          },
          ground_truth: { type: 'string', description: 'Expected answer for evaluation' },
        },
        required: ['query', 'context', 'ground_truth'],
      },
    },
    {
      name: 'rag_eval.judge.cost_check',
      description: 'Verify cost within budget',
      inputSchema: {
        type: 'object',
        properties: {
          total_cost: { type: 'number', description: 'Total cost so far' },
          budget_limit: { type: 'number', description: 'Budget limit' },
          samples_evaluated: { type: 'number', description: 'Number of samples evaluated' },
        },
        required: ['total_cost', 'budget_limit'],
      },
    },
  ];
}

export async function handleJudgeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ content: { type: string; text: string }[] }> {
  switch (name) {
    case 'rag_eval.judge.faithfulness': {
      const input = args as unknown as FaithfulnessInput;
      const scorer = new FaithfulnessScorer();
      const sample: EvaluationSample = {
        query: '',
        context: input.context,
        ground_truth: '',
        generated_answer: input.generated_answer,
      };
      const result = await scorer.score(sample);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    case 'rag_eval.judge.relevance': {
      const input = args as unknown as RelevanceInput;
      const scorer = new RelevanceScorer();
      const sample: EvaluationSample = {
        query: input.query,
        context: [],
        ground_truth: '',
        generated_answer: input.generated_answer,
      };
      const result = await scorer.score(sample);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    case 'rag_eval.judge.context_precision': {
      const input = args as unknown as ContextPrecisionInput;
      const scorer = new ContextPrecisionScorer();
      const sample: EvaluationSample = {
        query: input.query,
        context: input.context,
        ground_truth: input.ground_truth,
        generated_answer: '',
      };
      const result = await scorer.score(sample);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    case 'rag_eval.judge.context_recall': {
      const input = args as unknown as ContextPrecisionInput;
      const scorer = new ContextRecallScorer();
      const sample: EvaluationSample = {
        query: input.query,
        context: input.context,
        ground_truth: input.ground_truth,
        generated_answer: '',
      };
      const result = await scorer.score(sample);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    case 'rag_eval.judge.cost_check': {
      const input = args as unknown as CostCheckInput;
      const totalCost = input.total_cost || 0;
      const budgetLimit = input.budget_limit || Number.POSITIVE_INFINITY;
      const withinBudget = totalCost <= budgetLimit;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                within_budget: withinBudget,
                cost: totalCost,
                budget_limit: budgetLimit,
                remaining: Math.max(0, budgetLimit - totalCost),
                usage_ratio: budgetLimit > 0 ? totalCost / budgetLimit : 0,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown judge tool: ${name}`);
  }
}
