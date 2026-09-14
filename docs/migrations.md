# Migration notes

Use this guide when updating an existing installation affected by a domain or authentication change. For a new setup, start with [first publication](quick-start.md) or [self-hosting](self-hosting.md). Release-specific details remain in the [changelog](../CHANGELOG.md).

## Moving to mote.pub

**Historical scope:** v0.5.0 changed the default production origin from `https://mote.flc.io` to `https://mote.pub`. These steps apply to clients still targeting the former default instance. Self-hosted instances keep their own origins.

Upgrading does not rewrite saved instances or explicit environment/configuration values. Update any old `MOTE_API_URL` or config `apiUrl`, then log in to the new origin:

```bash
mote login --api https://mote.pub --auth-mode oauth
mote auth status --api https://mote.pub --json
```

Successful login remembers the selected origin. It does not rewrite explicit environment or configuration overrides. Use explicit `--api` during migration; see [configuration selection](authentication.md#configuration-selection) for normal command behavior and the [changelog](../CHANGELOG.md) for release-specific login changes.

- **Remote MCP:** set the endpoint to `https://mote.pub/api/mcp` and authorize the connection separately.
- **Local stdio:** rebuild when upgrading its source, update any pinned API origin and restart the process.
- **Service clients:** update both the publishing API origin and `MOTE_SERVICE_API_URL` (or `serviceToken.apiUrl`). The Service Token must be authorized for the intended application.
- **Existing links:** document IDs are unchanged; use `https://mote.pub/<existing-id>`. Old-domain availability is not guaranteed.

Credentials are scoped to origins. Do not copy credentials between origins or rely on redirects: OAuth discovery and publication reject redirects. Worker deployment does not update installed CLI defaults.

## Production domain cutover

**Historical scope:** this records the production cutover associated with v0.5.0. It is not a routine deployment step. Current rollout and recovery procedures are in [deployment operations](deployment.md).

The cutover moved production to `mote.pub`, keeping `access-test` on `mote-test.flc.io`. The target allowlist selects the DNS zone per environment. Worker names, production R2 data, the Access issuer and application AUD were retained.

The coordinated cutover procedure was:

1. Prepare proxied DNS and a valid edge certificate for `mote.pub`; verify that both Workers Builds credentials can manage routes in its zone.
2. Coordinate the route/configuration merge with replacing the existing production Access application's public targets: `mote.pub/api/mcp`, `mote.pub/api/v1/publish` and `mote.pub/api/auth/*`.
3. Preserve publisher policies, Managed OAuth and loopback client settings. Keep the homepage, documents and health endpoints public.
4. Accept a short maintenance window instead of dual-host operation. Verify both Worker deployments, new-origin login, publication, document assets and remote MCP.
5. Have clients [switch origin and reauthorize](#moving-to-motepub).

Old-domain redirects, if present, are temporary. Recovery must not depend on that host: preserve the new routes and hostname settings when rolling back incompatible application changes. The two Workers deploy independently of CLI releases; the release tag alone is not evidence that the cutover succeeded.

## Migrate an existing instance to Access

**Scope:** Access support was introduced in v0.2.0. This procedure is for an existing token-mode instance whose operator chooses to move to Access. Token mode remains available; a new Access installation can start with [self-hosting](self-hosting.md#access-enabled-deployments).

1. Inventory all publishers and secret sources without recording values. Prepare a working token-mode rollback configuration and a maintenance window.
2. Follow [self-hosting](self-hosting.md#access-enabled-deployments) to prepare Access on an isolated hostname first. Test discovery, CLI login/status/publish/logout, stdio, Codex, service credentials and anonymous reads.
3. Obtain separate approval for the production Access policy and Worker switch. Do not copy the repository's test account, client IDs, AUD, routes or bucket into a new deployment.
4. Select OAuth for interactive publishers and service mode for unattended publishers. Remove old `MOTE_TOKEN`, `--token`, config `token`, and remote MCP Bearer settings from each migrated publisher. Update the actual parent process environment and restart stdio clients when necessary.
5. Verify old credentials cannot publish in Access mode and anonymous reading still works. Keep rollback secrets in an operator-controlled store until the approved rollback window closes; do not keep them as a hidden client fallback.
6. Revoke retired credentials only after accounting for their remaining users. For rollback, restore a working token-mode Worker first, then remove Access protection and explicitly restore clients; never expose an unauthenticated publishing interval.

Every publish is immutable and creates a new document. Do not retry timeouts, 5xx responses or uncertain outcomes automatically: a write may already have succeeded. Resolve the outcome before deciding to publish again.
