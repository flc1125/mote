# Repository Guidelines

## Project Structure & Module Organization

Mote is a TypeScript/pnpm monorepo for publishing Markdown as immutable pages on Cloudflare Workers and R2.

- `apps/cli`: CLI, asset scanning, authentication, and uploads.
- `apps/mcp`: local stdio MCP server built on the CLI pipeline.
- `apps/api`: authenticated REST and remote MCP Worker.
- `apps/viewer`: anonymous document/asset rendering Worker.
- `apps/auth-probe`: isolated Access verification app.
- `packages/core`, `protocol`, `renderer`: primitives, wire contracts, and safe rendering.
- `docs/`: architecture, protocol, security, and deployment guidance.

Keep shared behavior in packages. Tests live beside source as `src/*.test.ts` or in an app-level `test/` directory.

## Build, Test, and Development Commands

Use Node.js 20+ and the pinned pnpm version from `package.json`.

- `pnpm install --frozen-lockfile`: install locked dependencies.
- `pnpm lint`: run ESLint across the repository.
- `pnpm typecheck`: type-check every workspace package.
- `pnpm test`: run all Vitest suites, including Worker integration tests.
- `pnpm build`: build CLI/MCP bundles and dry-run Workers.
- `pnpm format:check`: verify Prettier formatting.
- `pnpm --filter @mote/cli test`: test one package.
- `pnpm --filter @mote/api dev`: run a Worker locally with Wrangler.

Before opening a PR, run the same sequence enforced by `.github/workflows/ci.yml`, including `pnpm --filter @mote/cli test:package`.

## Coding Style & Naming Conventions

TypeScript is strict and ESM-only. Use two-space indentation, single quotes, semicolons, and Prettier defaults. Use `camelCase` for functions/variables, `PascalCase` for types/classes, and uppercase snake case for constants. Preserve `.js` suffixes in relative imports. Prefer dependency injection at network/storage boundaries.

## Testing Guidelines

Use Vitest and name files `*.test.ts`. Add regression tests with every behavior change, especially for authentication, URL/path validation, multipart limits, manifest-last commits, cache headers, and XSS defenses. Do not weaken assertions to accommodate environment failures; Worker tests may require loopback networking and writable Wrangler logs.

## Commit & Pull Request Guidelines

Follow Conventional Commits: `feat:`, `fix:`, `docs:`, and `chore:`; add `!` for breaking changes. Keep commits focused. PRs should explain behavior, affected packages, security or migration implications, and validation. Link relevant issues. Include screenshots only for renderer/theme changes; never include secret URLs or credentials.

## Security & Configuration

Never commit tokens, OAuth credentials, `.dev.vars`, private keys, or local Wrangler/config files. Use explicit fake values in tests. Preserve authentication-before-body-read, capability-URL privacy, raw-HTML blocking, MIME magic-byte checks, and immutable publication semantics. Production deployment or Access-policy changes require separate review; a successful package build is not deployment authorization.
