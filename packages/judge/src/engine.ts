import type {
  ConsensusConfig,
  EvaluationSample,
  JudgeConfig,
  JudgeScore,
  LLMProvider,
} from '@reaatech/rag-eval-core';
import { type CalibrationDataPoint, JudgeCalibrator } from './calibration.js';
import {
  applyPromptTemplate,
  CONTEXT_PRECISION_PROMPT,
  CONTEXT_RECALL_PROMPT,
  FAITHFULNESS_PROMPT,
  OVERALL_QUALITY_PROMPT,
  type PromptTemplate,
  parseJudgeResponse,
  RELEVANCE_PROMPT,
} from './prompts.js';

/** Judge metric type */
export type JudgeMetric =
  | 'faithfulness'
  | 'relevance'
  | 'context_precision'
  | 'context_recall'
  | 'overall';

/** Judge result with metadata */
export interface JudgeResult extends JudgeScore {
  metric: JudgeMetric;
  sample_id?: string | number;
}

/**
 * LLM Judge Engine
 *
 * Provider-agnostic LLM-as-judge for RAG evaluation.
 * Supports multiple providers (Anthropic, OpenAI, Google) with fallback and consensus.
 */
export class JudgeEngine {
  private config: JudgeConfig;
  private calibrator: JudgeCalibrator;

  static DEFAULT_MODEL = 'claude-sonnet-4-6';

  constructor(config: JudgeConfig) {
    this.config = config;
    this.calibrator = new JudgeCalibrator(
      config.calibration?.method ? { method: config.calibration.method } : undefined,
    );
  }

  /**
   * Load calibration data and train the calibrator
   */
  async trainCalibrator(data: CalibrationDataPoint[]): Promise<void> {
    this.calibrator.loadData(data);
    await this.calibrator.train();
  }

  /**
   * Get API key for a provider.
   *
   * Precedence: explicit `config.api_key`, then the provider-specific
   * environment variable. Lets self-hosted/gateway setups supply credentials
   * directly instead of relying on model-name keyword inference.
   */
  private getApiKeyForProvider(provider: LLMProvider): string {
    if (this.config.api_key) {
      return this.config.api_key;
    }
    switch (provider) {
      case 'anthropic':
        return process.env.ANTHROPIC_API_KEY ?? '';
      case 'openai':
        return process.env.OPENAI_API_KEY ?? '';
      case 'google':
        return process.env.GOOGLE_API_KEY ?? '';
      default:
        return '';
    }
  }

  /**
   * Determine the provider for a model.
   *
   * An explicit `config.provider` always wins — required for OpenAI-compatible
   * gateways, proxies, and local models whose names lack a provider keyword.
   * Otherwise the provider is inferred from the model name.
   */
  private getProvider(model: string): LLMProvider {
    if (this.config.provider) {
      return this.config.provider;
    }
    const modelLower = model.toLowerCase();
    if (modelLower.includes('claude') || modelLower.includes('anthropic')) {
      return 'anthropic';
    }
    if (modelLower.includes('gpt') || modelLower.includes('openai')) {
      return 'openai';
    }
    if (modelLower.includes('gemini') || modelLower.includes('google')) {
      return 'google';
    }
    return 'mock';
  }

