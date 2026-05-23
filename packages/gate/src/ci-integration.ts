import type { EvalResults, GateResult } from '@reaatech/rag-eval-core';

export interface GitHubActionsOutput {
  passed: boolean;
  totalGates: number;
  failedGates: number;
  summary: string;
}

export interface JUnitReport {
  testcase: { name: string; time: string; classname: string };
  failures: number;
  tests: number;
  errors?: number;
}

export interface PRCommentData {
  title: string;
  overallScore: number;
  avgFaithfulness: number;
  avgRelevance: number;
  avgContextPrecision: number;
  avgContextRecall: number;
  gatesPassed: boolean;
  regressions: { metric: string; baseline: number; current: number }[];
  costPerSample?: number;
}

export class CIIntegration {
  generateGitHubActionsOutput(
    gateResult: GateResult,
    _evalResults?: EvalResults,
  ): GitHubActionsOutput {
    return {
      passed: gateResult.passed,
      totalGates: gateResult.gates.length,
      failedGates: gateResult.failures.length,
      summary: gateResult.passed
        ? `All ${gateResult.gates.length} gates passed`
        : `${gateResult.failures.length} of ${gateResult.gates.length} gates failed: ${gateResult.failures.map((f) => f.gate_name).join(', ')}`,
    };
  }

  generateJUnitXml(gateResult: GateResult, _evalResults?: EvalResults): string {
    // `warn`-severity gates are not hard failures.
    const isHardFailure = (g: { passed: boolean; warning?: boolean }) => !g.passed && !g.warning;
    const failedTests = gateResult.gates.filter(isHardFailure).length;

    const testCases = gateResult.gates
      .map(
        (
          gate,
        ) => `    <testcase name="${this.escapeXml(gate.name)}" time="0" classname="GateEvaluation">
      ${isHardFailure(gate) ? `<failure message="${this.escapeXml(gate.message)}">${this.escapeXml(gate.message)}</failure>` : ''}${gate.warning ? `<skipped message="${this.escapeXml(gate.message)}" />` : ''}
    </testcase>`,
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite tests="${gateResult.gates.length}" failures="${failedTests}" name="RAGEvalGates">
${testCases}
</testsuite>`;
  }

  generatePRComment(gateResult: GateResult, evalResults?: EvalResults): string {
    const data = this.extractPRCommentData(gateResult, evalResults);
    const gatesStatus = data.gatesPassed ? '✅ Passed' : '❌ Failed';

    const lines = [
      '## RAG Evaluation Results',
      '',
      `**Overall Score:** ${data.overallScore.toFixed(3)}`,
      `**Faithfulness:** ${data.avgFaithfulness.toFixed(3)}`,
      `**Relevance:** ${data.avgRelevance.toFixed(3)}`,
      `**Context Precision:** ${data.avgContextPrecision.toFixed(3)}`,
      `**Context Recall:** ${data.avgContextRecall.toFixed(3)}`,
      `**Gates:** ${gatesStatus}`,
      '',
    ];

    if (data.regressions.length > 0) {
      lines.push('**Regressions:**');
      for (const reg of data.regressions) {
        lines.push(`- ${reg.metric}: ${reg.baseline.toFixed(3)} → ${reg.current.toFixed(3)}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  generateMarkdownReport(gateResult: GateResult, evalResults?: EvalResults): string {
    const data = this.extractPRCommentData(gateResult, evalResults);

    const lines = [
      '# RAG Evaluation Report',
      '',
      `**Date:** ${new Date().toISOString().split('T')[0]}`,
      `**Overall Score:** ${data.overallScore.toFixed(3)}`,
      '',
      '## Metrics Summary',
      '',
      '| Metric | Score |',
      '|--------|-------|',
      `| Faithfulness | ${data.avgFaithfulness.toFixed(3)} |`,
      `| Relevance | ${data.avgRelevance.toFixed(3)} |`,
      `| Context Precision | ${data.avgContextPrecision.toFixed(3)} |`,
      `| Context Recall | ${data.avgContextRecall.toFixed(3)} |`,
      '',
      '## Gate Results',
      '',
      '| Gate | Result | Details |',
      '|------|--------|---------|',
      ...gateResult.gates.map(
        (g) =>
          `| ${g.name} | ${g.passed ? '✅ Pass' : g.warning ? '⚠️ Warn' : '❌ Fail'} | ${g.message} |`,
      ),
      '',
    ];

    if (gateResult.warnings && gateResult.warnings.length > 0) {
      lines.push(
        `> ⚠️ ${gateResult.warnings.length} warning gate(s) did not pass (non-blocking).`,
        '',
      );
    }

    return lines.join('\n');
  }

  getExitCode(gateResult: GateResult): number {
    return gateResult.passed ? 0 : 1;
  }

  private extractPRCommentData(gateResult: GateResult, evalResults?: EvalResults): PRCommentData {
    if (evalResults) {
      return {
        title: 'RAG Evaluation Results',
        overallScore: evalResults.metrics.overall_score,
        avgFaithfulness: evalResults.metrics.avg_faithfulness,
        avgRelevance: evalResults.metrics.avg_relevance,
        avgContextPrecision: evalResults.metrics.avg_context_precision,
        avgContextRecall: evalResults.metrics.avg_context_recall,
        gatesPassed: gateResult.passed,
        regressions: gateResult.failures.map((f) => ({
          metric: f.metric,
          baseline: f.expected,
          current: f.actual,
        })),
        costPerSample: evalResults.metrics.cost_per_sample,
      };
    }
    return {
      title: 'RAG Evaluation Results',
      overallScore: 0,
      avgFaithfulness: 0,
      avgRelevance: 0,
      avgContextPrecision: 0,
      avgContextRecall: 0,
      gatesPassed: gateResult.passed,
      regressions: gateResult.failures.map((f) => ({
        metric: f.metric,
        baseline: f.expected,
        current: f.actual,
      })),
    };
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
