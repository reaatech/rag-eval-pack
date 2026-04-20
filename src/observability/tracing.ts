import { trace, context, Span, SpanStatusCode, Tracer, SpanKind } from '@opentelemetry/api';

const tracer: Tracer = trace.getTracer('rag-eval-pack', '0.1.0');

export interface SpanAttributes {
  run_id?: string;
  sample_id?: string | number;
  metric?: string;
  [key: string]: string | number | boolean | undefined;
}

export function createSpan(name: string, attributes?: SpanAttributes): Span {
  return tracer.startSpan(name, {
    kind: SpanKind.INTERNAL,
    attributes: attributes as Record<string, string | number | boolean>,
  });
}

export function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: SpanAttributes
): Promise<T> {
  const span = createSpan(name, attributes);
  return context.with(trace.setSpan(context.active(), span), async () => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

export function traceEvalRun<T>(runId: string, fn: (span: Span) => Promise<T>): Promise<T> {
  return withSpan('eval.run', fn, { run_id: runId });
}

export function traceMetricCalculation<T>(
  runId: string,
  sampleId: string | number,
  metric: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withSpan(`metric.${metric}`, fn, { run_id: runId, sample_id: sampleId, metric });
}

export function traceJudgeCall<T>(
  runId: string,
  sampleId: string | number,
  model: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withSpan('judge.call', fn, { run_id: runId, sample_id: sampleId, model });
}

export function traceGateEvaluation<T>(runId: string, fn: (span: Span) => Promise<T>): Promise<T> {
  return withSpan('gate.evaluation', fn, { run_id: runId });
}

export function addSpanAttribute(span: Span, key: string, value: string | number | boolean): void {
  span.setAttribute(key, value);
}

export function recordSpanError(span: Span, error: Error): void {
  span.recordException(error);
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.message,
  });
}
