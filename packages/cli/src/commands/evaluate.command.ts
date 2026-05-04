import { existsSync } from 'node:fs';
import type { EvalSuiteConfig } from '@reaatech/rag-eval-core';
import { loadEvalConfig } from '@reaatech/rag-eval-dataset';
import { EvaluationSuite } from '@reaatech/rag-eval-suite';
import { Command } from 'commander';

export function createEvaluateCommand(): Command {
  const command = new Command('evaluate');
  command.description('Run evaluation suite on a dataset');
  command.requiredOption(
    '-d, --dataset <path>',
    'Path to evaluation dataset (JSONL, JSON, or YAML)',
  );
  command.option('-c, --config <path>', 'Path to evaluation config file (YAML or JSON)');
  command.option('-o, --output <path>', 'Path to output results file', 'results.json');
  command.option('-f, --format <format>', 'Output format (json, markdown)', 'json');
  command.option('--no-judge', 'Disable LLM judge (heuristic metrics only)');

  command.action(async (options) => {
    let config: EvalSuiteConfig = {
      metrics: ['faithfulness', 'relevance', 'context_precision', 'context_recall'],
    };

    if (options.config && existsSync(options.config)) {
      config = await loadEvalConfig(options.config);
    }

    if (options.noJudge) {
      config.judge = { ...config.judge, enabled: false };
    }

    const suite = new EvaluationSuite(config);
    const result = await suite.runFromFile(options.dataset);

    const { writeFileSync } = await import('node:fs');
    const formats = parseFormats(options.format);
    const payload = { ...result.results, gate_result: result.gate_result };

    for (const format of formats) {
      const outputPath = getOutputPath(options.output, format, formats.length > 1);
      if (format === 'markdown') {
        writeFileSync(outputPath, generateMarkdownReport(result.results));
      } else {
        writeFileSync(outputPath, JSON.stringify(payload, null, 2));
      }
    }

    console.log(`Evaluation completed: ${options.output}`);
    console.log(`Overall Score: ${result.results.metrics.overall_score}`);
    console.log(`Faithfulness: ${result.results.metrics.avg_faithfulness}`);
    console.log(`Relevance: ${result.results.metrics.avg_relevance}`);
    console.log(`Context Precision: ${result.results.metrics.avg_context_precision}`);
    console.log(`Context Recall: ${result.results.metrics.avg_context_recall}`);

    if (result.gate_result) {
      console.log(`\nGates: ${result.gate_result.passed ? '✅ PASSED' : '❌ FAILED'}`);
      if (!result.gate_result.passed) {
        for (const failure of result.gate_result.failures) {
          console.log(`  - ${failure.gate_name}: ${failure.metric}`);
        }
        process.exit(1);
      }
    }
  });

  return command;
}

function parseFormats(input: string): Array<'json' | 'markdown'> {
  const formats = input
    .split(',')
    .map((format) => format.trim().toLowerCase())
    .filter((format): format is 'json' | 'markdown' => format === 'json' || format === 'markdown');

  return formats.length > 0 ? [...new Set(formats)] : ['json'];
}

function getOutputPath(
  requestedPath: string,
  format: 'json' | 'markdown',
  multipleFormats: boolean,
): string {
  if (!multipleFormats) {
    return requestedPath;
  }

  const extension = format === 'markdown' ? '.md' : '.json';
  const suffixPattern = /\.(json|md|markdown)$/i;
  if (suffixPattern.test(requestedPath)) {
    return requestedPath.replace(suffixPattern, extension);
  }
  return `${requestedPath}${extension}`;
}

function generateMarkdownReport(results: import('@reaatech/rag-eval-core').EvalResults): string {
  const metrics = results.metrics;
  const lines: string[] = [];

  lines.push('# RAG Evaluation Report');
  lines.push('');
  lines.push(`**Run ID:** ${results.run_id}`);
  lines.push(`**Evaluated:** ${results.evaluated_at}`);
  lines.push('');
  lines.push('## Overall Results');
  lines.push('');
  lines.push('| Metric | Score |');
  lines.push('|--------|-------|');
  lines.push(`| Overall | ${metrics.overall_score?.toFixed(3) || 'N/A'} |`);
  lines.push(`| Faithfulness | ${metrics.avg_faithfulness?.toFixed(3) || 'N/A'} |`);
  lines.push(`| Relevance | ${metrics.avg_relevance?.toFixed(3) || 'N/A'} |`);
  lines.push(`| Context Precision | ${metrics.avg_context_precision?.toFixed(3) || 'N/A'} |`);
  lines.push(`| Context Recall | ${metrics.avg_context_recall?.toFixed(3) || 'N/A'} |`);
  lines.push(`| Cost per Sample | $${metrics.cost_per_sample?.toFixed(6) || '0.000000'} |`);
  lines.push('');
  lines.push(`**Total Samples:** ${metrics.total_samples}`);
  lines.push(`**Total Cost:** $${results.total_cost?.toFixed(4) || '0.0000'}`);

  return lines.join('\n');
}
