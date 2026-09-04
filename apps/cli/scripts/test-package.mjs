import { execFile } from 'node:child_process';
import { log } from 'node:console';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execPath, platform } from 'node:process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceManifest = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8'));
const expectedName = sourceManifest.publishConfig.name;
const expectedVersion = sourceManifest.version;
const temporaryDir = await mkdtemp(join(tmpdir(), 'mote-cli-package-'));
const command = (name) => (platform === 'win32' ? `${name}.cmd` : name);

try {
  const packDir = join(temporaryDir, 'pack');
  await mkdir(packDir);
  await execFileAsync(command('pnpm'), ['pack', '--pack-destination', packDir, '--silent'], {
    cwd: packageDir,
  });

  const tarball = (await readdir(packDir)).find((file) => file.endsWith('.tgz'));
  if (tarball === undefined) throw new Error('pnpm pack did not create a tarball');

  const installDir = join(temporaryDir, 'install');
  await execFileAsync(
    command('npm'),
    [
      'install',
      '--prefix',
      installDir,
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      join(packDir, tarball),
    ],
    { cwd: temporaryDir },
  );

  const installedPackageDir = join(installDir, 'node_modules', expectedName);
  const installedManifest = JSON.parse(
    await readFile(join(installedPackageDir, 'package.json'), 'utf8'),
  );
  if (installedManifest.name !== expectedName || installedManifest.version !== expectedVersion) {
    throw new Error(
      `installed ${installedManifest.name}@${installedManifest.version}, expected ${expectedName}@${expectedVersion}`,
    );
  }
  if (
    installedManifest.main !== './dist/index.js' ||
    installedManifest.types !== './dist/index.d.ts'
  ) {
    throw new Error('published main/types do not point to dist');
  }

  const bin = join(installDir, 'node_modules', '.bin', platform === 'win32' ? 'mote.cmd' : 'mote');
  await access(bin);
  const versionResult = await execFileAsync(bin, ['--version']);
  if (versionResult.stdout.trim() !== expectedVersion) {
    throw new Error(`mote --version returned ${versionResult.stdout.trim()}`);
  }

  const importCheck = join(installDir, 'check-import.mjs');
  await writeFile(
    importCheck,
    `import { CLI_VERSION } from ${JSON.stringify(expectedName)};\n` +
      `if (CLI_VERSION !== ${JSON.stringify(expectedVersion)}) throw new Error('version mismatch');\n`,
  );
  await execFileAsync(execPath, [importCheck], { cwd: installDir });

  const typeCheck = join(installDir, 'check-types.ts');
  await writeFile(
    typeCheck,
    `import { CLI_VERSION, buildBundle, type Bundle } from ${JSON.stringify(expectedName)};\n` +
      'const version: string = CLI_VERSION;\n' +
      'const build: (path: string) => Promise<Bundle> = buildBundle;\n' +
      'void version; void build;\n',
  );
  await execFileAsync(
    command('pnpm'),
    [
      'exec',
      'tsc',
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      '--target',
      'ES2022',
      '--lib',
      'ES2022,DOM',
      typeCheck,
    ],
    { cwd: packageDir },
  );

  log(`Verified ${expectedName}@${expectedVersion}: CLI, JavaScript, and type entry points work`);
} finally {
  await rm(temporaryDir, { recursive: true, force: true });
}
