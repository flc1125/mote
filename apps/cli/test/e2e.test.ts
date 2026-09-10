import { createHash } from 'node:crypto';
import { HISTORY_SCRIPT } from '../../../packages/renderer/src/history-script.js';
import { TOC_SCRIPT } from '../../../packages/renderer/src/toc-script.js';
import { execFile } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { Miniflare } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MAX_MARKDOWN_BYTES } from '@mote/core';

import apiWorker from '../../api/src/index.js';
import viewerWorker from '../../viewer/src/index.js';

import { run } from '../src/run.js';

const execFileAsync = promisify(execFile);

const TOKEN = 'e2e-token';
const VIEWER_BASE = 'http://viewer.local';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 9]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');

let mf: Miniflare;
let bucket: R2Bucket;
let server: Server;
let apiUrl: string;
let workDir: string;

function nodeHeadersToInit(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const init: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    init[key] = Array.isArray(value) ? value.join(', ') : value;
  }
  return init;
}

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'mote-e2e-'));

  // Real R2 implementation shared by both workers.
  mf = new Miniflare({
    modules: true,
    script: 'export default {}',
    r2Buckets: ['DOCUMENTS'],
  });
  bucket = (await mf.getR2Bucket('DOCUMENTS')) as unknown as R2Bucket;

  // Serve the API worker over real HTTP so the CLI exercises its actual
  // network path (multipart encoding included).
  const apiEnv = { DOCUMENTS: bucket, MOTE_TOKEN: TOKEN, VIEWER_BASE_URL: VIEWER_BASE };
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      void (async () => {
        const body = Buffer.concat(chunks);
        const request = new Request(`http://api.local${req.url ?? '/'}`, {
          method: req.method,
          headers: nodeHeadersToInit(req.headers),
          body: body.length > 0 ? body : undefined,
        });
        const response = await apiWorker.fetch(request, apiEnv);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
      })().catch((error: unknown) => {
        res.writeHead(500);
        res.end(String(error));
      });
    });
  });
  await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  apiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolveClose) => server.close(resolveClose));
  await mf.dispose();
  await rm(workDir, { recursive: true, force: true });
});

async function makeDoc(files: Record<string, string | Uint8Array>): Promise<string> {
  const dir = await mkdtemp(join(workDir, 'doc-'));
  for (const [name, content] of Object.entries(files)) {
    if (name.includes('/')) await mkdir(join(dir, name.split('/')[0]!), { recursive: true });
    await writeFile(join(dir, name), content);
  }
  return join(dir, 'README.md');
}

async function runCli(args: string[]): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await run(
    args,
    { stdout: (t) => out.push(t), stderr: (t) => err.push(t) },
    {
      env: {},
      configPath: join(workDir, 'no-config.json'),
    },
  );
  return { code, out: out.join('\n'), err: err.join('\n') };
}

function view(path: string): Promise<Response> {
  return viewerWorker.fetch(new Request(`${VIEWER_BASE}${path}`), { DOCUMENTS: bucket });
}

async function publishDoc(markdownPath: string): Promise<{ id: string; url: string }> {
  const result = await runCli([markdownPath, '--json', '--api', apiUrl, '--token', TOKEN]);
  expect(result.code).toBe(0);
  expect(result.err).toBe('');
  const parsed = JSON.parse(result.out) as { id: string; url: string };
  expect(parsed.url).toBe(`${VIEWER_BASE}/${parsed.id}`);
  return parsed;
}

function assetPaths(html: string): string[] {
  return [...html.matchAll(/src="(\/[^"]+\/a\/[^"]+)"/g)].flatMap((match) =>
    match[1] ? [match[1]] : [],
  );
}

function expectDocumentScriptPolicy(response: Response, html: string): void {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  expect(scripts).toEqual([TOC_SCRIPT, HISTORY_SCRIPT]);
  const hashes = scripts
    .map((script) => `'sha256-${createHash('sha256').update(script!).digest('base64')}'`)
    .join(' ');
  const policy = response.headers.get('Content-Security-Policy')!;
  expect(policy.split('; ').find((directive) => directive.startsWith('script-src '))).toBe(
    `script-src ${hashes}`,
  );
  expect(policy).toContain("connect-src 'none'");
}

