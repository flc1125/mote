# 自托管 Mote

[English](../self-hosting.md)

Mote 完全运行在 Cloudflare 免费额度内：两个 Worker + 一个 R2 bucket，无数据库、无服务器。本指南带你从零部署到自己的 `https://<your-domain>`。

> 下文命令中的 `<your-domain>` 是占位符——替换成你自己的（子）域名，如 `mote.example.com`。

## 前置条件

- 一个 [Cloudflare 账号](https://dash.cloudflare.com/sign-up)，且域名已作为 **zone** 托管在 Cloudflare（NS 指向 Cloudflare）
- Node.js ≥ 20 与 pnpm 11
- 本仓库的检出：

```bash
git clone https://github.com/flc1125/mote.git
cd mote
pnpm install
```

## 1. 登录 Cloudflare

```bash
pnpm --filter @mote/api exec wrangler login
```

会打开浏览器完成授权。

## 2. 创建 R2 bucket

```bash
pnpm --filter @mote/api exec wrangler r2 bucket create mote-documents
```

## 3. 生成并保存发布 token

```bash
openssl rand -hex 32
```

把输出妥善保存——它就是 CLI/MCP 使用的 `MOTE_TOKEN`。然后设置为 API Worker 的 secret（提示时粘贴）：

```bash
pnpm --filter @mote/api exec wrangler secret put MOTE_TOKEN
```

> Token 红线：不进 Git、不进日志。需要轮换时重新执行同一命令即可。

## 4. 把 Worker 指向你的域名

编辑 `apps/viewer/wrangler.toml`：

```toml
routes = [{ pattern = "<your-domain>/*", zone_name = "<your-zone>" }]
```

编辑 `apps/api/wrangler.toml`：

```toml
routes = [{ pattern = "<your-domain>/api/*", zone_name = "<your-zone>" }]

[vars]
VIEWER_BASE_URL = "https://<your-domain>"
```

`<your-zone>` 是域名的 zone 名（如 `example.com`）。两个 Worker 共用一个域名：API 占有 `/api/*`，其余全部走 Viewer（最具体路由优先）。**不要**给 Viewer 用 Custom Domain——它会覆盖同主机名的 `/api/*` 路由。

> 无域名的 staging：删掉 `routes` 行并加 `workers_dev = true`，即可使用 `*.workers.dev`。

## 5. 部署

```bash
pnpm --filter @mote/api deploy
pnpm --filter @mote/viewer deploy
```

## 6. 添加 DNS 记录

Worker 路由要求主机名有一条代理的 DNS 记录。Cloudflare Dashboard → 你的 zone → **DNS → Records → Add record**：

- Type：`AAAA`
- Name：你的子域（如 `mote`）
- IPv6 address：`100::`
- Proxy status：**Proxied**（橙色云）

（该记录是占位——请求会被 Worker 路由直接接管。）

## 7. 验证

```bash
curl https://<your-domain>/health          # viewer: {"status":"ok"}
curl https://<your-domain>/api/health      # API:    {"status":"ok"}
```

发布一篇真实文档：

```bash
export MOTE_TOKEN="<你的 token>"
export MOTE_API_URL="https://<your-domain>"
pnpm --filter @mote/cli build
node apps/cli/dist/cli.js README.md
```

打开返回的 URL——页面正常渲染，图片（如有）可访问；第二次 `curl -I` 应看到 `cf-cache-status: HIT`。

## 8. 配置客户端

CLI（`~/.config/mote/config.json`）：

```json
{
  "apiUrl": "https://<your-domain>",
  "token": "<你的 token>"
}
```

远程 MCP（`publish_markdown` 工具）：

```text
URL:   https://<your-domain>/api/mcp
Header: Authorization: Bearer <你的 token>
```

## 成本

个人使用规模在 Cloudflare 免费额度内即可运行：每天 10 万 Worker 请求、10 GB R2 存储、流量免费。CDN 长缓存让重复读取不触达 Worker 和 R2。

## 下一步

- [CLI 参考](../cli.md)——参数、配置、脚本化
- [MCP 指南](../mcp.md)——远程与 stdio 集成
- [架构](../architecture.md)——整体设计
