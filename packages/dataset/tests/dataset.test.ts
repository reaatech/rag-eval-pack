import type { EvaluationSample } from '@reaatech/rag-eval-core';
import { DatasetLoader } from '@reaatech/rag-eval-dataset';
import { DatasetValidator } from '@reaatech/rag-eval-dataset';
import { DatasetGenerator } from '@reaatech/rag-eval-dataset';
import { DatasetVersioning } from '@reaatech/rag-eval-dataset';
import { describe, expect, it } from 'vitest';

describe('Dataset', () => {
  describe('DatasetLoader', () => {
    it('should parse JSONL content', async () => {
      const loader = new DatasetLoader();
      const jsonl =
        '{"query":"test","context":["ctx1"],"ground_truth":"truth","generated_answer":"answer"}';
      const samples = await loader.loadFromString(jsonl, 'jsonl');
      expect(samples.length).toBe(1);
      expect(samples[0]?.query).toBe('test');
    });

    it('should parse JSON array', async () => {
      const loader = new DatasetLoader();
      const json =
        '[{"query":"test","context":["ctx1"],"ground_truth":"truth","generated_answer":"answer"}]';
      const samples = await loader.loadFromString(json, 'json');
      expect(samples.length).toBe(1);
    });

    it('should throw on invalid JSONL', async () => {
      const loader = new DatasetLoader();
      const jsonl = 'not valid json';
      expect(() => loader.loadFromString(jsonl, 'jsonl')).toThrow();
    });
  });

  describe('DatasetValidator', () => {
    it('should validate correct samples', () => {
      const validator = new DatasetValidator();
      const samples: EvaluationSample[] = [
        {
          query: 'What is the refund policy?',
          context: ['Refunds within 14 days.'],
          ground_truth: 'Refunds within 14 days.',
          generated_answer: 'You can get a refund within 14 days.',
        },
      ];
      const result = validator.validate(samples);
      expect(result.valid).toBe(true);
    });

    it('should detect empty dataset', () => {
      const validator = new DatasetValidator();
      const result = validator.validate([]);
      expect(result.valid).toBe(false);
      expect(result.errors[0]?.message).toContain('empty');
    });

    it('should detect empty context', () => {
      const validator = new DatasetValidator();
      const samples: EvaluationSample[] = [
        {
          query: 'Test query',
          context: [],
          ground_truth: 'Truth',
          generated_answer: 'Answer',
        },
      ];
      const result = validator.validate(samples);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('empty'))).toBe(true);
    });

    it('should check for duplicates', () => {
      const validator = new DatasetValidator();
      const samples: EvaluationSample[] = [
        { query: 'Test', context: ['ctx'], ground_truth: 'truth', generated_answer: 'answer' },
        { query: 'Test', context: ['ctx'], ground_truth: 'truth', generated_answer: 'answer' },
      ];
      const result = validator.checkDuplicates(samples);
      expect(result.hasDuplicates).toBe(true);
    });
  });

  describe('DatasetGenerator', () => {
    it('should generate samples for general domain', () => {
      const generator = new DatasetGenerator();
      const samples = generator.generate({
        domain: 'general',
        difficulty: 'medium',
        numSamples: 5,
      });
      expect(samples.length).toBe(5);
      expect(samples[0]?.query).toBeDefined();
      expect(samples[0]?.context).toBeDefined();
    });

    it('should generate different difficulty levels', () => {
      const generator = new DatasetGenerator();
      const easy = generator.generate({ domain: 'general', difficulty: 'easy', numSamples: 3 });
      const hard = generator.generate({ domain: 'general', difficulty: 'hard', numSamples: 3 });
      expect(easy[0]?.context.length).toBeLessThanOrEqual(hard[0]?.context.length);
    });

    it('should include metadata', () => {
      const generator = new DatasetGenerator();
      const samples = generator.generate({
        domain: 'technical',
        difficulty: 'hard',
        numSamples: 2,
      });
      expect(samples[0]?.metadata?.difficulty).toBe('hard');
      expect(samples[0]?.metadata?.domain).toBe('technical');
      expect(samples[0]?.metadata?.generated).toBe(true);
    });
  });

  describe('DatasetVersioning', () => {
    it('should create versions', () => {
      const versioning = new DatasetVersioning();
      const samples: EvaluationSample[] = [
        { query: 'test', context: ['ctx'], ground_truth: 'truth', generated_answer: 'answer' },
      ];
      const version = versioning.createVersion(samples, {
        author: 'test',
        description: 'Test version',
      });
      expect(version.version).toBeDefined();
      expect(version.created).toBeDefined();
    });

    it('should get all versions', () => {
      const versioning = new DatasetVersioning();
      versioning.createVersion([
        { query: 'test1', context: [], ground_truth: 't', generated_answer: 'a' },
      ]);
      versioning.createVersion([
        { query: 'test2', context: [], ground_truth: 't', generated_answer: 'a' },
      ]);
      const versions = versioning.getAllVersions();
      expect(versions.length).toBe(2);
    });

    it('should track changelog', () => {
      const versioning = new DatasetVersioning();
      versioning.createVersion(
        [{ query: 'test', context: [], ground_truth: 't', generated_answer: 'a' }],
        { changes: ['initial'] },
      );
      const changelog = versioning.getChangelog();
      expect(changelog.length).toBe(1);
      expect(changelog[0]?.changes).toContain('initial');
    });
  });
});