describe('E2E (§59)', () => {
  it('publishes the committed mixed specimen with one deduplicated image and unchanged source', async () => {
    const file = fileURLToPath(
      new URL('../../../docs/examples/markdown-compatibility.md', import.meta.url),
    );
    const source = await readFile(file, 'utf8');
    const { id } = await publishDoc(file);
    expect(await (await bucket.get(`documents/${id}/document.md`))?.text()).toBe(source);
    const page = await view(`/${id}`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expectDocumentScriptPolicy(page, html);
    expect(html.match(/aria-label="Mermaid diagram"/g)).toHaveLength(4);
    expect(html.match(/<math\b/g)).toHaveLength(6);
    const paths = assetPaths(html);
    expect(paths).toHaveLength(2);
    expect(new Set(paths).size).toBe(1);
    const image = await view(paths[0]!);
    expect(image.status).toBe(200);
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(
      new Uint8Array(await readFile(new URL('../../../docs/assets/logo.png', import.meta.url))),
    );
  });
  it('keeps stored front matter intact while rendering only the body with highlighted code', async () => {
    const source =
      '---\ntitle: Hidden metadata\ndescription: "![hidden](missing.png)"\n---\n# Body title\n\n![image](body.png)\n\n~~~js\nconst message = "<hello>";\n~~~';
    const doc = await makeDoc({ 'README.md': source, 'body.png': PNG });
    const { id } = await publishDoc(doc);
    expect(await (await bucket.get(`documents/${id}/document.md`))?.text()).toBe(source);
    const response = await view(`/${id}`);
    const html = await response.text();
    expectDocumentScriptPolicy(response, html);
    expect(html).toContain('<title>Body title</title>');
    expect(html).not.toContain('Hidden metadata');
    expect(html).not.toContain('missing.png');
    expect(html).toContain('<span class="hljs-keyword">const</span>');
    expect(html).toContain('&lt;hello&gt;');
    const paths = assetPaths(html);
    expect(paths).toHaveLength(1);
    expect((await view(paths[0]!)).status).toBe(200);
  });

  it('publishes alert and details images with Unicode/space paths through CLI, API and Viewer', async () => {
    const doc = await makeDoc({
      'README.md':
        '# Compatibility\n\n> [!NOTE]\n> **说明：**[![图][image]](https://example.com)\n\n[image]: <图片/a (1).png>\n\n<details><summary>More</summary>\n\n<p align="center"><picture><source srcset="%E5%9B%BE%E7%89%87/a%20(1).png 1x"><img src="图片/a (1).png" alt="raw"></picture></p>\n\n</details>',
      '图片/a (1).png': PNG,
    });
    const { id } = await publishDoc(doc);
    const page = await view(`/${id}`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expectDocumentScriptPolicy(page, html);
    expect(html).toContain('class="markdown-alert markdown-alert-note"');
    expect(html).toContain('<strong>说明：</strong>');
    const paths = assetPaths(html);
    expect(paths).toHaveLength(2);
    expect(new Set(paths).size).toBe(1);
    expect(html).toContain(`srcset="${paths[0]} 1x"`);
    expect(html).not.toContain('a%20(1).png');
    expect(html).not.toContain('a (1).png');
    const asset = await view(paths[0]!);
    expect(asset.status).toBe(200);
    expect(new Uint8Array(await asset.arrayBuffer())).toEqual(PNG);
  });

  it('case 1: plain Markdown publishes and renders', async () => {
    const doc = await makeDoc({ 'README.md': '# Pure Markdown\n\nHello **world**.\n' });
    const { id } = await publishDoc(doc);

    const page = await view(`/${id}`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('<h1 id="pure-markdown">Pure Markdown</h1>');
    expect(html).toContain('<strong>world</strong>');
  });

  it('case 2: Markdown + PNG renders and serves the asset', async () => {
    const doc = await makeDoc({
      'README.md': '# With PNG\n\n![demo](./images/demo.png)\n',
      'images/demo.png': PNG,
    });
    const { id } = await publishDoc(doc);

    const html = await (await view(`/${id}`)).text();
    expect(html).not.toContain('demo.png'); // original file name never leaks
    const [assetPath] = assetPaths(html);
    expect(assetPath).toBeDefined();

    const asset = await view(assetPath!);
    expect(asset.status).toBe(200);
    expect(asset.headers.get('Content-Type')).toBe('image/png');
    expect(new Uint8Array(await asset.arrayBuffer())).toEqual(PNG);
  });

  it('case 3: Markdown with multiple images serves them all', async () => {
    const doc = await makeDoc({
      'README.md': '# Multi\n\n![a](./a.png)\n\n![b](./b.webp)\n',
      'a.png': PNG,
      'b.webp': WEBP,
    });
    const { id } = await publishDoc(doc);

    const html = await (await view(`/${id}`)).text();
    const paths = assetPaths(html);
    expect(paths).toHaveLength(2);

    const types = await Promise.all(
      paths.map(async (path) => (await view(path)).headers.get('Content-Type')),
    );
    expect(types.sort()).toEqual(['image/png', 'image/webp']);
  });

  it('case 4: remote images stay untouched', async () => {
    const doc = await makeDoc({
      'README.md': '# Remote\n\n![ext](https://example.com/x.png)\n',
    });
    const { id } = await publishDoc(doc);

    const html = await (await view(`/${id}`)).text();
    expect(html).toContain('src="https://example.com/x.png"');
    expect(html).toContain('no-referrer');
  });

  it('case 5: a nonexistent document returns 404', async () => {
    const page = await view('/P8wQr4TmK2aX9NsV');
    expect(page.status).toBe(404);
  });

  it('case 6: an invalid token is rejected', async () => {
    const doc = await makeDoc({ 'README.md': '# Secret\n' });
    const result = await runCli([doc, '--json', '--api', apiUrl, '--token', 'wrong-token']);
    expect(result.code).toBe(1);
    expect(result.err).toContain('UNAUTHORIZED');
    expect(result.err).not.toContain(TOKEN);
  });

  it('case 7: an unsupported SVG is rejected', async () => {
    const doc = await makeDoc({
      'README.md': '# SVG\n\n![icon](./icon.svg)\n',
      'icon.svg': SVG,
    });
    const result = await runCli([doc, '--json', '--api', apiUrl, '--token', TOKEN]);
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/unsupported image type/);
  });

  it('case 8: an oversized bundle is rejected', async () => {
    const doc = await makeDoc({ 'README.md': 'x'.repeat(MAX_MARKDOWN_BYTES + 1) });
    const result = await runCli([doc, '--json', '--api', apiUrl, '--token', TOKEN]);
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/limit is/);
  });
});

describe('M4 gate: built binary publishes end to end', () => {
  it('node dist/cli.js <file> --json completes publish -> view', async () => {
    // Exercise the shipped build configuration, including dependency interop.
    await execFileAsync(process.execPath, ['scripts/build.mjs']);

    const doc = await makeDoc({
      'README.md': '# Binary E2E\n\n![demo](./demo.png)\n',
      'demo.png': PNG,
    });

    const { stdout } = await execFileAsync(
      process.execPath,
      ['dist/cli.js', doc, '--json', '--api', apiUrl, '--token', TOKEN],
      { env: { PATH: process.env.PATH, XDG_CONFIG_HOME: workDir } },
    );
    const { id } = JSON.parse(stdout) as { id: string; url: string };

    const page = await view(`/${id}`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('<h1 id="binary-e2e">Binary E2E</h1>');
    expect(assetPaths(html)).toHaveLength(1);
  }, 60_000);
});
