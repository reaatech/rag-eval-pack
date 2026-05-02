import { existsSync, readFileSync } from 'node:fs';
import type { GateConfig } from '@reaatech/rag-eval-core';
import { GateEngine } from '@reaatech/rag-eval-gate';
import { Command } from 'commander';
import { parse as parseYaml } from 'yaml';

export function createGateCommand(): Command {
  const command = new Command('gate');
  command.description('Run CI gates against evaluation results');
  command.requiredOption('-r, --results <path>', 'Path to evaluation results file');
  command.option('-g, --gates <path>', 'Path to gates config file (YAML or JSON)');
  command.option('-b, --baseline <path>', 'Path to baseline results file for comparison');

  command.action(async (options) => {
    const resultsContent = readFileSync(options.results, 'utf-8');
    const results = JSON.parse(resultsContent);

    let gates: GateConfig[] = [];
    if (options.gates && existsSync(options.gates)) {
      const gatesContent = readFileSync(options.gates, 'utf-8');
      const parsed = parseYaml(gatesContent);
      gates = parsed.gates || parsed;
    }

    let baseline = null;
    if (options.baseline && existsSync(options.baseline)) {
      const baselineContent = readFileSync(options.baseline, 'utf-8');
      baseline = JSON.parse(baselineContent);
    }

    const engine = new GateEngine(gates);
    if (baseline) {
      engine.setBaseline(baseline);
    }

    const gateResult = engine.evaluate(results);

    console.log(`Gates: ${gateResult.passed ? '✅ PASSED' : '❌ FAILED'}`);

    for (const gate of gateResult.gates) {
      const icon = gate.passed ? '✅' : '❌';
      console.log(`  ${icon} ${gate.name}: ${gate.message}`);
    }

    if (!gateResult.passed) {
      process.exit(1);
    }
  });

  return command;
}
