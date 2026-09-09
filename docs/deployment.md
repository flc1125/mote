# Deployment operations

[简体中文](zh-CN/deployment.md)

This guide is for maintainers of production Workers connected to Cloudflare Workers Builds. For a new instance, complete [self-hosting](self-hosting.md) first.

## Deployment and release triggers

| Event               | Owner                                                          | Result                                                                                        |
| ------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Pull request        | GitHub Actions CI                                              | Lint, type checks, tests, Worker dry-runs and CLI package verification                        |
| Push to `main`      | GitHub Actions CI and Cloudflare Workers Builds, independently | CI checks the commit; each production Worker builds and deploys it                            |
| Stable `vX.Y.Z` tag | GitHub Actions Release                                         | Publish the verified CLI package through npm Trusted Publishing and create the GitHub Release |
| Retry or rollback   | Maintainer in Cloudflare Dashboard                             | An explicitly selected Worker build or version                                                |

Merging to `main` can deploy production before its push CI finishes. Require successful PR checks before merging; a green GitHub check alone does not prove deployment success. Tags do not deploy Workers or wait for a Worker rollout. The old GitHub Deploy and diagnostic workflows have been removed; do not rerun historical deployment jobs.

## Production domain cutover

Production uses `mote.pub`; `access-test` remains on `mote-test.flc.io`. The checked-in target allowlist selects the DNS zone per environment. Worker names, production R2 data, the Access issuer and application AUD stay unchanged.

Before merging the domain migration, prepare proxied DNS and a valid edge certificate for `mote.pub`, and verify that both Workers Builds credentials can manage routes in that zone. Coordinate the merge with replacing the existing production Access application's three public targets: `mote.pub/api/mcp`, `mote.pub/api/v1/publish` and `mote.pub/api/auth/*`. Preserve publisher policies, Managed OAuth and loopback client settings. The homepage, documents and health endpoints remain public.

