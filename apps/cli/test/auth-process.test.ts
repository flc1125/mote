import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { build } from 'esbuild';
import { expect, it } from 'vitest';
import { CredentialStore } from '../src/auth/store.js';
import type { OAuthCredential } from '../src/auth/types.js';

it('serializes refresh across processes and recovers a dead lock owner', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mote-process-auth-'));
  const apiUrl = 'https://process.example.com',
    issuer = 'https://test.cloudflareaccess.com';
  const store = new CredentialStore({ directory: join(dir, 'auth') });
  const c: OAuthCredential = {
    version: 1,
    apiUrl,
    issuer,
    resource: apiUrl + '/api/mcp',
    clientId: 'public',
    accessToken: 'old',
    refreshToken: 'refresh',
    expiresAt: 0,
    identity: { kind: 'user', subject: 'test' },
    server: {
      issuer,
      authorization_endpoint: issuer + '/authorization',
      token_endpoint: issuer + '/token',
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    },
  };
  const worker = join(dir, 'worker.mjs');
  try {
    await store.locked(apiUrl, () => store.save(c, 'file'));
    await build({
      stdin: {
        contents: `
import {appendFile} from 'node:fs/promises';
import {CredentialStore} from ${JSON.stringify(resolve('src/auth/store.ts'))};
import {prepareAuth} from ${JSON.stringify(resolve('src/auth/manager.ts'))};
const store=new CredentialStore({directory:process.argv[2]});
if(process.argv[3]==='hold')await store.locked(${JSON.stringify(apiUrl)},async()=>{setInterval(()=>{},1000);console.log('locked');await new Promise(()=>{});});
else {
 await prepareAuth({apiUrl:${JSON.stringify(apiUrl)}},store,async()=>{
   await appendFile(process.argv[3], 'refresh\\n');
   await new Promise(r=>setTimeout(r,50));
   return new Response(JSON.stringify({access_token:'new',refresh_token:'rotated',token_type:'Bearer',expires_in:3600}),{headers:{'Content-Type':'application/json'}});
 });
 console.log('ready');
}
`,
        resolveDir: process.cwd(),
      },
      outfile: worker,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node20',
      external: ['@napi-rs/keyring'],
    });
    const holder = spawn(process.execPath, [worker, store.directory, 'hold'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    // Keep the process alive while holding a lock; production process death is not time-based stealing.
    const output = once(holder.stdout, 'data');
    await output;
    const exited = once(holder, 'exit');
    holder.kill('SIGKILL');
    await exited;
    const calls = join(dir, 'calls');
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        promisify(execFile)(process.execPath, [worker, store.directory, calls]),
      ),
    );
    expect(results.every((x) => x.stdout.trim() === 'ready')).toBe(true);
    expect(await readFile(calls, 'utf8')).toBe('refresh\n');
    expect((await store.load(apiUrl))?.refreshToken).toBe('rotated');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 20000);
