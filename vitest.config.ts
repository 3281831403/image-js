import { defineConfig } from 'vitest/config';

// The native module loader can only run TypeScript files directly when Node.js
// is built with TypeScript support. Fall back to Vite's module runner otherwise.
const canRunTypeScript = Boolean(process.features.typescript);

export default defineConfig({
  test: {
    experimental: canRunTypeScript
      ? {
          viteModuleRunner: false,
          nodeLoader: false,
        }
      : undefined,
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 10_000,
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.benchmark.ts', 'src/**/*.bench.ts'],
    },
    reporters: [
      'default',
      'jest-image-snapshot/src/outdated-snapshot-reporter.js',
    ],
  },
});
