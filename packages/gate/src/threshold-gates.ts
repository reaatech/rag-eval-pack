import type { GateConfig, IndividualGateResult } from '@reaatech/rag-eval-core';

export interface ThresholdGateConfig extends GateConfig {
  type: 'threshold';
  operator: '>=' | '<=' | '>' | '<' | '==';
  threshold: number;
}

export class ThresholdGates {
  evaluate(gate: ThresholdGateConfig, actualValue: number): IndividualGateResult {
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

  evaluateAll(
    gates: ThresholdGateConfig[],
    getMetricValue: (metric: string) => number,
  ): IndividualGateResult[] {
    return gates.map((gate) => this.evaluate(gate, getMetricValue(gate.metric)));
  }
}
