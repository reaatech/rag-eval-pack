/* eslint-disable no-console */
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { EvaluationSuite } from '../../evaluation-suite.js';

export function createCompareCommand(): Command {
  const command = new Command('compare');
  command.description('Compare two evaluation runs');
  command.requiredOption('-b, --baseline <path>', 'Path to baseline results file');
  command.requiredOption('-c, --candidate <path>', 'Path to candidate results file');
  command.option('-o, --output <path>', 'Path to output diff file', 'diff.json');

  command.action(async (options) => {
    const baselineContent = readFileSync(options.baseline, 'utf-8');
    const candidateContent = readFileSync(options.candidate, 'utf-8');

    const baseline = JSON.parse(baselineContent);
    const candidate = JSON.parse(candidateContent);

    const suite = new EvaluationSuite({ metrics: [] });
    const diff = suite.compareRuns(baseline, candidate);

    const { writeFileSync } = await import('fs');
    writeFileSync(options.output, JSON.stringify(diff, null, 2));

    console.log('Comparison Results:');
    console.log('-------------------');

    if (diff.regressions.length > 0) {
      console.log('\n❌ Regressions:');
      for (const reg of diff.regressions) {
        console.log(`  - ${reg}`);
      }
    }

    if (diff.improvements.length > 0) {
      console.log('\n✅ Improvements:');
      for (const imp of diff.improvements) {
        console.log(`  - ${imp}`);
      }
    }

    if (diff.regressions.length === 0 && diff.improvements.length === 0) {
      console.log('\nNo significant changes detected.');
    }

    console.log(`\nDiff saved to: ${options.output}`);
  });

  return command;
}
