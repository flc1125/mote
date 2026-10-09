# Mote 架构

> 本文记录当前架构与核心决策；接口契约以[发布协议](protocol.md)为准，安全约束以[安全模型](security.md)为准，鉴权配置以[鉴权指南](zh-CN/authentication.md)为准。理解与维护项目不依赖未随仓库发布的内部计划文档。

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

          ┌──────────── https://mote.pub ────────────┐
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

当前架构不使用数据库、KV、D1、Durable Object、Queue 或独立服务器。

Access 发布鉴权链路：CLI/远程 MCP → Cloudflare Access 校验 OAuth 或 Service Token 的 Client ID 和 Client Secret → API Worker 校验签名断言 → 发布管线。
文档和图片仍可匿名读取。

服务端未配置 `MOTE_AUTH_MODE` 时，使用 `token` 模式。仓库生产部署配置显式选择 Access。
客户端的模式选择规则与服务端不同，详见[鉴权指南](zh-CN/authentication.md)。

发布端点：`POST https://mote.pub/api/v1/publish`。两个 Worker 通过 Cloudflare Routes 共用同一域名，按路径前缀分流（最具体路由优先）；本部署为两个 Worker 使用 Routes 和代理 DNS。

## 核心原则

```text
Markdown is the source of truth.   → R2 只存 Markdown，不存预生成 HTML
HTML is ephemeral.                 → HTML 仅存在于 Workers Cache
Documents are immutable.           → 每次发布生成新 Document，无更新/删除接口
The URL is the capability.         → 知道 URL 即可访问，无登录/ACL
The CDN is the materialized view.  → 渲染结果由 CDN 长缓存
```

不可变针对存储的 Markdown 和已上传资产；Viewer/Theme 更新可改变呈现效果。
远程图片依赖外部站点。页面能否持续访问，取决于实例和 R2 是否正常运行。

## Worker 划分

| Worker        | 路由             | 职责                                                                                        | 访问                                                      |
| ------------- | ---------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `mote-viewer` | `mote.pub/*`     | `GET/HEAD /{document-id}`、`GET/HEAD /{document-id}/a/{asset-id}`、`/robots.txt`、`/health` | 匿名只读，启用 Workers Cache                              |
| `mote-api`    | `mote.pub/api/*` | REST 发布、远程 MCP、身份查询及健康检查                                                     | 部署选择 token / cloudflare-access；健康检查公开；可写 R2 |

两者绑定同一个 R2 Bucket `mote-documents`。

## 构建、部署与包发布

GitHub Actions 在 PR 和 `main` 推送时执行质量检查；Cloudflare Workers Builds 独立监听 `main`，分别构建、部署 `mote-api` 和 `mote-viewer`。稳定 `vX.Y.Z` 标签只触发 npm 与 GitHub Release，不部署 Worker。

两个 Worker 没有跨服务部署事务，部署期间可能短暂运行不同版本。跨 API/CLI/Viewer 的变更须采用向后兼容的两阶段发布。
验收时，核对同一源码 SHA、各自构建与版本，以及生产基础功能检查结果。GitHub CI 成功不代表部署完成。

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

### 共享解析

CLI 与 Viewer 共用 `@mote/core` 的 `documentSyntax`，保持图片扫描与正文渲染一致。共享规则识别：

- 脚注，以及不会解释图片语法的代码和数学区域。
- 扩展提示块与内容标签组。
- 图片宽度与图注。
- 文本高亮、定义列表和文档内缩写。

### 正文与组件

Viewer 在请求时用 markdown-it 将 Markdown 渲染为 HTML，支持表格、删除线、任务列表和脚注。
原始 HTML 经白名单净化器处理，详见[安全模型](security.md)。本地图片引用按 manifest 重写为 `/{document-id}/a/{asset-id}`。

