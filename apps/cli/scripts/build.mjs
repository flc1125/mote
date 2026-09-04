import { rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

await rm(resolve(packageDir, 'dist'), { recursive: true, force: true });
await build({
  absWorkingDir: packageDir,
  entryPoints: ['src/cli.ts', 'src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outdir: 'dist',
  logLevel: 'info',
});
