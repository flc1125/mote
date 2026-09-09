import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

await build({
  absWorkingDir: resolve(dirname(fileURLToPath(import.meta.url)), '..'),
  entryPoints: ['src/mcp.ts'],
  bundle: true,
  external: ['@napi-rs/keyring'],
  platform: 'node',
  format: 'esm',
  target: 'node20',
  // Bundled CommonJS dependencies (YAML) still require Node built-ins.
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
  outfile: 'dist/mcp.js',
  logLevel: 'info',
});
