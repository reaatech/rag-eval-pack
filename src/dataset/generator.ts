import type { EvaluationSample } from '../types/domain.js';

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface GeneratorConfig {
  domain: string;
  difficulty: DifficultyLevel;
  numSamples: number;
  minContextLength?: number;
  maxContextLength?: number;
}

const DOMAIN_TEMPLATES: Record<
  string,
  { queries: string[]; contexts: string[]; answers: string[] }
> = {
  general: {
    queries: [
      'What is the return policy?',
      'How do I reset my password?',
      'What are the business hours?',
      'How can I contact support?',
      'What payment methods are accepted?',
    ],
    contexts: [
      'Our return policy allows items to be returned within 30 days of purchase with a receipt.',
      'To reset your password, visit the settings page and click "Forgot Password".',
      'We are open Monday through Friday, 9 AM to 6 PM EST.',
      'You can reach our support team via email at support@example.com or phone at 555-1234.',
      'We accept Visa, Mastercard, and American Express credit cards.',
    ],
    answers: [
      'Items can be returned within 30 days with a receipt.',
      'Visit settings and click "Forgot Password" to reset your password.',
      'Business hours are Monday-Friday, 9 AM to 6 PM EST.',
      'Contact support at support@example.com or 555-1234.',
      'We accept Visa, Mastercard, and American Express.',
    ],
  },
  technical: {
    queries: [
      'How do I configure the API?',
      'What is the rate limit?',
      'How do I authenticate?',
      'What formats are supported?',
      'How do I troubleshoot errors?',
    ],
    contexts: [
      'API configuration is done via the config.yaml file in the project root.',
      'The rate limit is 1000 requests per minute for standard accounts.',
      'Authentication uses OAuth 2.0 with Bearer tokens in the Authorization header.',
      'Supported formats include JSON, XML, and YAML for input and output.',
      'Error troubleshooting: check logs in /var/log/app.log and verify environment variables.',
    ],
    answers: [
      'Configure the API via config.yaml in the project root.',
      'Rate limit is 1000 requests per minute for standard accounts.',
      'Use OAuth 2.0 with Bearer tokens in the Authorization header.',
      'Supported formats are JSON, XML, and YAML.',
      'Check /var/log/app.log and verify environment variables for troubleshooting.',
    ],
  },
};

export class DatasetGenerator {
  generate(config: GeneratorConfig): EvaluationSample[] {
    const template = DOMAIN_TEMPLATES[config.domain] || DOMAIN_TEMPLATES['general'];
    const samples: EvaluationSample[] = [];

    for (let i = 0; i < config.numSamples; i++) {
      const queryIdx = i % template.queries.length;
      const contextIdx = i % template.contexts.length;
      const answerIdx = i % template.answers.length;

      const sample: EvaluationSample = {
        query: template.queries[queryIdx]!,
        context: this.generateContext(template.contexts[contextIdx]!, config.difficulty),
        ground_truth: template.answers[answerIdx]!,
        generated_answer: template.answers[answerIdx]!,
        metadata: {
          difficulty: config.difficulty,
          domain: config.domain,
          generated: true,
          index: i,
        },
      };

      samples.push(sample);
    }

    return this.shuffle(samples);
  }

  private generateContext(baseContext: string, difficulty: DifficultyLevel): string[] {
    switch (difficulty) {
      case 'easy':
        return [baseContext];
      case 'medium':
        return [baseContext, 'Additional relevant information for context.'];
      case 'hard':
        return [
          baseContext,
          'Extra context that may or may not be relevant to the query.',
          'Another piece of information that adds noise or detail.',
        ];
    }
  }

  private shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    return shuffled;
  }

  generateDomainSpecific(
    domain: string,
    numSamples: number,
    difficulty: DifficultyLevel = 'medium'
  ): EvaluationSample[] {
    return this.generate({ domain, difficulty, numSamples });
  }
}
