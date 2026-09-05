import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { build } from 'esbuild';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CredentialStore, type OAuthCredential } from '@mote/cli';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';

const api = 'https://mote.example.com';
const issuer = 'https://test.cloudflareaccess.com';
let buildDir: string, dir: string, serverFile: string, cliFile: string;
let store: CredentialStore;
const closers: (() => Promise<void>)[] = [];
const credential = (): OAuthCredential => ({
  version: 1,
  apiUrl: api,
  issuer,
  resource: api + '/api/mcp',
  clientId: 'public',
  accessToken: 'old-access',
  refreshToken: 'old-refresh',
  expiresAt: 0,
  identity: { kind: 'user', subject: 'user-1' },
  server: {
    issuer,
    authorization_endpoint: issuer + '/authorize',
    token_endpoint: issuer + '/token',
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  },
});

// Only the network is simulated. The production CLI/MCP entry points, config,
// private-file storage, cross-process locking and stdio transport are real.
const mockNetwork = `
import {appendFile} from 'node:fs/promises';
const record = event => appendFile(process.env.XDG_CONFIG_HOME+'/events',JSON.stringify(event)+'\\n');
globalThis.fetch = async (input,init={})=>{
 const url=String(input);
 if(init.redirect!=='error')throw new Error('unsafe redirect policy');
 const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(url===${JSON.stringify(issuer + '/token')}){
   await record({event:'refresh'});
   await new Promise(r=>setTimeout(r,80));
   return json({access_token:'new-access',refresh_token:'new-refresh',token_type:'Bearer',expires_in:3600});
 }
 const headers=new Headers(init.headers);
 const user=headers.get('Authorization')==='Bearer new-access';
 const service=headers.get('CF-Access-Client-Id')==='machine.access'&&headers.get('CF-Access-Client-Secret')==='machine-secret'&&!headers.has('Authorization');
 if(url===${JSON.stringify(api + '/api/auth/session')})return json({authenticated:true,publisher:{kind:'user',subject:'user-1'}});
 if(url!==${JSON.stringify(api + '/api/v1/publish')}||init.method!=='POST')throw new Error('unexpected network target');
 await record({event:'publish',authorized:user||service,mode:service?'service':'oauth',assets:[...init.body.keys()].filter(k=>k.startsWith('asset_')).length});
 if(!user&&!service)return json({error:{message:'reflected machine-secret'}},401);
 return json({id:'7Vk3mQ9x2NFaP4Ls',url:${JSON.stringify(api + '/7Vk3mQ9x2NFaP4Ls')}},201);
};
`;

beforeAll(async () => {
  buildDir = await mkdtemp(join(tmpdir(), 'mote-stdio-build-'));
  serverFile = join(buildDir, 'server.mjs');
  cliFile = join(buildDir, 'cli.mjs');
  for (const [entry, outfile] of [
    ['src/mcp.ts', serverFile],
    ['../cli/src/cli.ts', cliFile],
  ] as const) {
    await build({
      stdin: {
        contents: mockNetwork + `\nawait import(${JSON.stringify(resolve(entry))});`,
        resolveDir: process.cwd(),
      },
      outfile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node20',
      external: ['@napi-rs/keyring'],
    });
  }
});
afterAll(async () => {
  await rm(buildDir, { recursive: true, force: true });
});
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mote-stdio-auth-'));
  store = new CredentialStore({ directory: join(dir, 'mote/auth') });
});
afterEach(async () => {
  while (closers.length) await closers.pop()?.();
  await rm(dir, { recursive: true, force: true });
});
async function events(): Promise<
  { event: string; authorized?: boolean; mode?: string; assets?: number }[]
