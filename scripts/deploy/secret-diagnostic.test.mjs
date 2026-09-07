import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { root } from './lib.mjs';

const caller = await readFile(join(root, '.github/workflows/diagnose-secrets.yml'), 'utf8');
const shared = await readFile(join(root, '.github/workflows/_diagnose-secrets.yml'), 'utf8');
const declaration = [
  '    secrets:',
  '      CLOUDFLARE_API_TOKEN:',
  "        description: 'Resolved from the job Environment; callers must not forward it'",
  '        required: false',
].join('\n');
const job = (source, name) => source.split(`\n  ${name}:\n`)[1].split(/\n {2}[\w-]+:\n/)[0];
const uncommented = (source) => source.replace(/^\s*#.*$/gm, '');
const scriptFrom = (source) =>
  source
    .split('        run: |\n')[1]
    .split('\n\n')[0]
    .replace(/^ {10}/gm, '');

describe('secret availability diagnostic boundaries', () => {
  it('has a main-only manual entry with a fixed test environment', () => {
    expect(caller).toContain('on:\n  workflow_dispatch:\n');
    expect(caller).not.toMatch(/\b(inputs|push|pull_request|schedule):/);
    expect(caller.match(/github\.ref == 'refs\/heads\/main'/g)).toHaveLength(3);
    expect(caller.match(/github\.repository == 'flc1125\/mote'/g)).toHaveLength(3);
    expect(caller).toContain('group: mote-access-test');
    expect(caller).toContain('cancel-in-progress: false');
  });

  it('calls the same-commit reusable probe without passing secrets', () => {
    expect(caller).toContain('uses: ./.github/workflows/_diagnose-secrets.yml');
    expect(shared).toContain('on:\n  workflow_call:\n');
    expect(shared).toContain("github.event_name == 'workflow_dispatch'");
    expect(shared).toContain("github.ref == 'refs/heads/main'");
    expect(shared).toContain("github.repository == 'flc1125/mote'");
    expect(shared).toContain(
      "github.workflow_ref == 'flc1125/mote/.github/workflows/diagnose-secrets.yml@refs/heads/main'",
    );
    expect(uncommented(caller)).not.toMatch(/\b(secrets|with|inputs):/);
    expect(uncommented(shared.split('jobs:')[1])).not.toMatch(/\b(secrets|with|inputs):/);
  });

  it('retains the declared-secret reusable control', () => {
    const header = uncommented(shared.split('\npermissions:')[0]);
    expect(header).toContain(declaration);
    expect(header.split('    secrets:\n')[1].trimEnd()).toBe(
      declaration.split('    secrets:\n')[1],
    );
  });

  it('checks a direct Environment job downstream of the reusable workflow', () => {
    const after = job(caller, 'after-reusable');
    expect(after).toContain('needs: reusable');
    expect(after).not.toContain('always()');
    expect(after).toContain('environment: access-test');
    expect(after).not.toContain('uses:');
  });

  it('keeps the Cloudflare token only in the manual deployment entry point', async () => {
    const deploy = uncommented(await readFile(join(root, '.github/workflows/deploy.yml'), 'utf8'));
    const release = uncommented(
      await readFile(join(root, '.github/workflows/release.yml'), 'utf8'),
    );
    expect(deploy).not.toMatch(/^\s*secrets:/m);
    expect(deploy.match(/secrets\.CLOUDFLARE_API_TOKEN/g)).toHaveLength(1);
    expect(release).not.toMatch(/^\s*secrets:/m);
    expect(release).not.toMatch(/CLOUDFLARE|secrets\./);
  });

  for (const [name, source, owner] of [
    ['direct', job(caller, 'direct'), caller],
    ['reusable', job(shared, 'probe'), shared],
    ['after-reusable', job(caller, 'after-reusable'), caller],
  ]) {
    it(`${name} exposes only a Boolean and has no checkout, install, or deployment commands`, () => {
      const body = uncommented(source);
      expect(owner).toContain('permissions: {}');
      expect(body).toContain('environment: access-test');
      expect(body.match(/environment:/g)).toHaveLength(1);
      expect(body).toContain('timeout-minutes: 5');
      expect(body.match(/\$\{\{\s*secrets\./g)).toHaveLength(1);
      expect(body).toContain("TOKEN_PRESENT: ${{ secrets.CLOUDFLARE_API_TOKEN != '' }}");
      expect(body.match(/\brun:/g)).toHaveLength(1);
      expect(body).not.toContain('uses:');
      expect(body).not.toMatch(/production|: write|checkout|pnpm|npm|curl|wrangler|GITHUB_TOKEN/);
      expect(scriptFrom(source).trim()).toBe(
        'case "$TOKEN_PRESENT" in\n' +
          '  true|false) printf \'%s\\n\' "$TOKEN_PRESENT" ;;\n' +
          '  *) exit 1 ;;\n' +
          'esac',
      );
    });

    for (const value of ['true', 'false', '', 'fake-secret-do-not-print', '$(echo unsafe)']) {
      it(`${name} prints only Boolean values, rejecting ${JSON.stringify(value)}`, () => {
        const result = spawnSync('bash', ['--noprofile', '--norc', '-c', scriptFrom(source)], {
          env: { TOKEN_PRESENT: value },
          encoding: 'utf8',
        });
        expect(result.error).toBeUndefined();
        expect(result.stderr).toBe('');
        expect(result.status).toBe(['true', 'false'].includes(value) ? 0 : 1);
        expect(result.stdout).toBe(['true', 'false'].includes(value) ? `${value}\n` : '');
      });
    }
  }
});
