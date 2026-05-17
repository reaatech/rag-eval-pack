import { readFileSync } from 'node:fs';
import { CIIntegration, GateEngine } from '@reaatech/rag-eval-gate';
import { Command } from 'commander';
import { parse as parseYaml } from 'yaml';

export function createReportCommand(): Command {
  const command = new Command('report');
  command.description('Generate evaluation reports');
  command.requiredOption('-r, --results <path>', 'Path to evaluation results file');
  command.option('-o, --output <path>', 'Path to output report file');
  command.option('-f, --format <format>', 'Report format (markdown, json, junit)', 'markdown');
  command.option('-g, --gates <path>', 'Path to gates config file (for gate reporting)');

  command.action(async (options) => {
    const content = readFileSync(options.results, 'utf-8');
    const results = JSON.parse(content);

    const ci = new CIIntegration();
    let report = '';

    if (options.format === 'markdown') {
      if (options.gates) {
        const gatesContent = readFileSync(options.gates, 'utf-8');
        const gates = parseGateConfig(gatesContent);
        const engine = new GateEngine(gates);
        const gateResult = engine.evaluate(results);
        report = ci.generateMarkdownReport(gateResult, results);
      } else if (results.gate_result) {
        report = ci.generateMarkdownReport(results.gate_result, results);
      } else {
        report = generateBasicMarkdownReport(results);
      }
    } else if (options.format === 'junit') {
      const gateResult = results.gate_result || { passed: true, gates: [], failures: [] };
      report = ci.generateJUnitXml(gateResult, results);
    } else {
      report = JSON.stringify(results, null, 2);
    }

    if (options.output) {
      const { writeFileSync } = await import('node:fs');
      writeFileSync(options.output, report);
      console.log(`Report saved to: ${options.output}`);
    } else {
      console.log(report);
    }
  });

  return command;
}

function parseGateConfig(content: string): import('@reaatech/rag-eval-core').GateConfig[] {
  try {
    const parsed = JSON.parse(content);
    return parsed.gates ?? parsed;
  } catch {
    const parsed = parseYaml(content) as { gates?: import('@reaatech/rag-eval-core').GateConfig[] };
    return parsed.gates ?? (parsed as import('@reaatech/rag-eval-core').GateConfig[]);
  }
}

function generateBasicMarkdownReport(
  results: import('@reaatech/rag-eval-core').EvalResults,
): string {
  const metrics = results.metrics;
  return `# RAG Evaluation Report

**Run ID:** ${results.run_id}
**Date:** ${results.completed_at || new Date().toISOString()}

## Metrics Summary

| Metric | Value |
|--------|-------|
| Overall Score | ${metrics.overall_score?.toFixed(3) || 'N/A'} |
| Faithfulness | ${metrics.avg_faithfulness?.toFixed(3) || 'N/A'} |
| Relevance | ${metrics.avg_relevance?.toFixed(3) || 'N/A'} |
| Context Precision | ${metrics.avg_context_precision?.toFixed(3) || 'N/A'} |
| Context Recall | ${metrics.avg_context_recall?.toFixed(3) || 'N/A'} |
| Cost per Sample | $${metrics.cost_per_sample?.toFixed(6) || '0.000000'} |

**Total Samples:** ${metrics.total_samples || 0}
**Total Cost:** $${results.total_cost?.toFixed(4) || '0.0000'}
**Duration:** ${results.duration_ms ? `${(results.duration_ms / 1000).toFixed(2)}s` : 'N/A'}
`;
}
