# Contributing to Mote

This guide covers working on Mote from a source checkout. For publishing documents, start with the [quick-start tutorial](docs/quick-start.md). For operating an instance, see [self-hosting](docs/self-hosting.md) and [deployment operations](docs/deployment.md).

## Development tools

- Use **Node.js 24**, matching [CI](.github/workflows/ci.yml).
- Use the exact **pnpm** version in the root [`packageManager`](package.json) field. With Corepack installed, run `corepack enable` and let the project select its pinned version. Otherwise, install that exact pnpm version before proceeding.
- Use Git to create a branch and submit a pull request.

The published CLI supports Node.js 20 or newer. Contributor tooling and Worker checks use Node.js 24; the CLI's minimum runtime is not the recommended development environment.

## Set up a checkout

Fork the repository if you need your own push destination, then clone it (substitute your fork URL as needed):

```bash
git clone https://github.com/flc1125/mote.git
cd mote
pnpm --version
pnpm install --frozen-lockfile
git switch -c docs/your-change
```

Run workspace commands below from the repository root. Use a branch name that describes your change.

## Repository map

| Path                                  | Responsibility                                               |
| ------------------------------------- | ------------------------------------------------------------ |
| `apps/cli`                            | CLI commands, local asset scanning, credentials and uploads  |
| `apps/mcp`                            | Local stdio MCP server using the CLI publishing pipeline     |
| `apps/api`                            | Authenticated REST and remote MCP Worker                     |
| `apps/viewer`                         | Anonymous document and asset rendering Worker                |
| `apps/auth-probe`                     | Isolated Access verification app                             |
| `packages/core`, `packages/protocol`  | Shared primitives and wire contracts                         |
| `packages/renderer`, `packages/theme` | Safe rendering, design tokens and baseline styles            |
| `scripts`                             | Build, package, release and automation checks                |
| `docs`                                | User guides, references, design and operations documentation |

Keep shared behavior in packages. Tests live next to source as `*.test.ts` or in an app's `test/` directory. Start with the [documentation index](docs/README.md) for architecture, protocol and security details.

## Develop locally

Build and inspect the CLI without installing it globally:

```bash
pnpm --filter @mote/cli build
node apps/cli/dist/cli.js --help
```

Run a focused suite while working:

```bash
pnpm --filter @mote/cli test
```

For local Worker development:

```bash
pnpm --filter @mote/api dev
```

Wrangler prints the local address; `/api/health` is the API health endpoint. Run `pnpm --filter @mote/viewer dev` for the Viewer (`/health`). Local health checks do not establish a complete authenticated publishing setup: the checked-in configuration uses Access. The Worker integration suites provide isolated storage and authentication fixtures for testing request behavior. Instance configuration and end-to-end deployment are covered by [self-hosting](docs/self-hosting.md).

## Verify a change

Before submitting a PR, run the same sequence as CI:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @mote/cli test:package
pnpm format:check
```

`pnpm build` bundles the CLI/MCP and performs credential-free Worker dry-runs. `test:package` checks the packed CLI as the release workflow does. These checks do not deploy Workers or publish npm packages.

Worker integration tests need loopback networking and writable Wrangler logs. One real system credential-store test is opt-in and skipped by default; see [`native-auth.test.ts`](apps/cli/test/native-auth.test.ts) for its `MOTE_NATIVE_AUTH_TEST=1` switch. Do not weaken assertions to accommodate a restricted test environment.

Use `pnpm format` to apply repository formatting, then review the diff. For documentation changes, also follow local links and anchors and verify that examples match the implementation.

## Code and documentation conventions

- TypeScript is strict, ESM-only, with two-space indentation, single quotes and semicolons. Preserve `.js` suffixes in relative imports.
- Use `camelCase` for functions and variables, `PascalCase` for types and classes, and uppercase snake case for constants.
- Prefer dependency injection at network and storage boundaries.
- Add meaningful regression coverage for behavior changes, especially authentication, path/URL validation, limits, manifest-last commits, caching and XSS defenses.
- Write user guides as direct descriptions of product behavior and usable steps. Keep release-specific differences in the [changelog](CHANGELOG.md) and [migration notes](docs/migrations.md).
- Update corresponding translations when changing shared instructions. Preserve old heading anchors when moving linked sections.

Preserve authentication-before-body-read, capability-URL privacy, raw-HTML blocking, MIME magic-byte checks and immutable publication semantics. Use explicit fake credentials in tests. Keep tokens, OAuth credentials, `.dev.vars`, private keys and local Wrangler/config files out of commits.

## Submit a pull request

1. Keep the change focused and review `git diff` for unrelated edits or generated files.
2. Complete the checks above and record their results.
3. Use a Conventional Commit message such as `fix: validate image paths` or `docs: clarify login setup`; mark breaking changes with `!`.
4. Push your branch and open a PR describing the behavior, affected packages, validation, and any security or migration implications. Link relevant issues. Include screenshots for renderer/theme changes without exposing private document URLs or credentials.

Production deployment and Access-policy changes require separate review. Successful local checks are not deployment authorization. Report suspected vulnerabilities through the [security policy](SECURITY.md).
