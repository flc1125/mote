# Self-hosting Mote

[简体中文](zh-CN/self-hosting.md)

Mote runs entirely on Cloudflare's free tier: two Workers + one R2 bucket, no database, no servers. This guide takes you from zero to your own instance at `https://<your-domain>`.

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

> Staging without a domain: delete the `routes` lines and add `workers_dev = true` — you get `*.workers.dev` URLs instead.

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

## Next steps

- [CLI reference](cli.md) — options, config, scripting
- [MCP guide](mcp.md) — remote and stdio integrations
- [Architecture](architecture.md) — how the pieces fit
