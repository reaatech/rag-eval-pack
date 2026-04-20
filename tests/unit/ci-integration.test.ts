import { describe, it, expect } from 'vitest';
import { CIIntegration } from '../../src/gate/ci-integration.js';
import type { GateResult, EvalResults } from '../../src/types/domain.js';

describe('CIIntegration', () => {
  let ci: CIIntegration;

  const mockGateResult: GateResult = {
    passed: false,
    gates: [
      { name: 'faithfulness', passed: true, actual_value: 0.9, message: '0.900 >= 0.85' },
      {
        name: 'relevance',
        passed: false,
        actual_value: 0.7,
        expected_value: 0.8,
        message: '0.700 < 0.80',
      },
    ],
    failures: [
      {
        gate_name: 'relevance',
        metric: 'avg_relevance',
        actual: 0.7,
        expected: 0.8,
        difference: -0.1,
      },
    ],
    evaluated_at: '2024-01-01T00:00:00Z',
  };

  const mockEvalResults: EvalResults = {
    run_id: 'run-1',
    dataset: 'test',
    config: { metrics: [] },
    samples: [],
    metrics: {
      overall_score: 0.82,
      avg_faithfulness: 0.9,
      avg_relevance: 0.7,
      avg_context_precision: 0.78,
      avg_context_recall: 0.85,
      cost_per_sample: 0.04,
      total_samples: 10,
    },
    total_cost: 0.4,
    cost_breakdown: { total: 0.4, by_metric: {}, by_provider: {}, per_sample: [] },
    duration_ms: 1000,
    completed_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    ci = new CIIntegration();
  });

  describe('generateGitHubActionsOutput', () => {
    it('should generate correct output for passed gates', () => {
      const passedResult: GateResult = { ...mockGateResult, passed: true, failures: [] };
      const output = ci.generateGitHubActionsOutput(passedResult);
      expect(output.passed).toBe(true);
      expect(output.totalGates).toBe(2);
      expect(output.failedGates).toBe(0);
    });

    it('should generate correct output for failed gates', () => {
      const output = ci.generateGitHubActionsOutput(mockGateResult);
      expect(output.passed).toBe(false);
      expect(output.totalGates).toBe(2);
      expect(output.failedGates).toBe(1);
      expect(output.summary).toContain('relevance');
    });
  });

  describe('generateJUnitXml', () => {
    it('should generate valid JUnit XML', () => {
      const xml = ci.generateJUnitXml(mockGateResult);
      expect(xml).toContain('testsuite');
      expect(xml).toContain('tests="2"');
      expect(xml).toContain('failures="1"');
      expect(xml).toContain('failure message="0.700 &lt; 0.80"');
    });

    it('should handle passed gates', () => {
      const passedResult: GateResult = {
        passed: true,
        gates: [
          { name: 'faithfulness', passed: true, actual_value: 0.9, message: 'passed' },
          { name: 'relevance', passed: true, actual_value: 0.85, message: 'passed' },
        ],
        failures: [],
        evaluated_at: mockGateResult.evaluated_at,
      };
      const xml = ci.generateJUnitXml(passedResult);
      expect(xml).toContain('failures="0"');
    });
  });

  describe('generatePRComment', () => {
    it('should generate PR comment with metrics', () => {
      const comment = ci.generatePRComment(mockGateResult, mockEvalResults);
      expect(comment).toContain('## RAG Evaluation Results');
      expect(comment).toContain('**Overall Score:** 0.820');
      expect(comment).toContain('**Faithfulness:** 0.900');
      expect(comment).toContain('**Gates:** ❌ Failed');
    });

    it('should include regressions when present', () => {
      const comment = ci.generatePRComment(mockGateResult, mockEvalResults);
      expect(comment).toContain('**Regressions:**');
      expect(comment).toContain('avg_relevance: 0.800 → 0.700');
    });
  });

  describe('generateMarkdownReport', () => {
    it('should generate markdown report', () => {
      const report = ci.generateMarkdownReport(mockGateResult, mockEvalResults);
      expect(report).toContain('# RAG Evaluation Report');
      expect(report).toContain('| Faithfulness | 0.900 |');
      expect(report).toContain('| Gate | Result | Details |');
    });
  });

  describe('getExitCode', () => {
    it('should return 0 for passed gates', () => {
      const passedResult: GateResult = { ...mockGateResult, passed: true };
      expect(ci.getExitCode(passedResult)).toBe(0);
    });

    it('should return 1 for failed gates', () => {
      expect(ci.getExitCode(mockGateResult)).toBe(1);
    });
  });
});
