import { readFileSync, existsSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import type { EvaluationSample, EvalSuiteConfig } from '../types/domain.js';
import { EvaluationSampleSchema } from '../types/schemas.js';

/**
 * Dataset Loader
 *
 * Loads evaluation datasets from various formats (JSONL, JSON, YAML).
 * Supports validation and filtering.
 */
export class DatasetLoader {
  /**
   * Load dataset from a file path
   */
  async load(path: string): Promise<EvaluationSample[]> {
    if (!existsSync(path)) {
      throw new Error(`Dataset file not found: ${path}`);
    }

    const extension = path.split('.').pop()?.toLowerCase();

    switch (extension) {
      case 'jsonl':
        return this.loadJSONL(path);
      case 'json':
        return this.loadJSON(path);
      case 'yaml':
      case 'yml':
        return this.loadYAML(path);
      default:
        throw new Error(`Unsupported file format: ${extension}`);
    }
  }

  /**
   * Load from JSONL file (one sample per line)
   */
  private loadJSONL(path: string): Promise<EvaluationSample[]> {
    const content = readFileSync(path, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());
    const samples: EvaluationSample[] = [];

    for (let i = 0; i < lines.length; i++) {
      try {
        const parsed = JSON.parse(lines[i]!);
        const validated = EvaluationSampleSchema.parse(parsed);
        samples.push(validated);
      } catch (error) {
        throw new Error(
          `Error parsing line ${i + 1}: ${error instanceof Error ? error.message : 'Invalid JSON'}`
        );
      }
    }

    return Promise.resolve(samples);
  }

  /**
   * Load from JSON file
   */
  private loadJSON(path: string): Promise<EvaluationSample[]> {
    const content = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(content);

    // Support both array format and object with samples property
    const samplesArray = Array.isArray(parsed) ? parsed : parsed.samples || parsed.data || [];

    if (!Array.isArray(samplesArray)) {
      throw new Error(
        'JSON file must contain an array of samples or an object with a "samples" or "data" property'
      );
    }

    const samples: EvaluationSample[] = [];
    for (let i = 0; i < samplesArray.length; i++) {
      try {
        const validated = EvaluationSampleSchema.parse(samplesArray[i]);
        samples.push(validated);
      } catch (error) {
        throw new Error(
          `Error validating sample ${i + 1}: ${error instanceof Error ? error.message : 'Invalid sample format'}`
        );
      }
    }

    return Promise.resolve(samples);
  }

  /**
   * Load from YAML file
   */
  private loadYAML(path: string): Promise<EvaluationSample[]> {
    const content = readFileSync(path, 'utf-8');
    const parsed = parseYaml(content);

    // Support both array format and object with samples property
    const samplesArray = Array.isArray(parsed) ? parsed : parsed.samples || parsed.data || [];

    if (!Array.isArray(samplesArray)) {
      throw new Error(
        'YAML file must contain an array of samples or an object with a "samples" or "data" property'
      );
    }

    const samples: EvaluationSample[] = [];
    for (let i = 0; i < samplesArray.length; i++) {
      try {
        const validated = EvaluationSampleSchema.parse(samplesArray[i]);
        samples.push(validated);
      } catch (error) {
        throw new Error(
          `Error validating sample ${i + 1}: ${error instanceof Error ? error.message : 'Invalid sample format'}`
        );
      }
    }

    return Promise.resolve(samples);
  }

  /**
   * Load from a string (useful for inline data)
   */
  loadFromString(content: string, format: 'jsonl' | 'json' | 'yaml'): Promise<EvaluationSample[]> {
    switch (format) {
      case 'jsonl': {
        const lines = content.split('\n').filter((line) => line.trim());
        const samples: EvaluationSample[] = [];
        for (let i = 0; i < lines.length; i++) {
          try {
            const parsed = JSON.parse(lines[i]!);
            const validated = EvaluationSampleSchema.parse(parsed);
            samples.push(validated);
          } catch (error) {
            throw new Error(
              `Error parsing line ${i + 1}: ${error instanceof Error ? error.message : 'Invalid JSON'}`
            );
          }
        }
        return Promise.resolve(samples);
      }
      case 'json': {
        const parsed = JSON.parse(content);
        const samplesArray = Array.isArray(parsed) ? parsed : parsed.samples || parsed.data || [];
        const samples: EvaluationSample[] = [];
        for (let i = 0; i < samplesArray.length; i++) {
          try {
            const validated = EvaluationSampleSchema.parse(samplesArray[i]);
            samples.push(validated);
          } catch (error) {
            throw new Error(
              `Error validating sample ${i + 1}: ${error instanceof Error ? error.message : 'Invalid sample format'}`
            );
          }
        }
        return Promise.resolve(samples);
      }
      case 'yaml': {
        const parsed = parseYaml(content);
        const samplesArray = Array.isArray(parsed) ? parsed : parsed.samples || parsed.data || [];
        const samples: EvaluationSample[] = [];
        for (let i = 0; i < samplesArray.length; i++) {
          try {
            const validated = EvaluationSampleSchema.parse(samplesArray[i]);
            samples.push(validated);
          } catch (error) {
            throw new Error(
              `Error validating sample ${i + 1}: ${error instanceof Error ? error.message : 'Invalid sample format'}`
            );
          }
        }
        return Promise.resolve(samples);
      }
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }
}

/**
 * Load evaluation config from file
 */
export async function loadEvalConfig(path: string): Promise<EvalSuiteConfig> {
  if (!existsSync(path)) {
    throw new Error(`Config file not found: ${path}`);
  }

  const content = readFileSync(path, 'utf-8');
  const extension = path.split('.').pop()?.toLowerCase();

  let parsed: unknown;
  switch (extension) {
    case 'yaml':
    case 'yml':
      parsed = parseYaml(content);
      break;
    case 'json':
      parsed = JSON.parse(content);
      break;
    default:
      throw new Error(`Unsupported config format: ${extension}`);
  }

  // Extract evaluation config
  const config =
    (parsed as { evaluation?: EvalSuiteConfig; config?: EvalSuiteConfig }).evaluation ??
    (parsed as { evaluation?: EvalSuiteConfig; config?: EvalSuiteConfig }).config ??
    parsed;

  return config as EvalSuiteConfig;
}
