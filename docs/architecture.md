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

 https://api.mote.flc.io              https://mote.flc.io
          │                                   │
          ▼                                   ▼

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

## 核心原则

```text
Markdown is the source of truth.   → R2 只存 Markdown，不存预生成 HTML
HTML is ephemeral.                 → HTML 仅存在于 Workers Cache
Documents are immutable.           → 每次发布生成新 Document，无更新/删除
The URL is the capability.         → 知道 URL 即可访问，无登录/ACL
The CDN is the materialized view.  → 渲染结果由 CDN 长缓存
```

## Worker 划分

| Worker        | 域名              | 职责                                                                                        | 访问                         |
| ------------- | ----------------- | ------------------------------------------------------------------------------------------- | ---------------------------- |
| `mote-viewer` | `mote.flc.io`     | `GET/HEAD /{document-id}`、`GET/HEAD /{document-id}/a/{asset-id}`、`/robots.txt`、`/health` | 匿名只读，启用 Workers Cache |
| `mote-api`    | `api.mote.flc.io` | `POST /v1/publish`、`GET /health`                                                           | Bearer Token，可写 R2        |

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
- 发布接口：Bearer Token（≥ 256 bit）、Bundle ≤ 20MB、Asset ≤ 50 个。

详见 `docs/security.md`（Phase 7 完善）与 `docs/protocol.md`（Phase 7 完善）。
