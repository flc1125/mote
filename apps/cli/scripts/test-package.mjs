import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { log } from 'node:console';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { argv, execPath, platform } from 'node:process';
import { parseArgs, promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceManifest = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8'));
const expectedName = sourceManifest.publishConfig.name;
const expectedVersion = sourceManifest.version;
const temporaryDir = await mkdtemp(join(tmpdir(), 'mote-cli-package-'));
const command = (name) => (platform === 'win32' ? `${name}.cmd` : name);
const { values } = parseArgs({ args: argv.slice(2), options: { tarball: { type: 'string' } } });
const digest = async (file) =>
  createHash('sha256')
    .update(await readFile(file))
    .digest('hex');

try {
  let tarballPath;
  if (values.tarball !== undefined) {
    tarballPath = resolve(values.tarball);
  } else {
    const packDir = join(temporaryDir, 'pack');
    await mkdir(packDir);
    await execFileAsync(command('pnpm'), ['pack', '--pack-destination', packDir, '--silent'], {
      cwd: packageDir,
    });
    const tarballs = (await readdir(packDir)).filter((file) => file.endsWith('.tgz'));
    if (tarballs.length !== 1) throw new Error('pnpm pack must create exactly one tarball');
    tarballPath = join(packDir, tarballs[0]);
  }
  const beforeDigest = await digest(tarballPath);

  const installDir = join(temporaryDir, 'install');
  await execFileAsync(
    command('npm'),
    ['install', '--prefix', installDir, '--ignore-scripts', '--no-audit', '--no-fund', tarballPath],
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
    installedManifest.types !== './dist/index.d.ts' ||
    installedManifest.bin?.mote !== './dist/cli.js' ||
    installedManifest.exports?.['.']?.import !== './dist/index.js' ||
    installedManifest.exports?.['.']?.types !== './dist/index.d.ts'
  ) {
    throw new Error('published main/types do not point to dist');
  }
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    if (
      Object.values(installedManifest[field] ?? {}).some((value) => value.startsWith('workspace:'))
    ) {
      throw new Error(`published ${field} contain workspace references`);
    }
  }

  const bin = join(installDir, 'node_modules', '.bin', platform === 'win32' ? 'mote.cmd' : 'mote');
  await access(bin);
  const versionResult = await execFileAsync(bin, ['--version']);
  if (versionResult.stdout.trim() !== expectedVersion) {
    throw new Error(`mote --version returned ${versionResult.stdout.trim()}`);
  }
  await execFileAsync(bin, ['--help']);

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

  if ((await digest(tarballPath)) !== beforeDigest)
    throw new Error('Tarball changed during verification');
  log(
    `Verified ${expectedName}@${expectedVersion}: CLI, JavaScript, and type entry points work; sha256=${beforeDigest}`,
  );
} finally {
  await rm(temporaryDir, { recursive: true, force: true });
}
