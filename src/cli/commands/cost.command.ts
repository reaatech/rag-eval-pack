/* eslint-disable no-console */
import { Command } from 'commander';
import { readFileSync } from 'fs';

export function createCostCommand(): Command {
  const command = new Command('cost');
  command.description('Analyze evaluation costs');
  command.requiredOption('-r, --results <path>', 'Path to evaluation results file');
  command.option('-f, --format <format>', 'Output format (json, text)', 'text');

  command.action(async (options) => {
    const content = readFileSync(options.results, 'utf-8');
    const results = JSON.parse(content);

    const totalCost = results.total_cost || 0;
    const totalSamples = results.metrics?.total_samples || 0;
    const costPerSample = totalSamples > 0 ? totalCost / totalSamples : 0;

    if (options.format === 'json') {
      const costData = {
        total_cost: totalCost,
        cost_per_sample: costPerSample,
        total_samples: totalSamples,
      };
      console.log(JSON.stringify(costData, null, 2));
    } else {
      console.log('Cost Analysis:');
      console.log('--------------');
      console.log(`Total Cost: $${totalCost.toFixed(4)}`);
      console.log(`Total Samples: ${totalSamples}`);
      console.log(`Cost per Sample: $${costPerSample.toFixed(6)}`);
    }
  });

  return command;
}
