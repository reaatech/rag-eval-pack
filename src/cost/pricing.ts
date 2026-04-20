import type { LLMProvider } from '../types/domain.js';

/**
 * Pricing configuration for a provider/model
 */
export interface PricingConfig {
  input: number;
  output: number;
}

/**
 * Model pricing entry
 */
export interface ModelPricing {
  model: string;
  provider: LLMProvider;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
}

/**
 * Default pricing table for LLM providers.
 * Prices are USD per million tokens.
 */
export const DEFAULT_PRICING: ModelPricing[] = [
  // Anthropic — current
  {
    model: 'claude-opus-4-7',
    provider: 'anthropic',
    inputCostPerMillion: 15.0,
    outputCostPerMillion: 75.0,
  },
  {
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    inputCostPerMillion: 3.0,
    outputCostPerMillion: 15.0,
  },
  {
    model: 'claude-haiku-4-5',
    provider: 'anthropic',
    inputCostPerMillion: 1.0,
    outputCostPerMillion: 5.0,
  },
  // Anthropic — legacy substring fallbacks
  {
    model: 'claude-opus',
    provider: 'anthropic',
    inputCostPerMillion: 15.0,
    outputCostPerMillion: 75.0,
  },
  {
    model: 'claude-sonnet',
    provider: 'anthropic',
    inputCostPerMillion: 3.0,
    outputCostPerMillion: 15.0,
  },
  {
    model: 'claude-haiku',
    provider: 'anthropic',
    inputCostPerMillion: 0.25,
    outputCostPerMillion: 1.25,
  },

  // OpenAI — current
  { model: 'gpt-4o', provider: 'openai', inputCostPerMillion: 2.5, outputCostPerMillion: 10.0 },
  {
    model: 'gpt-4o-mini',
    provider: 'openai',
    inputCostPerMillion: 0.15,
    outputCostPerMillion: 0.6,
  },
  // OpenAI — legacy
  {
    model: 'gpt-4-turbo',
    provider: 'openai',
    inputCostPerMillion: 10.0,
    outputCostPerMillion: 30.0,
  },
  { model: 'gpt-4', provider: 'openai', inputCostPerMillion: 30.0, outputCostPerMillion: 60.0 },
  { model: 'gpt-4-mini', provider: 'openai', inputCostPerMillion: 0.15, outputCostPerMillion: 0.6 },
  {
    model: 'gpt-3.5-turbo',
    provider: 'openai',
    inputCostPerMillion: 0.5,
    outputCostPerMillion: 1.5,
  },

  // Google — current
  {
    model: 'gemini-1.5-pro',
    provider: 'google',
    inputCostPerMillion: 1.25,
    outputCostPerMillion: 5.0,
  },
  {
    model: 'gemini-1.5-flash',
    provider: 'google',
    inputCostPerMillion: 0.075,
    outputCostPerMillion: 0.3,
  },
  // Google — legacy
  { model: 'gemini-pro', provider: 'google', inputCostPerMillion: 2.5, outputCostPerMillion: 7.5 },
  {
    model: 'gemini-ultra',
    provider: 'google',
    inputCostPerMillion: 10.0,
    outputCostPerMillion: 30.0,
  },
];

const DEFAULT_PRICING_BY_PROVIDER: Record<LLMProvider, PricingConfig> = {
  anthropic: { input: 3.0, output: 15.0 },
  openai: { input: 2.5, output: 10.0 },
  google: { input: 1.25, output: 5.0 },
  mock: { input: 0, output: 0 },
};

function normalize(model: string): string {
  return model.toLowerCase().replace(/-/g, '');
}

export class Pricing {
  // Preserve insertion order; earlier entries win substring ties.
  private pricingTable: Map<string, PricingConfig> = new Map();
  private version: string = '1.0.0';

  constructor(customPricing?: ModelPricing[]) {
    for (const p of DEFAULT_PRICING) {
      this.pricingTable.set(normalize(p.model), {
        input: p.inputCostPerMillion,
        output: p.outputCostPerMillion,
      });
    }
    if (customPricing) {
      for (const p of customPricing) {
        this.pricingTable.set(normalize(p.model), {
          input: p.inputCostPerMillion,
          output: p.outputCostPerMillion,
        });
      }
    }
  }

  /**
   * Lookup pricing for a model. Exact normalized match wins; otherwise the
   * longest-prefix substring match wins so that `claude-opus-4-7` matches the
   * `claude-opus-4-7` entry rather than the legacy `claude-opus` entry.
   */
  getPricing(model: string, provider: LLMProvider): PricingConfig {
    const normalizedModel = normalize(model);

    const exact = this.pricingTable.get(normalizedModel);
    if (exact) return exact;

    let bestKey = '';
    let bestPrice: PricingConfig | null = null;
    for (const [key, price] of this.pricingTable.entries()) {
      if (normalizedModel.includes(key) && key.length > bestKey.length) {
        bestKey = key;
        bestPrice = price;
      }
    }
    if (bestPrice) return bestPrice;

    return DEFAULT_PRICING_BY_PROVIDER[provider] || { input: 0, output: 0 };
  }

  calculateCost(
    model: string,
    provider: LLMProvider,
    inputTokens: number,
    outputTokens: number
  ): number {
    const pricing = this.getPricing(model, provider);
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    return inputCost + outputCost;
  }

  addModelPricing(pricing: ModelPricing): void {
    const key = normalize(pricing.model);
    this.pricingTable.set(key, {
      input: pricing.inputCostPerMillion,
      output: pricing.outputCostPerMillion,
    });
  }

  getVersion(): string {
    return this.version;
  }

  getAvailableModels(): string[] {
    return Array.from(this.pricingTable.keys());
  }
}
