import type { EvalResults, GateConfig } from '../../../types/domain.js';
import { GateEngine } from '../../../gate/engine.js';
import { EvaluationSuite } from '../../../evaluation-suite.js';

export interface GateRunInput {
  results: EvalResults;
  gate_config: GateConfig[];
  baseline?: EvalResults;
}

export interface ConfigInput {
  action: 'get' | 'set';
  config?: GateConfig[];
}

export interface CompareInput {
  baseline?: EvalResults;
  candidate?: EvalResults;
  baseline_run?: EvalResults;
  candidate_run?: EvalResults;
}

export function createGateTools(): Array<{
  name: string;
  description: string;
  inputSchema: object;
}> {
  return [
    {
      name: 'rag_eval.gate.run',
      description: 'Run CI-style pass/fail gate',
      inputSchema: {
        type: 'object',
        properties: {
          results: { type: 'object', description: 'Evaluation results' },
          gate_config: {
            type: 'array',
            items: { type: 'object' },
            description: 'Gate configurations',
          },
          baseline: {
            type: 'object',
            description: 'Baseline results for comparison',
          },
        },
        required: ['results', 'gate_config'],
      },
    },
    {
      name: 'rag_eval.gate.config',
      description: 'Get/set gate configuration',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['get', 'set'],
            description: 'Action to perform',
          },
          config: {
            type: 'array',
            items: { type: 'object' },
            description: 'Gate configurations (for set action)',
          },
        },
        required: ['action'],
      },
    },
    {
      name: 'rag_eval.gate.diff',
      description: 'Get detailed diff from baseline',
      inputSchema: {
        type: 'object',
        properties: {
          baseline: { type: 'object', description: 'Baseline results' },
          candidate: { type: 'object', description: 'Candidate results' },
        },
        required: ['baseline', 'candidate'],
      },
    },
  ];
}

let storedConfig: GateConfig[] = [];

export async function handleGateTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ content: { type: string; text: string }[] }> {
  switch (name) {
    case 'rag_eval.gate.run': {
      const input = args as unknown as GateRunInput;
      const engine = new GateEngine(input.gate_config);
      if (input.baseline) {
        engine.setBaseline(input.baseline);
      }
      const result = engine.evaluate(input.results);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    case 'rag_eval.gate.config': {
      const input = args as unknown as ConfigInput;
      if (input.action === 'get') {
        return {
          content: [{ type: 'text', text: JSON.stringify({ config: storedConfig }, null, 2) }],
        };
      }
      if (input.config) {
        storedConfig = input.config;
      }
      return { content: [{ type: 'text', text: JSON.stringify({ success: true }, null, 2) }] };
    }

    case 'rag_eval.gate.diff': {
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

    default:
      throw new Error(`Unknown gate tool: ${name}`);
  }
}
