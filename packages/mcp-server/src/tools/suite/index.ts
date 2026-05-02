import type { EvalResults, EvalSuiteConfig, EvaluationSample } from '@reaatech/rag-eval-core';
import { EvaluationSuite } from '@reaatech/rag-eval-suite';

export interface SuiteRunInput {
  samples: EvaluationSample[];
  config: EvalSuiteConfig;
}

export interface StatusInput {
  run_id: string;
}

export interface CompareInput {
  baseline_run?: EvalResults;
  candidate_run?: EvalResults;
  baseline?: EvalResults;
  candidate?: EvalResults;
}

const activeRuns = new Map<
  string,
  { status: string; progress: number; results?: EvalResults; error?: string }
>();

export function createSuiteTools(): Array<{
  name: string;
  description: string;
  inputSchema: object;
}> {
  return [
    {
      name: 'rag_eval.suite.run',
      description: 'Execute full evaluation suite',
      inputSchema: {
        type: 'object',
        properties: {
          samples: {
            type: 'array',
            items: { type: 'object' },
            description: 'Evaluation samples',
          },
          config: {
            type: 'object',
            description: 'Evaluation configuration',
          },
        },
        required: ['samples', 'config'],
      },
    },
    {
      name: 'rag_eval.suite.status',
      description: 'Get evaluation run status',
      inputSchema: {
        type: 'object',
        properties: {
          run_id: { type: 'string', description: 'Run ID to check' },
        },
        required: ['run_id'],
      },
    },
    {
      name: 'rag_eval.suite.results',
      description: 'Retrieve evaluation results',
      inputSchema: {
        type: 'object',
        properties: {
          run_id: { type: 'string', description: 'Run ID to retrieve' },
        },
        required: ['run_id'],
      },
    },
    {
      name: 'rag_eval.suite.compare',
      description: 'Compare two evaluation runs',
      inputSchema: {
        type: 'object',
        properties: {
          baseline_run: { type: 'object', description: 'Baseline evaluation results' },
          candidate_run: { type: 'object', description: 'Candidate evaluation results' },
        },
        required: ['baseline_run', 'candidate_run'],
      },
    },
    {
      name: 'rag_eval.suite.baseline',
      description: 'Set baseline for regression comparison',
      inputSchema: {
        type: 'object',
        properties: {
          run_id: { type: 'string', description: 'Run ID to set as baseline' },
          name: { type: 'string', description: 'Baseline name' },
        },
        required: ['run_id'],
      },
    },
  ];
}

export async function handleSuiteTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ content: { type: string; text: string }[] }> {
  switch (name) {
    case 'rag_eval.suite.run': {
      const input = args as unknown as SuiteRunInput;
      const runId = `eval-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      activeRuns.set(runId, { status: 'running', progress: 0 });

      const suite = new EvaluationSuite(input.config);
      suite
        .run(input.samples, runId)
        .then((result) => {
          activeRuns.set(runId, { status: 'completed', progress: 100, results: result.results });
        })
        .catch((error: Error) => {
          activeRuns.set(runId, { status: 'failed', progress: 0, error: error.message });
        });

      return {
        content: [
          { type: 'text', text: JSON.stringify({ run_id: runId, status: 'running' }, null, 2) },
        ],
      };
    }

    case 'rag_eval.suite.status': {
      const input = args as unknown as StatusInput;
      const run = activeRuns.get(input.run_id);
      if (!run) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Run not found' }, null, 2) }],
        };
      }
      return {
        content: [
          { type: 'text', text: JSON.stringify({ run_id: input.run_id, ...run }, null, 2) },
        ],
      };
    }

    case 'rag_eval.suite.results': {
      const input = args as unknown as StatusInput;
      const run = activeRuns.get(input.run_id);
      if (!run) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Run not found' }, null, 2) }],
        };
      }
      if (run.status !== 'completed') {
        return {
          content: [
            { type: 'text', text: JSON.stringify({ error: 'Run not completed' }, null, 2) },
          ],
        };
      }
      return { content: [{ type: 'text', text: JSON.stringify(run.results, null, 2) }] };
    }

    case 'rag_eval.suite.compare': {
      const input = args as unknown as CompareInput;
      const suite = new EvaluationSuite({ metrics: [] });
      const baseline = input.baseline ?? input.baseline_run;
      const candidate = input.candidate ?? input.candidate_run;
      if (!baseline || !candidate) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: 'Baseline and candidate results required' }, null, 2),
            },
          ],
        };
      }
      const diff = suite.compareRuns(baseline, candidate);
      return { content: [{ type: 'text', text: JSON.stringify(diff, null, 2) }] };
    }

    case 'rag_eval.suite.baseline': {
      const input = args as unknown as { run_id: string; name?: string };
      const run = activeRuns.get(input.run_id);
      if (!run || run.status !== 'completed') {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: 'Run not found or not completed' }, null, 2),
            },
          ],
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { baseline_id: input.run_id, name: input.name ?? input.run_id },
              null,
              2,
            ),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown suite tool: ${name}`);
  }
}