> {
  try {
    return (await readFile(join(dir, 'events'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}
async function connect(extra: Record<string, string> = {}) {
  const env = { XDG_CONFIG_HOME: dir, MOTE_API_URL: api, MOTE_TOKEN: 'legacy-secret', ...extra };
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverFile],
    env,
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on('data', (chunk) => {
    stderr += String(chunk);
  });
  const client = new Client({ name: 'stdio-auth-test', version: '0.0.0' });
  const errors: Error[] = [];
  client.onerror = (error) => errors.push(error);
  closers.push(async () => {
    await client.close();
    expect(errors).toEqual([]);
    expect(stderr).toBe('');
  });
  await client.connect(transport);
  expect((await client.listTools()).tools.map((t) => t.name).sort()).toEqual([
    'publish_markdown',
    'publish_markdown_file',
  ]);
  return { client, env };
}
it('shares file credentials and one refresh across CLI and real MCP stdio, deduplicating images', async () => {
  await store.locked(api, () => store.save(credential(), 'file'));
  const { client, env } = await connect();
  // Identical bytes referenced via different files must form a single asset.
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  await writeFile(join(dir, 'one.png'), png);
  await writeFile(join(dir, 'two.png'), png);
  const path = join(dir, 'doc.md');
  await writeFile(path, '# stdio\n\n![one](one.png)\n![two](two.png)');
  const [raw, file, status] = await Promise.all([
    client.callTool({ name: 'publish_markdown', arguments: { markdown: '# in memory' } }),
    client.callTool({ name: 'publish_markdown_file', arguments: { path } }),
    promisify(execFile)(process.execPath, [cliFile, 'auth', 'status', '--json'], {
      env: { PATH: process.env.PATH, ...env },
    }),
  ]);
  expect(raw.isError).toBeUndefined();
  expect(file.isError).toBeUndefined();
  expect(file.structuredContent).toMatchObject({ assetCount: 1, url: api + '/7Vk3mQ9x2NFaP4Ls' });
  expect(JSON.parse(status.stdout)).toMatchObject({ authenticated: true, storage: 'file' });
  expect(status.stderr).toBe('');
  const log = await events();
  expect(log.filter((x) => x.event === 'refresh')).toHaveLength(1);
  expect(
    log
      .filter((x) => x.event === 'publish')
      .map((x) => x.assets)
      .sort(),
  ).toEqual([0, 1]);
  expect(log.every((x) => x.event !== 'publish' || x.authorized)).toBe(true);
  expect((await store.load(api))?.refreshToken).toBe('new-refresh');
  expect((await readdir(store.directory)).some((f) => f.endsWith('.lock'))).toBe(false);
  const output = JSON.stringify([raw, file]);
  expect(output).not.toContain('new-access');
  expect(output).not.toContain('legacy-secret');
});
it('uses explicit machine credentials without refreshing or sending OAuth/legacy tokens', async () => {
  await store.locked(api, () => store.save(credential(), 'file'));
  const { client } = await connect({
    MOTE_AUTH_MODE: 'service',
    MOTE_SERVICE_API_URL: api,
    MOTE_SERVICE_CLIENT_ID: 'machine.access',
    MOTE_SERVICE_CLIENT_SECRET: 'machine-secret',
  });
  const result = await client.callTool({
    name: 'publish_markdown',
    arguments: { markdown: '# machine' },
  });
  expect(result.isError).toBeUndefined();
  expect(await events()).toEqual([
    { event: 'publish', authorized: true, mode: 'service', assets: 0 },
  ]);
  expect((await store.load(api))?.accessToken).toBe('old-access');
});
it('surfaces revoked machine credentials without reflected secrets or a fallback', async () => {
  const { client } = await connect({
    MOTE_AUTH_MODE: 'service',
    MOTE_SERVICE_API_URL: api,
    MOTE_SERVICE_CLIENT_ID: 'machine.access',
    MOTE_SERVICE_CLIENT_SECRET: 'wrong',
  });
  const result = await client.callTool({
    name: 'publish_markdown',
    arguments: { markdown: '# rejected' },
  });
  expect(result.isError).toBe(true);
  expect(JSON.stringify(result)).toContain('UNAUTHORIZED');
  expect(JSON.stringify(result)).not.toContain('machine-secret');
  expect(await events()).toHaveLength(1);
});
it.each(['missing-secret', 'target-mismatch'])(
  'rejects %s before uploading or reading files',
  async (mode) => {
    const { client } = await connect({
      MOTE_AUTH_MODE: 'service',
      MOTE_SERVICE_API_URL: mode === 'target-mismatch' ? 'https://other.example.com' : api,
      MOTE_SERVICE_CLIENT_ID: 'machine.access',
      MOTE_SERVICE_CLIENT_SECRET: mode === 'missing-secret' ? '' : 'machine-secret',
    });
    const result = await client.callTool({
      name: 'publish_markdown_file',
      arguments: { path: '/does-not-exist.md' },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toContain('service mode requires matching');
    expect(await events()).toEqual([]);
  },
);
it.each(['logged-out', 'refresh-pending'])(
  'starts without login and reports %s without browser or network',
  async (mode) => {
    await store.locked(api, () =>
      store.save({ ...credential(), refreshPending: mode === 'refresh-pending' }, 'file'),
    );
    if (mode === 'logged-out') await store.locked(api, () => store.remove(api));
    const { client } = await connect();
    for (const [name, args] of [
      ['publish_markdown', { markdown: '# no auth' }],
      ['publish_markdown_file', { path: '/does-not-exist.md' }],
    ] as const) {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result)).toContain('mote auth login');
    }
    expect(await events()).toEqual([]);
  },
);
