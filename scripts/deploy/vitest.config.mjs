import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scripts/deploy/*.test.mjs', 'scripts/release/*.test.mjs'],
    environment: 'node',
  },
});
