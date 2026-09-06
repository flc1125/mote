import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { root } from './lib.mjs';

const caller = await readFile(join(root, '.github/workflows/diagnose-secrets.yml'), 'utf8');
const shared = await readFile(join(root, '.github/workflows/_diagnose-secrets.yml'), 'utf8');
const deploy = await readFile(join(root, '.github/workflows/_deploy.yml'), 'utf8');
const declaration = [
  '    secrets:',
  '      CLOUDFLARE_API_TOKEN:',
  "        description: 'Resolved from the job Environment; callers must not forward it'",
  '        required: false',
].join('\n');
const deploymentDeclaration = [
  declaration,
  '      MOTE_SERVICE_CLIENT_ID:',
  "        description: 'Existing optional write-smoke credential from the job Environment'",
  '        required: false',
  '      MOTE_SERVICE_CLIENT_SECRET:',
  "        description: 'Existing optional write-smoke credential from the job Environment'",
  '        required: false',
].join('\n');
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
    expect(caller.match(/github\.ref == 'refs\/heads\/main'/g)).toHaveLength(2);
    expect(caller.match(/github\.repository == 'flc1125\/mote'/g)).toHaveLength(2);
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

  it('probes the same optional, narrowly declared secret as the deployment workflow', () => {
    for (const [source, expected] of [
      [deploy, deploymentDeclaration],
      [shared, declaration],
    ]) {
      const header = uncommented(source.split('\npermissions:')[0]);
      expect(header).toContain(declaration);
      expect(header.match(/ {4}secrets:/g)).toHaveLength(1);
      const secretSection = header
        .split('    secrets:\n')[1]
        .split(/\n {4}\w/)[0]
        .trimEnd();
      expect(secretSection).toBe(expected.split('    secrets:\n')[1]);
    }
    expect(deploy).toContain('environment: ${{ inputs.environment }}');
    expect(deploy.match(/\$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/g)).toHaveLength(1);
  });

  it('does not add secret forwarding to either deployment entry point', async () => {
    for (const file of ['deploy.yml', 'release.yml']) {
      const source = uncommented(await readFile(join(root, '.github/workflows', file), 'utf8'));
      expect(source).not.toMatch(/^\s*secrets:/m);
      expect(source).not.toContain('secrets.CLOUDFLARE_API_TOKEN');
    }
  });

  for (const [name, source] of [
    ['direct', caller],
    ['reusable', shared],
  ]) {
    it(`${name} exposes only a Boolean and has no checkout, install, or deployment commands`, () => {
      const body = uncommented(source);
      expect(body).toContain('permissions: {}');
      expect(body).toContain('environment: access-test');
      expect(body.match(/environment:/g)).toHaveLength(1);
      expect(body).toContain('timeout-minutes: 5');
      expect(body.match(/\$\{\{\s*secrets\./g)).toHaveLength(1);
      expect(body).toContain("TOKEN_PRESENT: ${{ secrets.CLOUDFLARE_API_TOKEN != '' }}");
      expect(body.match(/\brun:/g)).toHaveLength(1);
      expect(body.match(/\buses:.*$/gm) ?? []).toEqual(
        name === 'direct' ? ['uses: ./.github/workflows/_diagnose-secrets.yml'] : [],
      );
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