  /**
   * Evaluate a single sample with LLM judge
   */
  async evaluate(
    sample: EvaluationSample,
    metric: JudgeMetric,
    model?: string,
  ): Promise<JudgeResult> {
    const targetModel = model ?? this.config.model ?? JudgeEngine.DEFAULT_MODEL;
    const provider = this.getProvider(targetModel);

    // Get the appropriate prompt
    const prompt = this.getPrompt(metric);
    const variables = this.getVariables(metric, sample);
    const { system, user } = applyPromptTemplate(prompt, variables);

    try {
      // Call the LLM
      const response = await this.callLLM(targetModel, provider, system, user);
      const parsed = parseJudgeResponse(response);

      // Apply calibration if configured
      let calibratedScore = parsed.score;
      let calibrated = false;
      if (this.config.calibration?.enabled) {
        calibratedScore = this.applyCalibration(parsed.score);
        calibrated = true;
      }

      return {
        score: Math.round(calibratedScore * 1000) / 1000,
        raw_score: parsed.score,
        explanation: parsed.explanation,
        // Prefer the judge's self-reported confidence; fall back to neutral.
        confidence: parsed.confidence ?? 0.5,
        calibrated,
        model: targetModel,
        provider,
        metric,
        sample_id: sample.metadata?.sample_id as string | number,
      };
    } catch (error) {
      // Try fallback models
      if (this.config.fallback_models && this.config.fallback_models.length > 0) {
        for (const fallback of this.config.fallback_models) {
          if (!fallback) continue;
          try {
            return await this.evaluate(sample, metric, fallback);
          } catch {}
        }
      }

      // Return a default score on failure
      return {
        score: 0.5,
        explanation: `Judge failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0,
        calibrated: false,
        model: targetModel,
        provider,
        metric,
        sample_id: sample.metadata?.sample_id as string | number,
      };
    }
  }

  /**
   * Evaluate with consensus from multiple models
   */
  async evaluateWithConsensus(sample: EvaluationSample, metric: JudgeMetric): Promise<JudgeResult> {
    if (!this.config.consensus?.enabled || !this.config.consensus.models.length) {
      return this.evaluate(sample, metric);
    }

    const consensusConfig = this.config.consensus;
    const results: JudgeResult[] = [];

    // Evaluate with each model
    for (const consensusModel of consensusConfig.models) {
      const result = await this.evaluate(sample, metric, consensusModel.id);
      results.push(result);
    }

    // Aggregate results based on voting strategy
    return this.aggregateConsensus(results, consensusConfig, metric, sample);
  }

  /**
   * Aggregate consensus results
   */
  private aggregateConsensus(
    results: JudgeResult[],
    config: ConsensusConfig,
    metric: JudgeMetric,
    sample: EvaluationSample,
  ): JudgeResult {
    const provider = this.getProvider(
      config.models[0]?.id ?? this.config.model ?? JudgeEngine.DEFAULT_MODEL,
    );

    switch (config.voting_strategy) {
      case 'weighted': {
        const totalWeight = config.models.reduce((sum, m) => sum + (m.weight ?? 1), 0);
        const weightedScore =
          results.reduce((sum, r, i) => {
            const weight = config.models[i]?.weight ?? 1;
            return sum + r.score * weight;
          }, 0) / totalWeight;

        // Confidence reflects how much the judges agreed, not the score itself.
        const agreement = this.agreementConfidence(results.map((r) => r.score));
        const explanations = results.map((r) => r.explanation).join('\n\n');

        return {
          score: Math.round(weightedScore * 1000) / 1000,
          explanation: `Consensus (weighted): ${explanations}`,
          confidence: Math.round(agreement * 1000) / 1000,
          calibrated: results.some((r) => r.calibrated),
          raw_score: weightedScore,
          model: config.models.map((m) => m.id).join(', '),
          provider,
          metric,
          sample_id: sample.metadata?.sample_id as string | number,
        };
      }

      case 'majority': {
        // Round scores to nearest 0.5 for majority voting
        const roundedScores = results.map((r) => Math.round(r.score * 2) / 2);
        const scoreCounts = new Map<number, number>();
        for (const score of roundedScores) {
          scoreCounts.set(score, (scoreCounts.get(score) ?? 0) + 1);
        }
        const majorityScore = [...scoreCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 0.5;

        return {
          score: majorityScore,
          explanation: `Majority vote: ${majorityScore}`,
          confidence: (scoreCounts.get(majorityScore) ?? 0) / results.length,
          calibrated: false,
          model: config.models.map((m) => m.id).join(', '),
          provider,
          metric,
          sample_id: sample.metadata?.sample_id as string | number,
        };
      }

      case 'unanimous': {
        const allSame = results.every(
          (r) => Math.round(r.score * 10) === Math.round(results[0]?.score * 10),
        );
        const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;

        return {
          score: Math.round(avgScore * 1000) / 1000,
          explanation: allSame
            ? 'Unanimous agreement'
            : `No unanimous agreement (avg: ${avgScore.toFixed(2)})`,
          confidence: allSame ? 1 : 0.5,
          calibrated: false,
          model: config.models.map((m) => m.id).join(', '),
          provider,
          metric,
          sample_id: sample.metadata?.sample_id as string | number,
        };
      }

      default: {
        const first = results[0];
        if (!first)
          return {
            score: 0.5,
            explanation: 'No results available',
            confidence: 0,
            calibrated: false,
            model: config.models.map((m) => m.id).join(', '),
            provider,
            metric,
            sample_id: sample.metadata?.sample_id as string | number,
          };
        return first;
      }
    }
  }

  /**
   * Get prompt for a metric
   */
  private getPrompt(metric: JudgeMetric): PromptTemplate {
    switch (metric) {
      case 'faithfulness':
        return FAITHFULNESS_PROMPT;
      case 'relevance':
        return RELEVANCE_PROMPT;
      case 'context_precision':
        return CONTEXT_PRECISION_PROMPT;
      case 'context_recall':
        return CONTEXT_RECALL_PROMPT;
      case 'overall':
        return OVERALL_QUALITY_PROMPT;
      default:
        return OVERALL_QUALITY_PROMPT;
    }
  }

  /**
   * Get prompt variables for a metric
   */
  private getVariables(metric: JudgeMetric, sample: EvaluationSample): Record<string, string> {
    const base = {
      query: sample.query,
      context: sample.context.join('\n\n'),
      ground_truth: sample.ground_truth,
      generated_answer: sample.generated_answer,
    };

    switch (metric) {
      case 'faithfulness':
        return { context: base.context, generated_answer: base.generated_answer };
      case 'relevance':
        return { query: base.query, generated_answer: base.generated_answer };
      case 'context_precision':
      case 'context_recall':
      case 'overall':
        return base;
      default:
        return base;
    }
  }

  /**
   * Call LLM provider with rate limit retry
   */
  private async callLLM(
    model: string,
    provider: LLMProvider,
    system: string,
    user: string,
  ): Promise<string> {
    const apiKey = this.getApiKeyForProvider(provider);
    const baseUrl = this.config.base_url;

    // A configured base URL (gateway / local server) is enough to attempt a
    // real call even when no API key is set.
    if (provider === 'mock' || (!apiKey && !baseUrl)) {
      return this.mockLLMResponse(system, user);
    }

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        switch (provider) {
          case 'anthropic':
            return await this.callAnthropic(model, apiKey, system, user, baseUrl);
          case 'openai':
            return await this.callOpenAI(model, apiKey, system, user, baseUrl);
          case 'google':
            return await this.callGoogle(model, apiKey, system, user, baseUrl);
          default:
            return this.mockLLMResponse(system, user);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (this.isRateLimitError(error) && attempt < maxRetries - 1) {
          const delay = 2 ** attempt * 1000;
          await this.sleep(delay);
          continue;
        }

        throw lastError;
      }
    }

    throw lastError ?? new Error('Max retries exceeded');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      return (
        msg.includes('rate limit') ||
        msg.includes('429') ||
        msg.includes('too many requests') ||
        msg.includes('quota exceeded')
      );
    }
    return false;
  }

  /**
   * Call Anthropic Claude
   */
  private async callAnthropic(
    model: string,
    apiKey: string,
    system: string,
    user: string,
    baseUrl?: string,
  ): Promise<string> {
    // Dynamic import to avoid requiring the package at runtime if not used
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({
      apiKey: apiKey || 'not-required',
      ...(baseUrl ? { baseURL: baseUrl } : {}),
    });

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: user }],
    });

    return response.content[0]?.type === 'text' ? response.content[0].text : '';
  }

  /**
   * Call OpenAI GPT
   */
  private async callOpenAI(
    model: string,
    apiKey: string,
    system: string,
    user: string,
    baseUrl?: string,
  ): Promise<string> {
    const { OpenAI } = await import('openai');
    const client = new OpenAI({
      apiKey: apiKey || 'not-required',
      ...(baseUrl ? { baseURL: baseUrl } : {}),
    });

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.1,
    });

    return response.choices[0]?.message?.content ?? '';
  }

  /**
   * Call Google Gemini
   */
  private async callGoogle(
    model: string,
    apiKey: string,
    system: string,
    user: string,
    baseUrl?: string,
  ): Promise<string> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey || 'not-required');
    const generativeModel = genAI.getGenerativeModel({ model }, baseUrl ? { baseUrl } : undefined);

    const response = await generativeModel.generateContent(`${system}\n\n${user}`);
    return response.response.text();
  }

  /**
   * Mock LLM response for testing or when API is unavailable
   * Generates a deterministic score based on content characteristics
   */
  private mockLLMResponse(system: string, user: string): string {
    const combined = (system + user).toLowerCase();
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    const normalizedScore = Math.abs(hash % 100) / 100;
    const score = 0.5 + (normalizedScore - 0.5) * 0.3;

    return `Score: ${score.toFixed(2)}
Confidence: 0.50
Explanation: Mock evaluation - in production, this would be evaluated by an LLM judge.`;
  }

  /**
   * Apply calibration to a raw score using the calibrator
   */
  private applyCalibration(rawScore: number): number {
    if (!this.calibrator.isTrained()) {
      return rawScore;
    }
    return this.calibrator.apply(rawScore);
  }

  /**
   * Confidence derived from inter-judge agreement.
   *
   * Tight clustering of scores → high confidence; wide disagreement → low.
   * This is a real uncertainty signal, unlike deriving confidence from a
   * single score's distance from 0.5. Uses 1 - 2·stddev, clamped to [0, 1].
   */
  private agreementConfidence(scores: number[]): number {
    if (scores.length <= 1) return 1;
    const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    return Math.max(0, Math.min(1, 1 - 2 * stdDev));
  }

  /**
   * Evaluate batch of samples
   */
  async evaluateBatch(
    samples: EvaluationSample[],
    metric: JudgeMetric,
    useConsensus = false,
  ): Promise<JudgeResult[]> {
    const results: JudgeResult[] = [];

    for (const sample of samples) {
      const result = useConsensus
        ? await this.evaluateWithConsensus(sample, metric)
        : await this.evaluate(sample, metric);
      results.push(result);
    }

    return results;
  }
}
