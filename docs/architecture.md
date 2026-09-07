# Mote 架构

> 本文记录当前架构与核心决策；接口契约以[发布协议](protocol.md)为准，安全约束以[安全模型](security.md)为准，鉴权配置以[鉴权与迁移](authentication.md)为准。理解与维护项目不依赖未随仓库发布的内部计划文档。

## 总览

Mote 完全运行在 Cloudflare 上，由两个职责分离的 Worker 与一个 R2 Bucket 组成：

```text
                         Cloudflare

        Publish                              View

          │                                   │
          ▼                                   ▼

    CLI / MCP / Skill                       Browser
          │                                   │
          ▼                                   ▼

          ┌──────────── https://mote.flc.io ────────────┐
          │                                             │
   route: /api/*                                 route: /*
  (最具体优先)                                    (其余全部)
          │                                             │
          ▼                                             ▼

    Upload Worker (mote-api)          Workers Cache
          │                                   │
          │                                   │ MISS
          │                                   ▼
          │                              Viewer Worker (mote-viewer)
          │                                   │
          └──────────────┐     ┌──────────────┘
                         ▼     ▼
                      Cloudflare R2
                      mote-documents
```

V1 不引入：数据库、KV、D1、Durable Object、Queue、独立服务器。

Access 发布鉴权链路：CLI/远程 MCP → Cloudflare Access 校验 OAuth 或机器双凭据 → API Worker 校验签名断言 → 发布管线。读取侧不变。未指定模式时保留 `token` 回退，仓库生产部署配置显式选择 Access；客户端版本要求、模式选择与凭据存储见[鉴权指南](authentication.md)。

发布端点：`POST https://mote.flc.io/api/v1/publish`。两个 Worker 通过 Cloudflare Routes 共用同一域名，按路径前缀分流（最具体路由优先）；不使用 Custom Domain 绑定（它会覆盖同主机名的路由）。

## 核心原则

```text
Markdown is the source of truth.   → R2 只存 Markdown，不存预生成 HTML
HTML is ephemeral.                 → HTML 仅存在于 Workers Cache
Documents are immutable.           → 每次发布生成新 Document，无更新/删除
The URL is the capability.         → 知道 URL 即可访问，无登录/ACL
The CDN is the materialized view.  → 渲染结果由 CDN 长缓存
```

## Worker 划分

| Worker        | 路由                | 职责                                                                                        | 访问                                                      |
| ------------- | ------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `mote-viewer` | `mote.flc.io/*`     | `GET/HEAD /{document-id}`、`GET/HEAD /{document-id}/a/{asset-id}`、`/robots.txt`、`/health` | 匿名只读，启用 Workers Cache                              |
| `mote-api`    | `mote.flc.io/api/*` | REST 发布、远程 MCP、身份查询及健康检查                                                     | 部署选择 token / cloudflare-access；健康检查公开；可写 R2 |

两者绑定同一个 R2 Bucket `mote-documents`。

## 构建、部署与包发布

GitHub Actions 在 PR 和 `main` 推送时执行质量检查；Cloudflare Workers Builds 独立监听 `main`，分别构建、部署 `mote-api` 和 `mote-viewer`。稳定 `vX.Y.Z` 标签只触发 npm 与 GitHub Release，不再部署 Worker。

两个 Worker 没有跨服务部署事务，允许短暂混合版本；跨 API/CLI/Viewer 的变更须采用向后兼容的两阶段发布。以同一源码 SHA、各自 Build/版本和生产冒烟结果共同验收，不能把 GitHub CI 成功当作部署完成。

Worker 配置以仓库中的 Wrangler 文件为准；Cloudflare 管理 Git 连接、构建设置和构建凭据，运行时 Secret 单独管理。重试、回退由维护者在 Cloudflare Dashboard 操作；R2 数据和 Access 策略不随 Worker 回退自动恢复。详见[部署操作手册](zh-CN/deployment.md) / [English operations guide](deployment.md)。

## R2 数据模型

每个 Document 是一个不可变 Bundle：

```text
documents/
└── 7Vk3mQ9x2NFaP4Ls/
    ├── document.md      # 原始 Markdown（source of truth）
    ├── manifest.json    # 元数据 + commit marker（最后写入）
    └── assets/
        └── Aq8K3pLm92Xq # 本地图片等资产，随机 ID，不暴露原始文件名
```

- **Document ID**：16 字符 Base58（约 94 bit 熵，`crypto.getRandomValues()`），本身即 Capability URL 的 secret。
- **Asset ID**：12 字符 Base58。
- **原子发布**：写入顺序为 assets → `document.md` → `manifest.json`。Viewer 只认 `manifest.json`：不存在即 404，保证不会暴露半完成的 Document。

## 渲染与缓存

- Viewer 在请求时用 markdown-it（`html: false`）把 Markdown 渲染为 HTML，本地图片引用按 manifest 重写为 `/{document-id}/a/{asset-id}`。
- 渲染结果交给 Workers Cache（非 Cache API）：Document 边缘缓存 1 年，Asset `immutable`。
- 保持 Workers Cache 默认的「Worker Version 纳入 Cache Key」行为：Renderer/Theme 发新版自动使用新缓存，无需 purge。

## 安全要点

- Raw HTML 关闭、`script-src 'none'` 等严格 CSP、`Referrer-Policy: no-referrer`、noindex。
- 图片 MIME 以 Magic Bytes 为准；V1 不支持 SVG（Active Content 风险）。
- 发布接口：静态 token 或经过 Access 的签名身份；Bundle ≤ 20MB、Asset ≤ 50 个。Access 模式绑定 issuer/AUD/API 主机，不支持从备用 Worker 域名旁路。
- CLI 与本地 stdio 共享 Mote 凭据存储、刷新锁与发布管线；Codex 独立保存自己的 OAuth 凭据。远程 MCP 保持无状态，无文档所有权或用户配额新增。

详见 [发布协议](protocol.md)与[安全模型](security.md)。

## 历史章节引用

源码注释中的 `baseline §…` 是早期设计文档的历史编号，不再代表另一个权威来源。按主题查阅以下公开文档；这些编号无需恢复内部 `.docs` 文件即可理解：

| 历史编号                   | 当前参考                                                                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| §3、§5、§8.2、§10–§12、§54 | 本文的核心原则、Worker 划分与 R2 数据模型；[协议](protocol.md)的 ID 格式与服务端处理                                                         |
| §13–§18                    | [协议](protocol.md)的请求、服务端处理与响应；[安全模型](security.md)的上传侧防护                                                             |
| §20–§23                    | [CLI](cli.md)的 Configuration、Options 与 How assets are handled                                                                             |
| §24、§26–§36、§42          | 本文的渲染与缓存；[协议](protocol.md)的公开访问；[安全模型](security.md)的防泄露与 XSS 防护；渲染细节由 `packages/renderer/src` 及其测试维护 |
| §38                        | [鉴权与迁移](authentication.md)及[安全模型](security.md)的发布鉴权与凭据管理                                                                 |
| §43、§45、plan 002 Phase 1 | [MCP](mcp.md)的远程无状态协议、本地工具与共享发布管线                                                                                        |
| §47、§52、§53、§65.14      | [自托管](self-hosting.md)的健康检查与部署配置；本文的渲染与缓存；当前兼容日期以 Worker 配置为准                                              |
| §57–§59                    | [安全模型](security.md)的 XSS 回归测试；`apps/api/src/m3.integration.test.ts` 与 `apps/cli/test/e2e.test.ts` 的集成测试契约                  |
