# 自托管 Mote

[English](../self-hosting.md)

Mote 运行在 Cloudflare 上：两个 Worker + 一个 R2 bucket，无需管理数据库或服务器。本指南带你从零部署到自己的 `https://<your-domain>`。小规模负载可能在免费额度内运行，详见下方[成本](#成本)与渲染容量说明。

步骤 1–8 使用当前稳定版 v0.6.0 源码部署 **token** 模式。Access 模式请按下方 [Access 部署](#access-部署)及[版本兼容表](../authentication.md#version-compatibility)操作。安装 npm 包不会部署 Worker；仓库工作流见[部署自动化](#部署自动化)。

> 下文命令中的 `<your-domain>` 是占位符——替换成你自己的（子）域名，如 `mote.example.com`。

## 前置条件

- 一个 [Cloudflare 账号](https://dash.cloudflare.com/sign-up)，且域名已作为 **zone** 托管在 Cloudflare（NS 指向 Cloudflare）
- Node.js 24（CI 开发基线）与根 `package.json` 固定的 pnpm 11.23.0
- 本仓库的检出：

```bash
git clone https://github.com/flc1125/mote.git
cd mote
git switch --detach v0.6.0
pnpm install --frozen-lockfile
```

稳定标签提供可复现的检出。部署尚未发布的修复时，选择已审核的 `main` 提交并按其版本说明操作。下文通过 `--env=""` 显式使用**顶层配置**；仓库的 `access-test` 是本项目独立测试部署的环境。

## 1. 配置部署目标

在创建资源或设置 secret 前，先选择自己的 Worker 名称、域名和 R2 bucket。示例在你的 Cloudflare 账号中使用 `mote-api`、`mote-viewer` 和 `mote-documents`；名称已被使用时，选择新名称并在后续步骤中一致替换。

在 `apps/viewer/wrangler.toml` 中修改已有顶层字段和 R2 绑定，保留 `[cache]` 启用：

```toml
name = "mote-viewer"
routes = [{ pattern = "<your-domain>/*", zone_name = "<your-zone>" }]

[[r2_buckets]]
binding = "DOCUMENTS"
bucket_name = "mote-documents"
```

在 `apps/api/wrangler.toml` 中修改已有顶层字段、`[vars]` 和 R2 绑定。将 `MOTE_AUTH_MODE` 改成 `token`，移除本项目 Access 部署使用的 `MOTE_ACCESS_ISSUER`、`MOTE_ACCESS_AUD` 和 `MOTE_ACCESS_HOSTNAME`：

```toml
name = "mote-api"
routes = [{ pattern = "<your-domain>/api/*", zone_name = "<your-zone>" }]

[vars]
VIEWER_BASE_URL = "https://<your-domain>"
MOTE_AUTH_MODE = "token"

[[r2_buckets]]
binding = "DOCUMENTS"
bucket_name = "mote-documents"
```

这些片段用于替换现有值，不是完整配置文件，也不能直接作为额外 TOML 表追加。保留各文件的 `main` 和兼容日期；两个 Worker 必须绑定同一 bucket。

`<your-zone>` 为 DNS zone 名，如 `example.com`。API 占有 `/api/*`，其余路径由 Viewer 处理。两个 Worker 均使用 Routes 与代理 DNS，最具体路由优先；同一主机名下 Routes 优先于 Custom Domains。

**fork 构建检查：**`pnpm build` 会精确核对本项目的生产与测试配置。fork 要使用此命令和 CI，需要在 `scripts/workers/targets.json` 中修改资源名称、域名、zone 与账号，并在 `scripts/workers/config.mjs` 中适配鉴权变量及环境。当前 API 预期配置固定为 Access，只改 Wrangler 域名或切换 token 模式会导致检查失败。步骤 5 的应用级 Wrangler dry-run 可独立于这些项目白名单检查打包结果。

仅 token 模式的 staging 可移除路由并启用 `workers_dev = true`，同时将 API 的 `VIEWER_BASE_URL` 指向 Viewer 域名。Access 模式需使用受保护域名并关闭 workers.dev 和 preview URLs。

## 2. 登录 Cloudflare

```bash
pnpm --filter @mote/api exec wrangler login
```

会打开浏览器完成 Wrangler 授权。选择包含目标 DNS zone 和 Worker 资源的账号；需要区分多个账号时，在两个 Worker 顶层配置中明确 `account_id`。

## 3. 创建 R2 bucket

```bash
pnpm --filter @mote/api exec wrangler r2 bucket create mote-documents
```

## 4. 生成并保存发布 token

```bash
openssl rand -hex 32
```

把输出妥善保存——它就是 CLI/MCP 使用的 `MOTE_TOKEN`。然后设置为 API Worker 的 secret（提示时粘贴）：

```bash
pnpm --filter @mote/api exec wrangler secret put MOTE_TOKEN --env=""
```

secret 命令使用前面选择的 API Worker 名称与账号。若 Wrangler 提示创建 Worker，核对目标名称。轮换时设置替代值并同步使用它的客户端；值不进入 Git 或共享日志。

## 5. 部署

先检查配置后的两个 Worker 能够成功打包。以下命令不上传 Worker，也不验证线上 DNS 或 Access 设置：

```bash
pnpm --filter @mote/api exec wrangler deploy --dry-run --env=""
pnpm --filter @mote/viewer exec wrangler deploy --dry-run --env=""
```

再部署选定的顶层配置：

```bash
pnpm --filter @mote/api exec wrangler deploy --env=""
pnpm --filter @mote/viewer exec wrangler deploy --env=""
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

从仓库根目录使用步骤 4 保存的 token，发布一篇小型合成示例：

```bash
export MOTE_TOKEN="<你的 token>"
export MOTE_API_URL="https://<your-domain>"
export MOTE_AUTH_MODE="token"
pnpm --filter @mote/cli build
node apps/cli/dist/cli.js docs/examples/weekly-report.md
```

打开返回的 URL，确认报告及远程图片正常显示。需要验证所选版本的本地图片上传时，发布 `docs/examples/markdown-compatibility.md`，检查两个 logo 引用是否对应同一已上传资产。每次发布都会创建新文档。

用 `curl -I <published-url>` 检查文档响应头：浏览器 `Cache-Control` 应包含 `max-age=300`，Cloudflare CDN 策略应包含 `max-age=31536000`。重复请求命中同一边缘节点时可能看到 `cf-cache-status: HIT`，Worker 新版本的首次缓存未命中属于预期。dry-run 本身不能证明部署后的缓存行为。

## 8. 配置客户端

CLI（`~/.config/mote/config.json`）：

```json
{
  "apiUrl": "https://<your-domain>",
  "authMode": "token",
  "token": "<你的 token>"
}
```

远程 MCP（`publish_markdown` 工具）：

```text
URL:   https://<your-domain>/api/mcp
Header: Authorization: Bearer <你的 token>
```

## 成本

小规模负载可能在免费额度内运行。按账号当前的 Worker 请求/CPU 限额和 R2 存储/操作额度规划容量；域名注册及超出免费额度的用量可能产生费用。缓存命中在 Viewer 执行前返回，未命中会产生 Worker 计算与 R2 读取。不可变发布会持续增加存储的文档包，远程图片可用性由外部站点决定。

公式和图表布局有[渲染预算](../markdown.md#rendering-budgets)，但这不保证每篇支持的文档都满足免费计划的 CPU 限额。选择容量时应检查代表性文档的缓存未命中请求。

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

启用 CI 前先按步骤 1 适配 fork 构建检查。CLI Release 代码还固定了 `flc1125/mote` 和 `mote-cli`，在 fork 启用包发布前需审核 `scripts/release/` 与 npm Trusted Publishing。

两个 Worker 最终必须对应同一个预期源码 SHA；独立上线期间保持向后兼容。验收、故障、重试和回退见[部署操作手册](deployment.md)。Workers Builds 不代建 DNS、R2 或 Access 策略；本生产方案也不自动部署独立的 `access-test` 环境。

## 下一步

- [部署操作手册](deployment.md)——失败处理、重跑与人工恢复
- [CLI 参考](../cli.md)——参数、配置、脚本化
- [MCP 指南](../mcp.md)——远程与 stdio 集成
- [架构](../architecture.md)——整体设计
