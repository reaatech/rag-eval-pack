import type { EvaluationSample } from '@reaatech/rag-eval-core';
import { EvaluationSampleSchema } from '@reaatech/rag-eval-core';
import { z } from 'zod';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationWarning {
  field: string;
  message: string;
}

export class DatasetValidator {
  validate(samples: EvaluationSample[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (samples.length === 0) {
      errors.push({ field: 'samples', message: 'Dataset is empty' });
      return { valid: false, errors, warnings };
    }

    const seenQueries = new Set<string>();
    const seenContexts = new Set<string>();

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      if (!sample) continue;

      try {
        EvaluationSampleSchema.parse(sample);
      } catch (e) {
        if (e instanceof z.ZodError) {
          for (const err of e.errors) {
            errors.push({
              field: `samples[${i}].${err.path.join('.')}`,
              message: err.message,
              value: err.code,
            });
          }
        }
      }

      if (sample.query.length < 3) {
        warnings.push({ field: `samples[${i}].query`, message: 'Query seems too short' });
      }

      if (sample.context.length === 0) {
        errors.push({ field: `samples[${i}].context`, message: 'Context is empty' });
      }

      if (seenQueries.has(sample.query)) {
        warnings.push({ field: `samples[${i}].query`, message: 'Duplicate query detected' });
      }
      seenQueries.add(sample.query);

      const contextKey = sample.context.join('|||');
      if (seenContexts.has(contextKey)) {
        warnings.push({ field: `samples[${i}].context`, message: 'Duplicate context detected' });
      }
      seenContexts.add(contextKey);

      if (sample.generated_answer.length > 0 && sample.generated_answer.length < 10) {
        warnings.push({
          field: `samples[${i}].generated_answer`,
          message: 'Answer seems very short',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateSample(sample: unknown): { valid: boolean; error?: string } {
    try {
      EvaluationSampleSchema.parse(sample);
      return { valid: true };
    } catch (e) {
      if (e instanceof z.ZodError) {
        return {
          valid: false,
          error: e.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join('; '),
        };
      }
      return { valid: false, error: 'Unknown validation error' };
    }
  }

  checkDuplicates(samples: EvaluationSample[]): {
    hasDuplicates: boolean;
    duplicateGroups: EvaluationSample[][];
  } {
    const groups: Map<string, EvaluationSample[]> = new Map();

    for (const sample of samples) {
      const key = `${sample.query}|||${sample.ground_truth}`;
      const existing = groups.get(key) ?? [];
      existing.push(sample);
      groups.set(key, existing);
    }

    const duplicateGroups: EvaluationSample[][] = [];
    for (const [, group] of groups) {
      if (group.length > 1) {
        duplicateGroups.push(group);
      }
    }

    return { hasDuplicates: duplicateGroups.length > 0, duplicateGroups };
  }
}
