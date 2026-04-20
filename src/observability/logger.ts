import pino from 'pino';

/**
 * Structured logger for rag-eval-pack
 *
 * Provides JSON logging with PII redaction and run ID tracking.
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

const pinoOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      '**.context',
      '**.query',
      '**.generated_answer',
      '**.ground_truth',
      '*.context',
      '*.query',
      '*.generated_answer',
      '*.ground_truth',
    ],
    censor: '[REDACTED]',
  },
};

if (isDevelopment) {
  pinoOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
    },
  } as pino.TransportSingleOptions;
}

export const logger = pino(pinoOptions);

/**
 * Create a child logger with run ID
 */
export function createRunLogger(runId: string): pino.Logger {
  return logger.child({ run_id: runId, service: 'rag-eval-pack' });
}

/**
 * Log evaluation start
 */
export function logEvalStart(runId: string, sampleCount: number): void {
  logger.info(
    {
      run_id: runId,
      service: 'rag-eval-pack',
      event: 'eval_start',
      sample_count: sampleCount,
    },
    'Evaluation started'
  );
}

/**
 * Log evaluation complete
 */
export function logEvalComplete(
  runId: string,
  metrics: {
    avg_faithfulness: number;
    avg_relevance: number;
    avg_context_precision: number;
    avg_context_recall: number;
    overall_score: number;
  },
  cost: number,
  durationMs: number
): void {
  logger.info(
    {
      run_id: runId,
      service: 'rag-eval-pack',
      event: 'eval_complete',
      ...metrics,
      cost,
      duration_ms: durationMs,
    },
    'Evaluation completed'
  );
}

/**
 * Log gate result
 */
export function logGateResult(
  runId: string,
  passed: boolean,
  failures: Array<{ gate_name: string; metric: string }>
): void {
  logger.info(
    {
      run_id: runId,
      service: 'rag-eval-pack',
      event: 'gate_result',
      passed,
      failures,
    },
    `Gates ${passed ? 'passed' : 'failed'}`
  );
}

/**
 * Log error
 */
export function logError(
  runId: string | undefined,
  error: Error,
  context?: Record<string, unknown>
): void {
  logger.error(
    {
      run_id: runId,
      service: 'rag-eval-pack',
      event: 'error',
      error: error.message,
      stack: error.stack,
      ...context,
    },
    'Error occurred'
  );
}
