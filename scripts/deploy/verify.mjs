import { log } from 'node:console';
import { resolve } from 'node:path';
import { argv } from 'node:process';
import { parseArgs } from 'node:util';
import { verifyArtifacts } from './artifacts.mjs';

const { values } = parseArgs({
  args: argv.slice(2),
  options: {
    directory: { type: 'string' },
    sha: { type: 'string' },
    environment: { type: 'string' },
    'manifest-sha256': { type: 'string' },
    'allow-dirty': { type: 'boolean', default: false },
  },
});
if (!values.directory) throw new Error('--directory is required');
await verifyArtifacts(resolve(values.directory), {
  expectedSha: values.sha,
  environment: values.environment,
  manifestDigest: values['manifest-sha256'],
  allowLocal: values['allow-dirty'],
});
log('Artifact inventory, configuration and prebuilt upload verified (no deployment)');
