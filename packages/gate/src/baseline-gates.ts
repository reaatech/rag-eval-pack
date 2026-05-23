import type { EvalResults, GateConfig, IndividualGateResult } from '@reaatech/rag-eval-core';

export interface BaselineGateConfig extends GateConfig {
  type: 'baseline-comparison';
  baseline: string;
  allow_regression: boolean;
  min_improvement?: number;
}

export class BaselineGates {
  evaluate(
    gate: BaselineGateConfig,
    candidateValue: number,
    baseline: EvalResults,
  ): IndividualGateResult {
    const baselineValue = this.getMetricValue(gate.metric, baseline);
    const diff = candidateValue - baselineValue;
    const allowRegression = gate.allow_regression ?? false;
    const minImprovement = gate.min_improvement ?? 0;
    const tolerance = gate.tolerance ?? 0;
    // The tolerance band absorbs small regressions (noise).
    const requiredDiff = minImprovement - tolerance;

    let passed = false;
    let message = '';
    const transition = `${gate.metric}: ${baselineValue.toFixed(3)} -> ${candidateValue.toFixed(3)}`;
    const within = tolerance > 0 ? ` (tolerance: ${tolerance.toFixed(3)})` : '';

    if (allowRegression) {
      passed = true;
      message = `${transition} (diff: ${diff.toFixed(3)})`;
    } else if (diff >= requiredDiff) {
      passed = true;
      message =
        diff >= minImprovement
          ? `${transition} (improved by ${diff.toFixed(3)})`
          : `${transition} (within tolerance: ${diff.toFixed(3)})${within}`;
    } else {
      passed = false;
      message = `${transition} (regression of ${Math.abs(diff).toFixed(3)}, minimum improvement required: ${minImprovement}${within})`;
    }

    return {
      name: gate.name,
      passed,
      actual_value: candidateValue,
      expected_value: baselineValue,
      baseline_diff: diff,
      message,
    };
  }

  evaluateAll(
    gates: BaselineGateConfig[],
    candidateResults: EvalResults,
    baseline: EvalResults,
  ): IndividualGateResult[] {
    return gates.map((gate) => {
      const candidateValue = this.getMetricValue(gate.metric, candidateResults);
      return this.evaluate(gate, candidateValue, baseline);
    });
  }

  private getMetricValue(metric: string, results: EvalResults): number {
    const metrics = results.metrics;
    switch (metric) {
      case 'avg_faithfulness':
      case 'avg_faithfulness_score':
        return metrics.avg_faithfulness;
      case 'avg_relevance':
      case 'avg_relevance_score':
        return metrics.avg_relevance;
      case 'avg_context_precision':
        return metrics.avg_context_precision;
      case 'avg_context_recall':
        return metrics.avg_context_recall;
      case 'overall_score':
        return metrics.overall_score;
      case 'cost_per_sample':
        return metrics.cost_per_sample;
      case 'total_cost':
        return results.total_cost;
      default:
        return 0;
    }
  }
}