提示块使用受控类型和纯文本标题，与 GitHub Alerts 共用视觉样式。折叠使用原生 `details/summary`。
标签组先输出全部面板和可链接标题，脚本初始化成功后才添加 tabs 语义并隐藏未选面板。
标签组与提示块共用源码长度、嵌套层级和组件数量限额，详见[渲染预算](zh-CN/markdown.md#渲染预算)。

### 阅读操作

固定导航脚本处理目录、标签切换、深链接展开及打印后的状态恢复。
缩写输出静态 `abbr`，定义与匹配受文档级限额约束。
脚注预览只复制已净化 DOM 的静态子集，移除 ID、控件和运行时状态。复杂或超限内容使用原脚注链接，文末脚注与回链始终保留。

主题默认跟随系统（`prefers-color-scheme`）。读者点击页面顶部的主题按钮，打开菜单后选择 Auto、Light 或 Dark。
Light 和 Dark 选择存入 `localStorage["mote-theme"]`；Auto 清除该值并跟随系统。
固定脚本在首帧前设置 `<html data-theme>`，避免主题闪烁。禁用 JavaScript 时跟随系统主题；打印始终使用亮色配色。

页面工具由另一个固定脚本提供：

- 复制页面链接时使用规范 URL，移除 hash 和 query。
- 复制 Markdown 时保留原始正文、隐藏元数据、注释及图片路径。剪贴板不可用时，支持原生 dialog 的浏览器提供只读源码框供手动复制。
- 返回顶部按钮在滚动约两屏后出现，并避开桌面目录侧栏。

标题锚点由导航脚本处理。浏览器提供剪贴板 API 时，点击锚点复制章节链接而不跳转；否则保留普通页内跳转。

禁用 JavaScript 时，页面工具保持隐藏，标题锚点仍可跳转，正文完整可读。
浏览器没有剪贴板 API 时，复制页面链接按钮隐藏，但返回顶部仍可使用。
脚本按精确 CSP 哈希授权，GET 与 HEAD 的策略一致。

### 边缘缓存

渲染结果交给 Workers Cache，而非 Cache API。文档边缘缓存 1 年，图片资产使用 `immutable` 缓存。
保留默认的「Worker Version 纳入 Cache Key」行为。Renderer/Theme 发布新版本后自动使用新缓存，无需清除旧缓存。

## 安全要点

- 图片宽度和图注在共享解析层处理，保持原始引用及上传去重。图片查看器是固定脚本的渐进增强：原生 dialog、焦点恢复、适应窗口/原始尺寸，跳过链接、行内和响应式 picture 图片；不增加用户 HTML 权限。
- 原始 HTML 经白名单净化。严格 CSP 仅授权固定第一方脚本的哈希，另有 `Referrer-Policy: no-referrer` 与 noindex 指令。
- 图片 MIME 以文件头特征字节（Magic Bytes）为准。不支持上传 SVG，因为它可能包含脚本等主动内容；生成的图表 SVG 使用独立净化器。
- 发布接口：静态 token 或经过 Access 的签名身份；Bundle ≤ 20 MiB（20 × 1,048,576 字节）、上传 Asset ≤ 50 个。Access 模式绑定 issuer/AUD/API 主机，不支持从备用 Worker 域名旁路。
- CLI 与本地 stdio 共享 Mote 凭据存储、刷新锁与发布管线；Codex 独立保存自己的 OAuth 凭据。远程 MCP 保持无状态，无文档所有权或用户配额新增。

详见 [发布协议](protocol.md)与[安全模型](security.md)。

## 历史章节引用

源码注释中的 `baseline §…` 是早期设计文档的历史编号，不再代表另一个权威来源。按主题查阅以下公开文档；这些编号无需恢复内部 `.docs` 文件即可理解：

| 历史编号                   | 当前参考                                                                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| §3、§5、§8.2、§10–§12、§54 | 本文的核心原则、Worker 划分与 R2 数据模型；[协议](protocol.md)的 ID 格式与服务端处理                                                         |
| §13–§18                    | [协议](protocol.md)的请求、服务端处理与响应；[安全模型](security.md)的上传侧防护                                                             |
| §20–§23                    | [CLI](zh-CN/cli.md)的配置、参数与资产处理方式                                                                                                |
| §24、§26–§36、§42          | 本文的渲染与缓存；[协议](protocol.md)的公开访问；[安全模型](security.md)的防泄露与 XSS 防护；渲染细节由 `packages/renderer/src` 及其测试维护 |
| §38                        | [鉴权指南](zh-CN/authentication.md)及[安全模型](security.md)的发布鉴权与凭据管理                                                             |
| §43、§45、plan 002 Phase 1 | [MCP（英文）](mcp.md)的远程无状态协议、本地工具与共享发布管线                                                                                |
| §47、§52、§53、§65.14      | [自托管](zh-CN/self-hosting.md)的健康检查与部署配置；本文的渲染与缓存；当前兼容日期以 Worker 配置为准                                        |
| §57–§59                    | [安全模型](security.md)的 XSS 回归测试；`apps/api/src/m3.integration.test.ts` 与 `apps/cli/test/e2e.test.ts` 的集成测试契约                  |
