# Authentication and migration

This guide describes the **unreleased source implementation**. The v0.1.1 release and the production deployment have not been migrated by this work. Build the reviewed source revision before using `mote auth`; installing an older npm package does not add these commands. Examples use your own Access-enabled instance, not the default production host.

## Choose a mode

Server and client settings have different values:

| Server `MOTE_AUTH_MODE`  | Client `--auth-mode` / `MOTE_AUTH_MODE` | Credential                                           |
| ------------------------ | --------------------------------------- | ---------------------------------------------------- |
| `token` (server default) | `token`                                 | Existing Mote `MOTE_TOKEN`                           |
| `cloudflare-access`      | `oauth`                                 | Interactive user login and refresh token             |
| `cloudflare-access`      | `service`                               | Access Service Token Client ID **and** Client Secret |

Do not export the server value `cloudflare-access` into a CLI or stdio process. A Cloudflare management API token or Wrangler login is **not** a Mote publishing credential. Access mode never falls back to the server's old Mote token.

## User login: CLI and local stdio

From the repository, build the CLI; replace the example origin with your configured instance:

```bash
pnpm --filter @mote/cli build
export MOTE_API_URL="https://mote.example.com"
export MOTE_AUTH_MODE="oauth"
node apps/cli/dist/cli.js auth login
node apps/cli/dist/cli.js auth status --json
node apps/cli/dist/cli.js report.md --json
node apps/cli/dist/cli.js auth logout --json
```

With that build installed, use `mote auth login`, `mote auth status`, `mote report.md`, and `mote auth logout`. Use `--api` with an **origin**, not `/api/mcp` or `/api/v1/publish`. OAuth and service modes require HTTPS. Each target has separate credentials.

Login opens a browser for the configured identity provider and consent. `--no-browser` prints the authorization URL instead, but still requires an interactive terminal. Login does not support `--json`; publishing, status and logout never initiate browser login. An expired or revoked session requires an explicit `mote auth login`.

Login registers a public client unless `--client-id` is supplied. The Mote CLI callback is `http://127.0.0.1:<port>/oauth/callback`; `--callback-port` fixes its port. In the tested Access setup, reusing a client with another port was rejected. Preserve the exact registered URI and port, or register a new client. Do not reuse a Codex callback for the CLI. Pending login waits up to 10 minutes; do not replay a previous authorization URL/code after a failed or cancelled attempt.

### Credential storage and refresh

- Default: system credential store, verified on macOS Keychain. Local stdio uses the same Mote store; Codex manages its own credentials independently.
- Explicit fallback: `mote auth login --credential-store file`. This is **plaintext**, not encrypted storage. On macOS the auth directory must be owned by the current user with mode `0700`, and credential files with mode `0600`. There is no automatic fallback when Keychain fails. Log out before changing backends.
- Storage metadata and locks live under `$XDG_CONFIG_HOME/mote/auth`, or `~/.config/mote/auth`. Metadata must remain intact even when secrets are in Keychain. Do not copy, print or commit this directory.
- CLI and stdio serialize refreshes using a target-specific inter-process lock. Near-expiry credentials are refreshed before use. An interrupted/uncertain refresh is not replayed; log in again when instructed.
- `auth status --offline --json` reports cached state, **not** online authentication. Online status can refresh and verifies `/api/auth/session`. `authorizationSessionExpiresAt: null` means unknown, not unlimited. The Mote CLI cannot report Codex's login status.

Only macOS CLI/stdio and Codex CLI 0.153.4's app-server were verified in the current rollout. Other MCP clients and Linux/Windows were excluded; retained code is not a compatibility guarantee.

## Configuration selection

API URL, static token and explicit auth mode each resolve as flags → environment → config file → default. Auth mode is chosen separately from the presence of credentials:

1. Explicit `--auth-mode`, `MOTE_AUTH_MODE`, or `authMode` wins.
2. Otherwise, an existing OAuth profile for this target selects OAuth, including its logged-out marker.
3. Otherwise, use static token mode. Merely setting Service Token variables does **not** select service mode.

