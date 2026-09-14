import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'scripts/release/*.test.mjs',
      'scripts/workers/*.test.mjs',
      'scripts/docs/*.test.mjs',
    ],
    environment: 'node',
  },
});
