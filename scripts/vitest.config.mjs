import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scripts/release/*.test.mjs', 'scripts/workers/*.test.mjs'],
    environment: 'node',
  },
});