`--token` does not override an OAuth selection. Logout retains a non-secret selection marker so a stale `MOTE_TOKEN` cannot silently become active again. Explicit token mode can still be selected intentionally for a token-mode server.

If **any** of the three service environment variables is defined, the entire environment triple replaces the config file's `serviceToken` object; incomplete environment values are not filled from the file.

## Machine publishing

An administrator creates an Access Service Token for this workload and adds that specific token to a **Service Auth** policy attached only to the intended Mote application. Avoid an “Any service token” rule. Inject the secret through your runner's secret store; the following values are placeholders, not commands to paste with real secrets into shared logs or shell history:

```bash
export MOTE_AUTH_MODE="service"
export MOTE_API_URL="https://mote.example.com"
export MOTE_SERVICE_API_URL="https://mote.example.com"
export MOTE_SERVICE_CLIENT_ID="<client-id>"
export MOTE_SERVICE_CLIENT_SECRET="<client-secret>"
mote auth status --json
mote report.md --json
```

The normalized service origin must match the publishing origin. Mote sends the ID/Secret pair on each request, does not reuse Access cookies, and does not perform OAuth refresh or browser login. Missing, wrong or disabled credentials fail; no fallback to user or static-token credentials occurs. The same configuration works for local stdio. The verified remote Codex setup uses OAuth instead.

For rotation, create a replacement, authorize only the same application, update the workload secret store, verify identity and one non-sensitive publish, then disable the old token and verify rejection from both an existing and a new process. Remove old secret copies. For suspected compromise, disable immediately before recovery. Choose expiration deliberately and set a renewal reminder; do not infer Service Token expiry from the OAuth settings. See [Cloudflare Service Tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/).

## Session duration, logout and revocation

The isolated rollout used **168h access tokens / 720h authorization sessions** (7 days / 30 days), accepted and read back through the Access API. This is a chosen long-lived local-use policy, not a universal default or a recommendation for all deployments. A stolen token remains useful until expiry or effective revocation; shorten durations for higher-risk use.

The regression temporarily used 10-minute access tokens and verified natural-window, no-browser reuse, application revocation refusal and reauthorization recovery. It did **not** wait 7 or 30 days. Do not label those full natural lifetimes as tested.

`mote auth logout` removes local Mote OAuth secrets for the selected origin only. It does not revoke Cloudflare grants, disable Service Tokens, remove static-token configuration, log out Codex, or delete published documents. `codex mcp logout <server>` similarly targets that Codex MCP login, not the Codex account. An administrator must separately revoke the appropriate Access user/application sessions or disable the machine token. Application-wide revocation affects other users of that application; verify its scope before acting. Already published capability URLs remain readable.

## Migrate an existing instance

1. Inventory all publishers and secret sources without recording values. Prepare a working token-mode rollback configuration and a maintenance window.
2. Follow [self-hosting](self-hosting.md#access-enabled-deployments-unreleased) to prepare Access on an isolated hostname first. Test discovery, CLI login/status/publish/logout, stdio, Codex, service credentials and anonymous reads.
3. Obtain separate approval for the production Access policy and Worker switch. Do not copy the repository's test account, client IDs, AUD, routes or bucket into a new deployment.
4. Select OAuth for interactive publishers and service mode for unattended publishers. Remove old `MOTE_TOKEN`, `--token`, config `token`, and remote MCP Bearer settings from each migrated publisher. Update the actual parent process environment and restart stdio clients when necessary.
5. Verify old credentials cannot publish in Access mode and anonymous reading still works. Keep rollback secrets in an operator-controlled store until the approved rollback window closes; do not keep them as a hidden client fallback.
6. Revoke retired credentials only after accounting for their remaining users. For rollback, restore a working token-mode Worker first, then remove Access protection and explicitly restore clients; never expose an unauthenticated publishing interval.

Every publish is immutable and creates a new document. Do not retry timeouts, 5xx responses or uncertain outcomes automatically: a write may already have succeeded. Resolve the outcome before deciding to publish again.
