import { writeFileSync } from 'node:fs';
import { DatasetLoader } from '@reaatech/rag-eval-dataset';
import { JudgeEngine, type JudgeMetric } from '@reaatech/rag-eval-judge';
import { Command } from 'commander';

const VALID_METRICS: JudgeMetric[] = [
  'faithfulness',
  'relevance',
  'context_precision',
  'context_recall',
  'overall',
];

export function createJudgeCommand(): Command {
  const command = new Command('judge');
  command.description('Run LLM judge on samples from a dataset');
  command.requiredOption('-d, --dataset <path>', 'Path to evaluation dataset');
  command.option('-m, --model <model>', 'Model to use for judging', JudgeEngine.DEFAULT_MODEL);
  command.option('--metric <metric>', `Judge metric: ${VALID_METRICS.join(' | ')}`, 'overall');
  command.option('-o, --output <path>', 'Path to output results file (JSON)');

  command.action(async (options) => {
    const metric = options.metric as JudgeMetric;
    if (!VALID_METRICS.includes(metric)) {
      console.error(`Invalid metric '${metric}'. Valid: ${VALID_METRICS.join(', ')}`);
      process.exit(1);
    }

    const loader = new DatasetLoader();
    const samples = await loader.load(options.dataset);
    console.log(`Loaded ${samples.length} samples`);
    console.log(`Model: ${options.model}, metric: ${metric}`);

    const engine = new JudgeEngine({ model: options.model });
    const results = await engine.evaluateBatch(samples, metric);

    const payload = {
      model: options.model,
      metric,
      total: results.length,
      avg_score:
        results.length > 0 ? results.reduce((sum, r) => sum + r.score, 0) / results.length : 0,
      results,
    };

    if (options.output) {
      writeFileSync(options.output, JSON.stringify(payload, null, 2));
      console.log(`Results written to: ${options.output}`);
    }

    console.log(`Average ${metric} score: ${payload.avg_score.toFixed(3)}`);
  });

  return command;
}
