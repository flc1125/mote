import assert from 'node:assert/strict';
import { log } from 'node:console';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { argv } from 'node:process';
import { offlineWrangler, root, sourceConfig, uploadParts, wranglerVersion } from './config.mjs';

const component = argv[2];
sourceConfig(component);
const app = join(root, 'apps', component);
const scratch = await mkdtemp(join(tmpdir(), `mote-${component}-dry-run-`));
try {
  for (const environment of ['production', 'access-test']) {
    const output = join(scratch, `${environment}.multipart`);
    offlineWrangler(
      [
        'deploy',
        '--config',
        join(app, 'wrangler.toml'),
        '--env',
        environment === 'production' ? '' : environment,
        '--dry-run',
        '--outfile',
        output,
      ],
      app,
      join(scratch, 'wrangler.log'),
    );
    const parts = await uploadParts(output);
    assert(parts['index.js'].size > 0, 'Worker bundle is empty');
    log(
      `Verified ${component}/${environment}: Wrangler ${wranglerVersion} dry-run produced ${parts['index.js'].size} bytes`,
    );
  }
} finally {
  await rm(scratch, { recursive: true, force: true });
}