This cutover accepts a short maintenance window instead of dual-host operation. Verify both Worker deployments and new-origin login, publication, document assets and remote MCP before declaring success. Current clients must [switch origin and reauthorize](authentication.md#moving-to-motepub); server deployment does not update installed CLI defaults. Old-domain redirects, if present, are temporary and may disappear at any time. Recovery must not depend on that host: preserve the new routes and hostname settings when rolling back incompatible application changes.

## Expected Workers Builds settings

In each Worker's **Settings → Build**, review these production settings. Forks must substitute their own repository, resources and identity configuration.

| Setting                      | `mote-api`                                              | `mote-viewer`                                              |
| ---------------------------- | ------------------------------------------------------- | ---------------------------------------------------------- |
| Repository                   | `flc1125/mote`                                          | `flc1125/mote`                                             |
| Production branch            | `main`                                                  | `main`                                                     |
| Root directory               | `/`                                                     | `/`                                                        |
| Build command                | Empty                                                   | Empty                                                      |
| Deploy command               | `pnpm --filter @mote/api exec wrangler deploy --env=""` | `pnpm --filter @mote/viewer exec wrangler deploy --env=""` |
| Non-production branch builds | Disabled                                                | Disabled                                                   |
| Build watch paths            | Include `*`; no exclusions                              | Include `*`; no exclusions                                 |
| Build cache                  | Enabled                                                 | Enabled                                                    |
| `NODE_VERSION`               | `24`                                                    | `24`                                                       |
| `PNPM_VERSION`               | `11.23.0`                                               | `11.23.0`                                                  |

The root stays at the workspace root for dependency installation; `pnpm --filter` executes Wrangler in the selected app. Explicit `--env=""` selects top-level production configuration. Wrangler bundles TypeScript during deploy, so there is no separate build command. Watching all paths includes shared packages, the lockfile, root configuration and documentation-only commits.

Use a dedicated Cloudflare build credential, managed in Cloudflare. Build variables and secrets are separate from Worker runtime configuration. Keep Worker names, routes, R2 bindings and non-secret runtime variables in `apps/api/wrangler.toml` and `apps/viewer/wrangler.toml`; manage runtime secrets separately. Access Service Tokens and Mote publishing credentials are not Cloudflare build credentials. See [Cloudflare build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).

Neither production connection deploys `access-test`. Test resources and the local probe remain separate. This setup uses no Deploy Hook.

## Validate a rollout

1. Record the expected full `main` SHA and its GitHub CI result.
2. Open **Deployments** for both Workers. Record each Build ID, source SHA, outcome, resulting Worker version and active traffic percentage. Both must match the expected commit and serve the intended production traffic.
3. Check `/health` and `/api/health`, then an existing document and its image. Verify successful responses, expected cache behavior, security headers and unchanged image bytes.
4. For authentication or publishing changes, also verify anonymous publication rejection, OAuth discovery and authorized user/service publication as applicable. A real publish creates a permanent public URL; use an explicitly approved non-sensitive sample. Routine documentation-only rollouts can reuse read-only samples and the established authentication baseline.

The Workers deploy independently: a temporary mixed-version window is expected, and one successful Build is not acceptance of the pair. Cross-API/CLI/Viewer changes need two-stage compatibility: first support old and new behavior, then remove old behavior only after both Workers and supported clients have migrated. Server deployment may precede the matching CLI release.

## Failed builds, retry and rollback

Inspect the affected Worker's Build log and current deployment first. Record the commit, Build ID, current version and intended recovery version. Keep credentials and private document URLs out of reports.

| Observation                              | Action                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Initialization, install or build failure | Resolve the prerequisite; read the active version rather than inferring it from the failed Build alone. |
| Only one Worker deployed                 | Inspect both versions and compatibility; there is no shared transaction or automatic pair rollback.     |
| Deploy timed out or outcome is unclear   | Read back the active version and traffic before retrying; deployment may have succeeded.                |
| Builds succeeded but smoke checks failed | Treat the rollout as unaccepted; investigate routing, runtime behavior and edge challenges.             |
| A newer commit is already deployed       | Review whether the older Build is still appropriate before retrying.                                    |

A maintainer performs retries and rollbacks in Cloudflare Dashboard after reviewing the exact target. Before retrying, recheck the current commands, branch, variables and credentials; do not assume the original settings are frozen. Before rollback, select known compatible Worker versions and account for pending automatic builds that could supersede recovery. Prefer a reviewed source correction through a PR when appropriate.

Worker rollback does not restore R2 data or independently managed DNS, Access policies and other infrastructure. Check routes, bindings and secrets against the intended state. Do not disable Access, enable alternate publishing hosts or delete R2 data to work around deployment failure. After recovery, repeat health, authentication rejection and existing document/image checks; verify real publishing separately when authorized.

## CLI release operations

Before pushing a stable tag, verify that it points to the intended commit and matches `apps/cli/package.json` and a non-empty changelog section. The workflow validates and packs the CLI, checks npm/tag/Release identity, publishes through OIDC, then creates or reconciles the GitHub Release. It does not deploy Workers.

For a failed release, inspect the original Actions run and preserve its manifest, tarball and result artifacts: `mote-release-<run-id>`, `mote-npm-result-<run-id>-<attempt>` and `mote-release-result-<run-id>-<attempt>`. Investigate uncertain publication outcomes against npm and GitHub before rerunning; identical results can be reconciled, while conflicting bytes or identity stop the workflow. Do not move a published tag, overwrite assets or add a long-lived npm token to bypass an error.

## Retiring old deployment resources

Inventory old GitHub environment credentials, deployment variables and Actions artifacts against current workflow references before removal. Record exact targets and obtain cleanup approval. Deleting a GitHub secret copy does not revoke its Cloudflare token; identify the token and its other consumers before a separate revocation.

Preserve the active Workers Builds credential, npm Trusted Publishing, GitHub Release assets, current Worker versions, R2 documents, Access resources and historical evidence still needed for an incident. Retiring GitHub deployment automation does not authorize deleting the test Worker pair or its bucket.
