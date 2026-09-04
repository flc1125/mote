import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineProject } from 'vitest/config';

import { TEST_PUBLISH_TOKEN } from './src/test-token.js';

export default defineProject({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: {
        bindings: {
          MOTE_TOKEN: TEST_PUBLISH_TOKEN,
        },
      },
    }),
  ],
});
