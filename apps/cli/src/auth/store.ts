import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { CliError } from '../errors.js';
import type { OAuthCredential } from './types.js';
import { apiOrigin, trustedIssuer } from './urls.js';
import { verifyWindowsAcl } from './windows-acl.js';

export type Backend = 'keyring' | 'file';
interface Profile {
  version: 1;
  apiUrl: string;
  issuer: string;
  resource: string;
  backend: Backend;
  key: string;
  loggedOut?: boolean;
}
export interface KeyringEntry {
  getPassword(): string | null;
  setPassword(value: string): void;
  deletePassword(): boolean;
}
export interface StoreOptions {
  directory: string;
  entry?: (key: string) => Promise<KeyringEntry>;
  lockTimeoutMs?: number;
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const errno = (error: unknown) => (error as NodeJS.ErrnoException).code;

/** No automatic backend fallback: existing keyring errors always fail closed. */
export class CredentialStore {
  readonly directory: string;
  constructor(private options: StoreOptions) {
    this.directory = options.directory;
  }
  private async directoryReady(create = true) {
    const created = create
      ? await mkdir(this.directory, { recursive: true, mode: 0o700 })
      : undefined;
    let stat;
    try {
      stat = await lstat(this.directory);
    } catch (error) {
      if (!create && errno(error) === 'ENOENT') return false;
      throw error;
    }
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      (process.platform !== 'win32' &&
        ((stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.()))
    ) {
      throw new CliError('auth directory must be owned by the current user with mode 0700');
    }
    if (process.platform === 'win32') await verifyWindowsAcl(this.directory, !!created);
    return true;
  }
  private path(api: string) {
    return join(this.directory, `${hash(apiOrigin(api))}.json`);
  }
  private async read(path: string): Promise<string | undefined> {
    try {
      if (process.platform === 'win32') {
        await lstat(path); // Preserve ENOENT semantics before invoking ACL validation.
        await verifyWindowsAcl(path);
      }
      const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      try {
        const stat = await file.stat();
        if (
          !stat.isFile() ||
          stat.size > 128 * 1024 ||
          (process.platform !== 'win32' &&
            ((stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.()))
        ) {
          throw new CliError('unsafe auth file permissions or type');
        }
        return await file.readFile('utf8');
      } finally {
        await file.close();
      }
    } catch (error) {
      if (errno(error) === 'ENOENT') return;
      throw new CliError('cannot safely read auth storage');
    }
  }
  private async atomic(path: string, value: unknown) {
    const temp = join(dirname(path), `.${randomUUID()}.tmp`);
    const file = await open(temp, 'wx', 0o600);
    try {
      await file.writeFile(JSON.stringify(value));
      await file.sync();
      await file.close();
      await rename(temp, path);
      if (process.platform !== 'win32') {
        const directory = await open(dirname(path), 'r');
        try {
          await directory.sync();
        } finally {
          await directory.close();
        }
      }
    } finally {
      await file.close();
      await unlink(temp).catch(() => {});
    }
  }
  private async keyring(key: string) {
    try {
      if (this.options.entry) return await this.options.entry(key);
      const { Entry } = await import('@napi-rs/keyring');
      return new Entry('Mote OAuth', key);
    } catch {
      throw new CliError(
        'system credential store unavailable; explicitly use mote auth login --credential-store file on supported systems',
      );
    }
  }
  private async profile(api: string): Promise<Profile | undefined> {
    const raw = await this.read(this.path(api));
    if (raw === undefined) return;
    let p: Profile;
    try {
      p = JSON.parse(raw);
    } catch {
      throw new CliError('invalid auth profile');
    }
    if (
      p.version !== 1 ||
      p.apiUrl !== apiOrigin(api) ||
      !['keyring', 'file'].includes(p.backend) ||
      p.resource !== `${p.apiUrl}/api/mcp` ||
      p.issuer !== trustedIssuer(p.issuer) ||
      p.key !== hash(JSON.stringify([p.apiUrl, p.issuer, p.resource]))
    )
      throw new CliError('auth profile binding mismatch');
    return p;
  }
  async backend(api: string) {
    if (!(await this.directoryReady(false))) return;
    return (await this.profile(api))?.backend;
  }
  async load(api: string): Promise<OAuthCredential | undefined> {
    if (!(await this.directoryReady(false))) return;
    const p = await this.profile(api);
    if (!p) return;
    if (p.loggedOut) return;
    let raw: string | null | undefined;
    if (p.backend === 'file') {
      raw = await this.read(join(this.directory, `${p.key}.credential`));
    } else {
      try {
        raw = (await this.keyring(p.key)).getPassword();
      } catch {
        throw new CliError(
          'cannot read system credentials; unlock the credential store and retry (no fallback performed)',
        );
      }
    }
    if (!raw) throw new CliError('saved credential missing; run mote auth login');
    let c: OAuthCredential;
    try {
      c = JSON.parse(raw);
    } catch {
      throw new CliError('invalid stored credential');
    }
    if (
      c.version !== 1 ||
      c.apiUrl !== p.apiUrl ||
      c.issuer !== p.issuer ||
      c.resource !== p.resource ||
      typeof c.accessToken !== 'string' ||
      typeof c.clientId !== 'string' ||
      !Number.isFinite(c.expiresAt) ||
      c.identity?.kind !== 'user' ||
      c.server?.issuer !== p.issuer
    )
      throw new CliError('stored credential binding mismatch');
    return c;
  }
  /** Caller holds the API lock. Backend cannot change without logout. */
  async save(c: OAuthCredential, backend?: Backend) {
    await this.directoryReady();
    const previous = await this.profile(c.apiUrl);
    const selected = backend ?? previous?.backend ?? 'keyring';
    if (previous && !previous.loggedOut && previous.backend !== selected)
      throw new CliError('log out before changing credential backend');
    const key = hash(JSON.stringify([c.apiUrl, c.issuer, c.resource]));
    if (previous && !previous.loggedOut && previous.key !== key)
      throw new CliError('issuer/resource changed; log out before changing authority');
    if (selected === 'file') {
      await this.atomic(join(this.directory, `${key}.credential`), c);
    } else {
      try {
        (await this.keyring(key)).setPassword(JSON.stringify(c));
      } catch {
        throw new CliError(
          'cannot save system credentials; no file fallback performed (use --credential-store file explicitly if unavailable)',
        );
      }
    }
    await this.atomic(this.path(c.apiUrl), {
      version: 1,
      apiUrl: c.apiUrl,
      issuer: c.issuer,
      resource: c.resource,
      backend: selected,
      key,
    });
  }
  async remove(api: string) {
    await this.directoryReady();
    const p = await this.profile(api);
    if (!p) return;
    if (p.backend === 'file')
      await unlink(join(this.directory, `${p.key}.credential`)).catch((error) => {
        if (errno(error) !== 'ENOENT') throw error;
      });
    else {
      try {
        (await this.keyring(p.key)).deletePassword();
      } catch {
        throw new CliError(
          'cannot delete system credentials; unlock the credential store and retry',
        );
      }
    }
    // Keep OAuth selection after logout; never silently resurrect an old MOTE_TOKEN.
    await this.atomic(this.path(api), { ...p, loggedOut: true });
  }
  async locked<T>(api: string, action: () => Promise<T>): Promise<T> {
    await this.directoryReady();
    const path = this.path(api) + '.lock';
    const nonce = randomUUID();
    const start = Date.now();
    for (;;) {
      try {
        const file = await open(path, 'wx', 0o600);
        try {
          await file.writeFile(JSON.stringify({ pid: process.pid, nonce }));
        } finally {
          await file.close();
        }
        break;
      } catch (error) {
        if (errno(error) !== 'EEXIST') throw error;
        // Only reap a known dead owner; never steal locks based on age.
        let reap;
        try {
          reap = await open(path + '.reap', 'wx', 0o600);
          const owner = JSON.parse(await readFile(path, 'utf8')) as { pid: number };
          if (Number.isSafeInteger(owner.pid) && owner.pid > 0) {
            try {
              process.kill(owner.pid, 0);
            } catch (e) {
              if (errno(e) === 'ESRCH') await unlink(path);
            }
          }
        } catch {
          /* Incomplete/ambiguous locks fail closed after timeout. */
        } finally {
          if (reap) {
            await reap.close();
            await unlink(path + '.reap');
          }
        }
        if (Date.now() - start > (this.options.lockTimeoutMs ?? 15000))
          throw new CliError(
            'auth operation locked; retry after the other process exits (incomplete locks require manual recovery)',
          );
        await delay(50);
      }
    }
    try {
      return await action();
    } finally {
      const owner = JSON.parse(await readFile(path, 'utf8')) as { nonce: string };
      if (owner.nonce === nonce) await unlink(path);
    }
  }
}
