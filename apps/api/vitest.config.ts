import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineProject } from 'vitest/config';

import { TEST_PUBLISH_TOKEN } from './src/test-token.js';

export default defineProject({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: {
        bindings: {
          // Legacy API integration fixtures must not inherit production auth mode.
          MOTE_AUTH_MODE: 'token',
          MOTE_TOKEN: TEST_PUBLISH_TOKEN,
        },
      },
    }),
  ],
});
