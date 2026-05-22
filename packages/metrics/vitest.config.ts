import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@reaatech/rag-eval-metrics': resolve(__dirname, 'src/index.ts'),
      '@reaatech/rag-eval-core': resolve(__dirname, '../core/src/index.ts'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    coverage: {
      provider: 'istanbul',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/engine.ts'],
      reporter: ['text', 'json-summary'],
    },
  },
});
