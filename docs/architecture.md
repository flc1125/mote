# Mote 架构

> 本文是架构概览。架构基线（决策的权威来源）见 `.docs/arcs/Mote：不可变 Markdown 在线发布服务方案.md`，冲突时以基线为准。

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

当前源码已加入可选 Access 发布鉴权（尚未发布、生产未切换）：CLI/远程 MCP → Cloudflare Access 校验 OAuth 或机器双凭据 → API Worker 校验签名断言 → 原发布管线。读取侧不变。默认 `token` 模式保留；模式选择、存储与迁移见[鉴权指南](authentication.md)。

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
