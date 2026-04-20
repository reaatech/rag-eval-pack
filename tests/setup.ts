import { vi } from 'vitest';

// Mock environment variables for testing
process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.OPENAI_API_KEY = 'test-key';

// Global test timeout
vi.setConfig({
  testTimeout: 30000,
  hookTimeout: 10000,
});

// Suppress console output during tests (optional)
// global.console = {
//   ...console,
//   log: vi.fn(),
//   debug: vi.fn(),
//   info: vi.fn(),
//   warn: vi.fn(),
//   error: vi.fn(),
// };
