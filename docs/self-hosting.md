# Self-hosting Mote

[简体中文](zh-CN/self-hosting.md)

Mote runs entirely on Cloudflare's free tier: two Workers + one R2 bucket, no database, no servers. This guide takes you from zero to your own instance at `https://<your-domain>`.

Steps 1–8 describe the compatible **token** deployment. For the unreleased Access implementation, build the reviewed source revision and use the [Access section](#access-enabled-deployments-unreleased) before changing authentication. A package release does not deploy Workers; this repository currently has no Cloudflare deployment automation.

> Commands below use `<your-domain>` as a placeholder — replace it with your own (sub)domain, e.g. `mote.example.com`.

## Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) with a domain added as a **zone** (nameservers pointing to Cloudflare)
- Node.js ≥ 20 and pnpm 11
- A checkout of this repository:

```bash
git clone https://github.com/flc1125/mote.git
cd mote
pnpm install
```

## 1. Log in to Cloudflare

```bash
pnpm --filter @mote/api exec wrangler login
```

This opens a browser to authorize wrangler.

## 2. Create the R2 bucket

```bash
pnpm --filter @mote/api exec wrangler r2 bucket create mote-documents
```

## 3. Generate and store your publish token

```bash
openssl rand -hex 32
```

Save the output somewhere safe — it becomes your `MOTE_TOKEN` for the CLI/MCP. Then set it as the API Worker's secret (paste it when prompted):

```bash
pnpm --filter @mote/api exec wrangler secret put MOTE_TOKEN
```

> Token rules: never commit it, never print it to logs. Rotate anytime by running the same command again.

## 4. Point the Workers at your domain

Edit `apps/viewer/wrangler.toml`:

```toml
routes = [{ pattern = "<your-domain>/*", zone_name = "<your-zone>" }]
```

Edit `apps/api/wrangler.toml`:

```toml
routes = [{ pattern = "<your-domain>/api/*", zone_name = "<your-zone>" }]

[vars]
VIEWER_BASE_URL = "https://<your-domain>"
```

`<your-zone>` is the zone name of your domain (e.g. `example.com`). Both Workers share one host: the API owns `/api/*`, everything else goes to the viewer (most specific route wins). Do **not** use a Custom Domain for the viewer — it would shadow the `/api/*` route.

> Token-only staging can use `workers_dev = true` without routes. **Do not do this in Access mode**: use a protected custom hostname and disable both workers.dev and preview URLs. The API rejects alternate hosts in Access mode.

## 5. Deploy

```bash
pnpm --filter @mote/api deploy
pnpm --filter @mote/viewer deploy
```

## 6. Add the DNS record

Worker routes need a proxied DNS record for the hostname. In the Cloudflare dashboard: your zone → **DNS → Records → Add record**:

- Type: `AAAA`
- Name: your subdomain (e.g. `mote`)
- IPv6 address: `100::`
- Proxy status: **Proxied**

(The record is a placeholder — requests are intercepted by the Workers routes before any origin.)

## 7. Verify

```bash
curl https://<your-domain>/health          # viewer: {"status":"ok"}
curl https://<your-domain>/api/health      # API:    {"status":"ok"}
```

Then publish a real document:

```bash
export MOTE_TOKEN="<your-token>"
export MOTE_API_URL="https://<your-domain>"
pnpm --filter @mote/cli build
node apps/cli/dist/cli.js README.md
```

Open the printed URL — the page renders; images (if any) resolve. A second `curl -I` of the URL should show `cf-cache-status: HIT`.

## 8. Configure your clients

CLI (`~/.config/mote/config.json`):

```json
{
  "apiUrl": "https://<your-domain>",
  "token": "<your-token>"
}
```

Remote MCP (`publish_markdown` tool):

```text
URL:   https://<your-domain>/api/mcp
Header: Authorization: Bearer <your-token>
```

## Costs

Personal-scale usage fits Cloudflare's free tier: 100k Worker requests/day, 10 GB R2 storage, free egress. Long-lived CDN cache means repeat reads don't touch the Worker or R2.

## Access-enabled deployments (unreleased)

Use a separate hostname, Worker pair and R2 bucket for validation. The repository's `access-test` environment is project-specific: replace its account, routes, bucket and identity values rather than deploying it unchanged.

1. Configure Zero Trust with your identity provider and an explicit publisher Allow policy. Protect only `<your-domain>/api/mcp`, `<your-domain>/api/v1/publish` and `<your-domain>/api/auth/*` in the same Access application. Keep document/asset URLs, health checks and required public OAuth metadata reachable without login; do not gate the entire Viewer hostname.
2. Enable Managed OAuth and the localhost/loopback callback support required by your actual clients. Do not allow arbitrary public callback wildcards. Discover the exact MCP resource and authorization issuer; use a pre-registered client and exact callback for the tested Codex flow in [the MCP guide](mcp.md#codex).
3. Choose token/grant durations deliberately. The isolated rollout verified `grant.access_token_lifetime: "168h"` and `grant.session_duration: "720h"`. These fields are under `oauth_configuration`, not the ordinary application session duration. For API updates, GET the current application, preserve other fields, PUT the intended change, then independently GET and compare. Never PUT only the fragment shown here. The tested dashboard's “1 month” was 730h, not 720h. See [Managed OAuth](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/managed-oauth/).
4. Add a separate Service Auth policy only if machine publishing is needed; select specific tokens and restrict the policy to this application. See [machine publishing and rotation](authentication.md#machine-publishing).
5. In your API Worker's configuration, preserve routes/bindings and replace the existing auth vars with the following example. `MOTE_ACCESS_HOSTNAME` is the protected API host, not a different Viewer host. Never use the test application's AUD for production.

```toml
workers_dev = false
preview_urls = false

[vars]
VIEWER_BASE_URL = "https://mote.example.com"
MOTE_AUTH_MODE = "cloudflare-access"
MOTE_ACCESS_ISSUER = "https://your-team.cloudflareaccess.com"
MOTE_ACCESS_AUD = "<your-application-aud>"
MOTE_ACCESS_HOSTNAME = "mote.example.com"
```

6. Review the exact environment, Worker names, route precedence and bucket before manually deploying the selected configuration. Do not run the default production deploy command for a test environment. Require separate approval before changing an existing production deployment.
7. Follow [CLI login/status/publish/logout](authentication.md#user-login-cli-and-local-stdio) and [Codex](mcp.md#codex). Verify anonymous publishing fails, metadata resource equals the full `/api/mcp` URL, valid user/service publishing works, invalid credentials fail, and published URLs/assets remain anonymously readable. Verify alternate Worker hosts cannot publish. Record versions and outcomes without secrets.

Access issues opaque client tokens; Mote validates the signed identity assertion supplied by Access rather than decoding that token. The API requires HTTPS and its configured host, validates the assertion signature/issuer/AUD/time/type/identity, and fails closed. It does not trust an email header, Cookie, client ID or management API token as identity. See [security](security.md#5-发布鉴权与凭据管理).

For an existing token deployment, use the ordered [migration and rollback steps](authentication.md#migrate-an-existing-instance). OAuth approval does not grant permission to deploy or change production.

## Next steps

- [CLI reference](cli.md) — options, config, scripting
- [MCP guide](mcp.md) — remote and stdio integrations
- [Architecture](architecture.md) — how the pieces fit
