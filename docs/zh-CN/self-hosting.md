# 自托管 Mote

[English](../self-hosting.md)

Mote 完全运行在 Cloudflare 免费额度内：两个 Worker + 一个 R2 bucket，无数据库、无服务器。本指南带你从零部署到自己的 `https://<your-domain>`。

步骤 1–8 是兼容的 **token** 模式。Access 模式请使用已审核的 v0.2.0 服务端源码与 mote-cli v0.2.0（或匹配的源码构建），切换鉴权前先读下方 Access 部署说明。仅安装或发布 npm 包不会部署 Worker；仓库工作流见[部署自动化](#部署自动化)。

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

修改 `apps/api/wrangler.toml` 中已有的路由与 `[vars]`（不要追加第二个 `[vars]` 表）。本教程使用 token 模式：将仓库中的生产 `MOTE_AUTH_MODE` 改成 `token`，并移除 `MOTE_ACCESS_ISSUER`、`MOTE_ACCESS_AUD`、`MOTE_ACCESS_HOSTNAME`；这些参数属于项目的 Access 部署，不适用于你的实例。保留你自己的其他配置：

```toml
routes = [{ pattern = "<your-domain>/api/*", zone_name = "<your-zone>" }]

[vars]
VIEWER_BASE_URL = "https://<your-domain>"
MOTE_AUTH_MODE = "token"
```

`<your-zone>` 是域名的 zone 名（如 `example.com`）。两个 Worker 共用一个域名：API 占有 `/api/*`，其余全部走 Viewer（最具体路由优先）。**不要**给 Viewer 用 Custom Domain——它会覆盖同主机名的 `/api/*` 路由。

> 仅 token 模式的 staging 可删掉 `routes` 并启用 `workers_dev`。Access 模式必须使用受保护的域名，关闭 workers.dev 和 preview URLs；API 会拒绝其他主机入口。

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

<a id="access-部署尚未发布"></a>

## Access 部署

使用独立测试域名、Worker 与 R2。仓库的 `access-test` 绑定属于本项目，不得原样部署到别人的账号或复制其 AUD 到生产。

配置目标为 `mote-test-api`、`mote-test-viewer`、`mote-test-documents` 和 `mote-test.flc.io`，使用独立的 `mote-test` Access 应用；逻辑环境名为 `access-test`。`apps/auth-probe` 使用虚拟账户/身份配置且无路由，仅用于本地回归测试和 dry-run 构建，不得指向真实云端资源。

1. 配置 Zero Trust 登录源及明确的发布者 Allow 策略。同一应用仅保护 `<your-domain>/api/mcp`、`<your-domain>/api/v1/publish`、`<your-domain>/api/auth/*`；阅读页面、图片、健康检查和必要 OAuth 发现元数据保持公开，不保护整个 Viewer 域名。
2. 启用 Managed OAuth 与实际客户端需要的 localhost/loopback 回调，不添加任意公网回调通配。核对完整 `/api/mcp` resource 和 issuer。Codex 沿用预注册 public client 与精确回调，见 [MCP 指南](../mcp.md#codex)。
3. 按实例风险选择 token 和授权会话时长，在 `oauth_configuration` 下设置 `grant.access_token_lifetime` 和 `grant.session_duration`，不是应用普通会话时长。API 更新必须先 GET、保留其他配置再 PUT，最后独立 GET 比对精确时长，不能只 PUT 局部片段。参考 [Managed OAuth](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/managed-oauth/)。
4. 机器发布另加 Service Auth 策略，仅选指定令牌且只关联目标应用；不要允许任意服务令牌。创建、轮换、禁用及环境配置见[机器发布](../authentication.md#machine-publishing)。
5. 保留 API Worker 的路由与绑定，在相应部署配置中替换鉴权变量（不是直接追加第二个 `[vars]`）：

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

`MOTE_ACCESS_HOSTNAME` 是受保护的 API 主机，不是另一个 Viewer 主机。Access 签发 opaque token，Worker 校验 Access 注入的签名断言，不把客户端 token 当 JWT。错误签名、issuer/AUD/时间/身份/主机均拒绝；不信任邮箱头、Cookie、Client ID 或管理 API token。

6. 人工确认部署环境、Worker、路由优先级、R2 后再部署选定配置；测试不可误用默认生产 deploy。已有生产迁移必须另行批准。
7. 按[CLI 登录/状态/发布/退出](../authentication.md#user-login-cli-and-local-stdio)及 Codex 指南复核。匿名发布应拒绝、发现 resource 精确匹配、用户与机器发布成功、无效凭据拒绝、阅读和图片匿名可用、备用主机不能发布。记录版本和结果，不记录秘密值。

已有 token 实例请按[鉴权与迁移指南](../authentication.md#migrate-an-existing-instance)迁移或回退，不留无鉴权窗口。该指南同时说明凭据存储、兼容性与会话限制。OAuth 登录授权不等于生产部署或配置变更授权。

## 部署自动化

生产 `mote-api`、`mote-viewer` 在每次推送 `main` 时，由 Cloudflare Workers Builds 分别部署。GitHub Actions 在 PR 和 `main` 上执行 CI；稳定 `vX.Y.Z` 标签仅发布 CLI 包与 GitHub Release。仓库没有 GitHub 手动 Worker 部署工作流。

资源、路由和鉴权审核完成后，再将两个生产 Worker 分别连接到自己的仓库。按[Workers Builds 预期设置](deployment.md#workers-builds-预期设置)使用 workspace 根目录 `/`、空 build command 和对应应用的 filtered Wrangler deploy command。构建凭据与构建变量配置在 Cloudflare，运行时 Secret 独立管理。步骤 5 的命令仍可用于首次自托管和明确获准的人工操作。

fork 必须同时适配两个 Wrangler 配置及 `scripts/workers/targets.json`、`scripts/workers/config.mjs` 中的配置检查，使用自己的资源和鉴权模式。这些检查有意固定本项目生产和测试配置；只改域名会使 `pnpm build` 的白名单检查失败。CLI Release 代码还固定了 `flc1125/mote` 和 `mote-cli`，在 fork 启用包发布前需审核 `scripts/release/` 与 npm Trusted Publishing。

两个 Worker 最终必须对应同一个预期源码 SHA；独立上线期间保持向后兼容。验收、故障、重试和回退见[部署操作手册](deployment.md)。Workers Builds 不代建 DNS、R2 或 Access 策略；本生产方案也不自动部署独立的 `access-test` 环境。

## 下一步

- [部署操作手册](deployment.md)——失败处理、重跑与人工恢复
- [CLI 参考](../cli.md)——参数、配置、脚本化
- [MCP 指南](../mcp.md)——远程与 stdio 集成
- [架构](../architecture.md)——整体设计
