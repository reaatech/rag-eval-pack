import type {
  EvalResults,
  GateConfig,
  GateFailure,
  GateResult,
  IndividualGateResult,
} from '@reaatech/rag-eval-core';

/**
 * Gate Engine
 *
 * Evaluates CI-style pass/fail gates against evaluation results.
 * Supports threshold gates and baseline comparison gates.
 */
export class GateEngine {
  private gates: GateConfig[] = [];
  private baselineResults: EvalResults | null = null;

  constructor(gates?: GateConfig[]) {
    if (gates) {
      this.gates = gates;
    }
  }

  /**
   * Load gates from configuration array
   */
  loadGates(gates: GateConfig[]): void {
    this.gates = [...gates];
  }

  /**
   * Set baseline results for comparison
   */
  setBaseline(baseline: EvalResults): void {
    this.baselineResults = baseline;
  }

  /**
   * Evaluate all gates against results
   */
  evaluate(results: EvalResults, baseline?: EvalResults): GateResult {
    const baselineToUse = baseline ?? this.baselineResults;
    const individualResults: IndividualGateResult[] = [];
    const failures: GateFailure[] = [];

    for (const gate of this.gates) {
      const result = this.evaluateGate(gate, results, baselineToUse);
      individualResults.push(result);

      if (!result.passed) {
        failures.push({
          gate_name: gate.name,
          metric: gate.metric,
          actual: result.actual_value,
          expected: result.expected_value ?? 0,
          difference: result.actual_value - (result.expected_value ?? 0),
        });
      }
    }

    return {
      passed: failures.length === 0,
      gates: individualResults,
      failures,
      evaluated_at: new Date().toISOString(),
    };
  }

  /**
   * Evaluate a single gate
   */
  private evaluateGate(
    gate: GateConfig,
    results: EvalResults,
    baseline?: EvalResults | null,
  ): IndividualGateResult {
    const actualValue = this.getMetricValue(gate.metric, results);

    if (gate.type === 'threshold') {
      return this.evaluateThresholdGate(gate, actualValue);
    }

    if (gate.type === 'baseline-comparison' && baseline) {
      return this.evaluateBaselineGate(gate, actualValue, baseline);
    }

    return {
      name: gate.name,
      passed: true,
      actual_value: actualValue,
      message: `Gate type '${gate.type}' requires baseline for comparison`,
    };
  }

  /**
   * Evaluate a threshold gate
   */
  private evaluateThresholdGate(gate: GateConfig, actualValue: number): IndividualGateResult {
    const threshold = gate.threshold ?? 0;
    const operator = gate.operator ?? '>=';

    let passed = false;
    let message = '';

    switch (operator) {
      case '>=':
        passed = actualValue >= threshold;
        message = passed
          ? `${gate.metric} (${actualValue.toFixed(3)}) >= ${threshold}`
          : `${gate.metric} (${actualValue.toFixed(3)}) < ${threshold} (required >= ${threshold})`;
        break;
      case '<=':
        passed = actualValue <= threshold;
        message = passed
          ? `${gate.metric} (${actualValue.toFixed(3)}) <= ${threshold}`
          : `${gate.metric} (${actualValue.toFixed(3)}) > ${threshold} (required <= ${threshold})`;
        break;
      case '>':
        passed = actualValue > threshold;
        message = passed
          ? `${gate.metric} (${actualValue.toFixed(3)}) > ${threshold}`
          : `${gate.metric} (${actualValue.toFixed(3)}) <= ${threshold} (required > ${threshold})`;
        break;
      case '<':
        passed = actualValue < threshold;
        message = passed
          ? `${gate.metric} (${actualValue.toFixed(3)}) < ${threshold}`
          : `${gate.metric} (${actualValue.toFixed(3)}) >= ${threshold} (required < ${threshold})`;
        break;
      case '==':
        passed = Math.abs(actualValue - threshold) < 0.001;
        message = passed
          ? `${gate.metric} (${actualValue.toFixed(3)}) == ${threshold}`
          : `${gate.metric} (${actualValue.toFixed(3)}) != ${threshold}`;
        break;
    }

    return {
      name: gate.name,
      passed,
      actual_value: actualValue,
      expected_value: threshold,
      message,
    };
  }

  /**
   * Evaluate a baseline comparison gate
   */
  private evaluateBaselineGate(
    gate: GateConfig,
    candidateValue: number,
    baseline: EvalResults,
  ): IndividualGateResult {
    const baselineValue = this.getMetricValue(gate.metric, baseline);
    const diff = candidateValue - baselineValue;
    const allowRegression = gate.allow_regression ?? false;
    const minImprovement = gate.min_improvement ?? 0;

    let passed = false;
    let message = '';

    if (allowRegression) {
      // Any change is allowed
      passed = true;
      message = `${gate.metric}: ${baselineValue.toFixed(3)} -> ${candidateValue.toFixed(3)} (diff: ${diff.toFixed(3)})`;
    } else if (diff >= minImprovement) {
      // Must improve by at least minImprovement
      passed = true;
      message = `${gate.metric}: ${baselineValue.toFixed(3)} -> ${candidateValue.toFixed(3)} (improved by ${diff.toFixed(3)})`;
    } else {
      passed = false;
      message = `${gate.metric}: ${baselineValue.toFixed(3)} -> ${candidateValue.toFixed(3)} (regression of ${Math.abs(diff).toFixed(3)}, minimum improvement required: ${minImprovement})`;
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

  /**
   * Get metric value from results
   */
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
      case 'cost_per_eval':
        return results.total_cost / (metrics.total_samples || 1);
      case 'total_cost':
        return results.total_cost;
      default:
        if (metrics.std_dev && metric in metrics.std_dev) {
          return metrics.std_dev[metric as keyof typeof metrics.std_dev] || 0;
        }
        throw new Error(
          `Unknown metric: '${metric}'. Valid metrics: avg_faithfulness, avg_relevance, avg_context_precision, avg_context_recall, overall_score, cost_per_sample, cost_per_eval, total_cost`,
        );
    }
  }

  /**
   * Get all configured gates
   */
  getGates(): GateConfig[] {
    return [...this.gates];
  }

  /**
   * Add a gate
   */
  addGate(gate: GateConfig): void {
    this.gates.push(gate);
  }

  /**
   * Remove a gate by name
   */
  removeGate(name: string): void {
    this.gates = this.gates.filter((g) => g.name !== name);
  }

  /**
   * Clear all gates
   */
  clearGates(): void {
    this.gates = [];
  }

  /**
   * Clear baseline
   */
  clearBaseline(): void {
    this.baselineResults = null;
  }
}
