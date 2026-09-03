# Mote：不可变 Markdown 在线发布服务方案

> **Mote = Markdown in, URL out.**
>
> 将本地 Markdown 文档发布为一个不可枚举、永久有效、可直接通过浏览器阅读的在线页面。

---

# 1. 项目概述

## 1.1 项目名称

```text
Mote
```

仓库建议：

```text
flc1125/mote
```

公开访问域名：

```text
https://mote.flc.io
```

上传 API：

```text
https://api.mote.flc.io
```

CLI：

```bash
mote
```

例如：

```bash
mote README.md
```

发布成功：

```text
Published:

https://mote.flc.io/7Vk3mQ9x2NFaP4Ls
```

---

# 2. 核心产品定义

Mote 不是传统 CMS，也不是在线 Markdown 编辑器。

它只解决一个核心问题：

```text
Markdown
   ↓
Publish
   ↓
Permanent URL
```

核心使用场景：

- 临时分享技术方案
- 分享 AI 生成报告
- 分享 Markdown 文档
- 分享 README
- 分享设计文档
- 分享调研材料
- 分享会议记录
- AI Agent 输出结果在线化
- MCP / Skill 自动发布 Markdown

核心原则：

```text
Markdown is persistent.

HTML is derived.

Published documents are immutable.

URL is the capability.
```

---

# 3. 已确定的产品原则

以下原则属于当前架构基线，V1 实现过程中不要随意修改。

## 3.1 发布后不可修改

每一次 publish 都创建一个新的 Document。

例如第一次：

```text
https://mote.flc.io/7Vk3mQ9x2NFaP4Ls
```

修改 Markdown 后重新发布：

```text
https://mote.flc.io/P8wQr4TmK2aX9NsV
```

旧 URL：

```text
永久保持原内容。
```

不提供：

```text
PUT /document/:id
PATCH /document/:id
```

V1 甚至不需要 DELETE。

这样可以彻底避免：

- 版本管理
- 缓存失效
- 数据同步
- revision
- optimistic locking
- purge CDN

---

# 4. URL 设计

公开页面采用：

```text
https://mote.flc.io/{document-id}
```

例如：

```text
https://mote.flc.io/7Vk3mQ9x2NFaP4Ls
```

不要：

```text
/docs/
/view/
/document/
/p/
/share/
```

也不要：

```text
/cloudflare-markdown-design-xxx
```

URL 不包含：

- 标题
- 文件名
- 用户信息
- 项目信息
- 时间
- 内容 Hash

URL 本身应该：

```text
短
无语义
不可枚举
不可预测
永久
```

---

# 5. Document ID

使用：

```text
16 字符 Base58
```

字符表：

```text
123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
```

排除容易混淆字符：

```text
0
O
I
l
```

例如：

```text
7Vk3mQ9x2NFaP4Ls
P8wQr4TmK2aX9NsV
```

随机性必须来自：

```text
crypto.getRandomValues()
```

禁止：

```text
Math.random()
timestamp
自增 ID
UUID 截断
文件 Hash
```

16 位 Base58 提供约 94 bit 随机熵。

Document ID 本身就是 Capability URL 的 Secret。

生成 ID 后，在创建文档前通过 R2 检查一次：

```text
documents/{id}/manifest.json
```

如果已存在：

```text
重新生成
```

理论冲突概率极低，但逻辑上仍需处理。

---

# 6. 权限模型

Mote V1 不提供传统访问权限系统。

访问权限模型为：

> Anyone who knows the URL can access the document.

即：

```text
URL = Capability
```

不需要：

- 登录
- Cookie
- Session
- ACL
- OAuth
- 用户系统
- D1
- RBAC

因此：

```text
https://mote.flc.io/7Vk3mQ9x2NFaP4Ls
```

本身就是访问凭证。

这意味着 Mote 适合：

- 半私密分享
- 不希望被发现的文档
- 临时协作
- AI 输出分享

不适合：

- 密码
- API Key
- 企业高度机密资料
- 法规要求强认证的数据

未来如有需求，可以在此架构上增加真正的 Access Control，但不属于 V1。

---

# 7. 整体架构

```text
                         Cloudflare

        Publish                              View

          │                                   │
          │                                   │
          ▼                                   ▼

    CLI / MCP / Skill                       Browser
          │                                   │
          │                                   │
          ▼                                   ▼

 https://api.mote.flc.io              https://mote.flc.io
          │                                   │
          ▼                                   ▼

    Upload Worker                       Workers Cache
          │                                   │
          │                                   │ MISS
          │                                   ▼
          │                              Viewer Worker
          │                                   │
          │                                   │
          └──────────────┐     ┌──────────────┘
                         ▼     ▼
                      Cloudflare R2

                      mote-documents
```

组件：

```text
Cloudflare DNS
Cloudflare Custom Domain
Cloudflare Workers
Cloudflare Workers Cache
Cloudflare R2
```

V1 不引入：

```text
数据库
KV
D1
Durable Object
Queue
PostgreSQL
Redis
Kubernetes
Nginx
独立服务器
```

---

# 8. Worker 划分

建议拆成两个 Worker。

## 8.1 Viewer Worker

名称：

```text
mote-viewer
```

域名：

```text
mote.flc.io
```

职责：

```text
GET /{document-id}
HEAD /{document-id}

GET /{document-id}/a/{asset-id}
HEAD /{document-id}/a/{asset-id}
```

Viewer：

```text
匿名访问
只读
启用 Workers Cache
```

---

## 8.2 API Worker

名称：

```text
mote-api
```

域名：

```text
api.mote.flc.io
```

职责：

```text
POST /v1/publish
GET  /health
```

API Worker：

```text
需要 Bearer Token
不启用 Cache
允许写 R2
```

Viewer 和 API Worker 共同绑定：

```text
R2 Bucket:
mote-documents
```

Cloudflare Custom Domain 可以直接把子域名绑定为 Worker 的 origin，并自动处理相应 DNS/TLS；R2 也可以通过 Worker binding 直接访问，因此无需额外服务器。

---

# 9. R2 数据模型

Bucket：

```text
mote-documents
```

每一个 Document 是一个独立不可变 Bundle。

结构：

```text
documents/
└── 7Vk3mQ9x2NFaP4Ls/
    ├── document.md
    ├── manifest.json
    └── assets/
        ├── Aq8K3pLm92
        ├── X92LmNa81P
        └── Pq28NmL51K
```

其中：

```text
document.md
```

永远保存 Markdown。

不要保存预生成 HTML。

HTML：

```text
只存在于 CDN Cache
```

---

# 10. manifest.json

manifest 是文档 Bundle 的元数据，同时作为：

```text
Document Commit Marker
```

示例：

```json
{
  "version": 1,
  "id": "7Vk3mQ9x2NFaP4Ls",
  "createdAt": "2026-09-03T06:00:00.000Z",
  "source": {
    "name": "README.md",
    "size": 48231,
    "sha256": "..."
  },
  "assets": [
    {
      "id": "Aq8K3pLm92",
      "references": [
        "./images/architecture.png"
      ],
      "contentType": "image/png",
      "size": 328291,
      "sha256": "..."
    }
  ]
}
```

注意：

```text
manifest.json 必须最后写入 R2。
```

发布过程：

```text
1. Generate ID

2. Upload assets

3. Upload document.md

4. Upload manifest.json

5. Return URL
```

只有：

```text
manifest.json exists
```

才认为：

```text
Document Published
```

这样即使上传过程中发生异常，也不会产生一个半完成的公开 Document。

---

# 11. 图片和附件模型

Markdown 可以引用两类图片。

## 11.1 Remote Asset

例如：

```md
![OpenAI](https://example.com/image.png)
```

V1：

```text
原样保留
```

浏览器直接访问第三方图片。

不做代理。

---

## 11.2 Local Asset

例如：

```md
![Architecture](./images/architecture.png)
```

CLI 应自动：

```text
解析 Markdown
      ↓
找到 ./images/architecture.png
      ↓
读取本地文件
      ↓
一起上传
```

最终生成：

```text
https://mote.flc.io/{document-id}/a/{asset-id}
```

例如：

```text
https://mote.flc.io/7Vk3mQ9x2NFaP4Ls/a/Aq8K3pLm92
```

公开 URL 不出现：

```text
architecture.png
company-logo.png
internal-system.png
```

即：

```text
原始文件名不公开。
```

---

# 12. Asset ID

Asset 使用随机 ID。

推荐：

```text
12 位 Base58
```

例如：

```text
Aq8K3pLm92Xq
```

由于 Asset 已位于：

```text
/{document-id}/a/{asset-id}
```

Document ID 本身已经不可预测，因此 Asset Token 不需要和 Document Token 一样长。

---

# 13. 支持的图片格式

V1：

```text
image/png
image/jpeg
image/webp
image/gif
image/avif
```

暂不支持：

```text
image/svg+xml
text/html
application/javascript
```

SVG 暂缓的主要原因是避免 Active Content 和 XSS 复杂度。

文件类型应该优先依据：

```text
Magic Bytes / MIME detection
```

而不是完全信任扩展名。

---

# 14. 上传限制

V1 建议：

Markdown：

```text
≤ 2 MB
```

单个 Asset：

```text
≤ 10 MB
```

整个 Document Bundle：

```text
≤ 20 MB
```

Asset 数量：

```text
≤ 50
```

以上限制以后可以调整。

Cloudflare Free 账户当前单请求 Request Body 上限为 100 MB，而 Worker Free 运行时有 128 MB 内存限制，因此 V1 主动将 Bundle 限制在 20 MB，可以显著降低 multipart 解析和内存风险。

---

# 15. Upload API

Endpoint：

```http
POST https://api.mote.flc.io/v1/publish
```

Authentication：

```http
Authorization: Bearer <MOTE_TOKEN>
```

Content-Type：

```http
multipart/form-data
```

---

# 16. Upload Request

Multipart fields：

```text
document
manifest
asset_0
asset_1
asset_2
...
```

客户端 manifest 示例：

```json
{
  "version": 1,
  "entry": "README.md",
  "assets": [
    {
      "field": "asset_0",
      "references": [
        "./images/architecture.png"
      ]
    },
    {
      "field": "asset_1",
      "references": [
        "./screenshots/demo.webp"
      ]
    }
  ]
}
```

客户端：

```text
不生成 Document ID
不生成最终 Asset ID
```

这些由服务端生成。

---

# 17. Publish Response

HTTP：

```text
201 Created
```

Response：

```json
{
  "id": "7Vk3mQ9x2NFaP4Ls",
  "url": "https://mote.flc.io/7Vk3mQ9x2NFaP4Ls"
}
```

---

# 18. Upload Error

建议统一：

```json
{
  "error": {
    "code": "INVALID_DOCUMENT",
    "message": "..."
  }
}
```

状态：

```text
400   malformed request
401   unauthorized
413   bundle too large
415   unsupported media type
422   invalid markdown bundle
500   internal error
```

Document ID collision：

```text
内部自动 retry
```

不要对客户端返回 409。

---

# 19. CLI

CLI 名：

```bash
mote
```

V1 首要命令：

```bash
mote <markdown-file>
```

例如：

```bash
mote README.md
```

输出：

```text
Scanning README.md...

Markdown    47.1 KB
Assets      3
Total       1.84 MB

Published:
https://mote.flc.io/7Vk3mQ9x2NFaP4Ls
```

---

# 20. CLI 参数

V1：

```bash
mote README.md
```

可支持：

```bash
mote publish README.md
```

但推荐将：

```bash
mote README.md
```

作为最短路径。

建议参数：

```text
--api
--token
--json
--verbose
--no-assets
```

例如：

```bash
mote README.md --json
```

返回：

```json
{
  "id": "7Vk3mQ9x2NFaP4Ls",
  "url": "https://mote.flc.io/7Vk3mQ9x2NFaP4Ls"
}
```

这个能力对于：

```text
AI Agent
Shell Script
CI
MCP
```

非常重要。

---

# 21. CLI 配置

优先级：

```text
CLI arguments
      ↓
Environment
      ↓
Config file
      ↓
Defaults
```

环境变量：

```text
MOTE_API_URL
MOTE_TOKEN
```

默认：

```text
MOTE_API_URL=https://api.mote.flc.io
```

例如：

```bash
export MOTE_TOKEN="xxx"

mote README.md
```

Token 不允许：

```text
写入仓库
写入日志
打印到 stdout
```

---

# 22. CLI Local Asset Scanner

执行：

```bash
mote README.md
```

CLI 应解析 Markdown AST。

不能简单依赖正则表达式。

需要识别：

```md
![foo](./foo.png)

![foo](images/foo.png)

![foo][image]

[image]: ./images/foo.png
```

Remote URL：

```text
https://
http://
```

不上传。

Local URL：

```text
./
../
relative/path
```

解析成文件系统路径。

同一个图片被引用多次：

```text
只上传一次
```

manifest：

```text
references[]
```

记录所有引用方式。

---

# 23. 文件解析安全

CLI 应：

1. resolve absolute path
2. 确认文件存在
3. 确认是 regular file
4. 获取 MIME
5. 检查文件大小
6. 计算 SHA-256
7. 去重

不得自动上传 Markdown 没有引用的整个目录。

即：

```text
只上传实际引用的资产。
```

---

# 24. Viewer 路由

公开页面：

```http
GET /{document-id}
```

例如：

```text
GET /7Vk3mQ9x2NFaP4Ls
```

Asset：

```http
GET /{document-id}/a/{asset-id}
```

例如：

```text
GET /7Vk3mQ9x2NFaP4Ls/a/Aq8K3pLm92Xq
```

其他路由：

```text
GET /robots.txt
GET /health
```

不存在的：

```text
统一返回 404
```

Malformed ID 与不存在 ID：

```text
都返回相同 404
```

避免暴露额外枚举信息。

---

# 25. Viewer Render Flow

```text
GET /7Vk3mQ9x2NFaP4Ls

        │
        ▼

Workers Cache

        │ HIT
        └──────────────► HTML

        │ MISS
        ▼

Viewer Worker

        │
        ▼

R2.get(
 documents/{id}/manifest.json
)

        │
        ├── absent → 404
        │
        ▼

R2.get(
 documents/{id}/document.md
)

        │
        ▼

Markdown Parser

        │
        ▼

Asset URL Resolver

        │
        ▼

HTML Template

        │
        ▼

Response

        │
        ▼

Workers Cache
```

---

# 26. Markdown Renderer

V1 推荐：

```text
markdown-it
```

原因：

```text
Worker 兼容简单
性能好
生态成熟
可关闭 raw HTML
插件模型简单
```

配置：

```ts
html: false
linkify: true
breaks: false
typographer: false
```

必须：

```text
html: false
```

禁止 Markdown 中的 raw HTML。

例如：

```html
<script>alert(1)</script>
```

不得进入最终页面 DOM。

---

# 27. V1 Markdown 能力

支持：

```text
CommonMark
Heading
Paragraph
Blockquote
Ordered List
Unordered List
Link
Image
Code Fence
Inline Code
Table
Strikethrough
Horizontal Rule
```

推荐增加：

```text
Heading Anchor
Automatic TOC
```

不需要：

```text
MDX
Vue
React component
iframe
HTML
script
style
```

---

# 28. Syntax Highlight

V1：

```text
不做复杂服务端 syntax highlight
```

代码块输出：

```html
<pre>
  <code class="language-go">
  ...
  </code>
</pre>
```

通过 CSS 提供基本视觉效果。

原因：

Cloudflare Workers Free 当前每次 invocation CPU time 为 10 ms，复杂 Shiki/语法高亮可能显著增加 CPU 消耗。

Phase 2 可以评估：

```text
highlight.js
Shiki
客户端 highlight
```

但不得影响 V1 上线。

---

# 29. HTML 页面

目标：

```text
轻量
静态
无 JS
响应式
阅读体验好
```

结构：

```html
<!doctype html>
<html>
<head>
</head>

<body>
  <main>
    <article>
      ...
    </article>
  </main>
</body>
</html>
```

V1 建议：

```text
CSS inline 到 HTML
```

优点：

```text
一次请求完成页面
没有 CSS 版本依赖
非常容易 CDN Cache
```

---

# 30. 页面视觉

风格：

```text
GitHub Markdown
+
现代文档阅读体验
```

建议：

```text
max-width: 860px
居中
良好 Typography
响应式
支持代码块水平滚动
表格水平滚动
图片 max-width: 100%
```

优先保证：

```text
Desktop
Mobile
Dark Mode
```

Dark Mode：

```css
@media (prefers-color-scheme: dark)
```

无需 JS。

---

# 31. Local Asset Rewrite

R2 中 `document.md` 保留原始 Markdown：

```md
![Architecture](./images/architecture.png)
```

manifest：

```json
{
  "references": [
    "./images/architecture.png"
  ],
  "id": "Aq8K3pLm92Xq"
}
```

Renderer 遇到：

```text
./images/architecture.png
```

转换为：

```text
/7Vk3mQ9x2NFaP4Ls/a/Aq8K3pLm92Xq
```

最终 HTML：

```html
<img
  src="/7Vk3mQ9x2NFaP4Ls/a/Aq8K3pLm92Xq"
  alt="Architecture"
/>
```

这样：

```text
R2 保留原 Markdown
公开 URL 不暴露文件名
```

---

# 32. Remote Image

例如：

```md
![foo](https://example.com/a.png)
```

直接：

```html
<img src="https://example.com/a.png">
```

但最终页面必须返回：

```http
Referrer-Policy: no-referrer
```

避免 Secret URL 作为 Referer 泄露。

还应增加：

```html
<meta name="referrer" content="no-referrer">
```

---

# 33. 页面安全 Header

建议：

```http
Content-Type: text/html; charset=utf-8

X-Content-Type-Options: nosniff

Referrer-Policy: no-referrer

X-Frame-Options: DENY

X-Robots-Tag: noindex, nofollow, noarchive
```

CSP：

```text
default-src 'none';

img-src 'self' https: http:;

style-src 'unsafe-inline';

object-src 'none';

frame-src 'none';

script-src 'none';

connect-src 'none';

base-uri 'none';

form-action 'none';

frame-ancestors 'none';
```

由于：

```text
raw HTML disabled
无 JS
```

V1 可以做到非常严格的 CSP。

---

# 34. 搜索引擎

Capability URL 不应该被搜索引擎收录。

HTML：

```html
<meta
  name="robots"
  content="noindex,nofollow,noarchive"
/>
```

Header：

```http
X-Robots-Tag:
noindex, nofollow, noarchive
```

robots.txt：

```text
User-agent: *
Disallow: /
```

注意：

```text
robots.txt 不是权限控制。
```

真正防枚举的是高熵 Token。

---

# 35. Cache 策略

Viewer Worker 开启：

```toml
[cache]
enabled = true
```

Cloudflare 当前 Workers Cache 可以在 Worker 执行之前直接命中缓存，因此 HIT 请求不需要执行 Viewer Worker；该能力要求较新的 Wrangler，当前文档注明 `cache.enabled` 需要 Wrangler 4.69.0+。

Document：

```http
Cache-Control:
public, max-age=300

Cloudflare-CDN-Cache-Control:
public, max-age=31536000
```

含义：

```text
Browser:
5 min

Cloudflare Edge:
1 year
```

Assets：

```http
Cache-Control:
public, max-age=31536000, immutable

Cloudflare-CDN-Cache-Control:
public, max-age=31536000
```

因为：

```text
Document immutable
Asset immutable
```

所以 Edge 可以超长缓存。

---

# 36. Renderer 更新与缓存

不设置：

```text
cross_version_cache = true
```

保持 Cloudflare Workers Cache 默认行为。

当前 Workers Cache 默认将 **Worker Version 纳入 Cache Key**，因此：

```text
deploy Viewer Worker v1
        ↓
v1 cache

deploy Viewer Worker v2
        ↓
v2 使用新的 cache namespace/key
```

也就是说：

> Renderer / Theme 发布新版本时，不需要主动 purge 旧页面缓存；新的 Worker Version 会自然产生新的缓存。

因此保持：

```toml
[cache]
enabled = true
cross_version_cache = false
```

或直接省略：

```text
cross_version_cache
```

---

# 37. Query String

公开文档响应不应该根据 query string 改变。

例如：

```text
/ABC
/ABC?utm_source=x
```

逻辑内容相同。

V1 可以先接受 Cloudflare 默认 cache key。

后续如果出现：

```text
tracking 参数导致 cache fragmentation
```

再考虑归一化。

不要为了这个问题提前增加 Gateway Worker。

---

# 38. API Authentication

API Worker 使用：

```http
Authorization: Bearer <token>
```

Worker Secret：

```text
MOTE_PUBLISH_TOKEN
```

例如：

```bash
wrangler secret put MOTE_PUBLISH_TOKEN
```

Token 要求：

```text
≥ 256 bit random
```

不得：

```text
硬编码
提交 Git
打印日志
返回客户端
```

V1 只需要：

```text
一个 Publisher Token
```

未来多用户后再设计：

```text
API Key
Account
Quota
```

---

# 39. Rate / Abuse Protection

Viewer：

```text
高熵 ID
+
Cloudflare Cache
```

已经可以显著降低枚举和 origin 压力。

API：

```text
Bearer Token
Bundle Size Limit
Asset Limit
MIME Limit
```

未来如果公开给多人使用，再增加：

```text
Rate Limiting
Turnstile
per-user quota
```

不属于 V1。

---

# 40. 技术栈

建议整个仓库使用：

```text
TypeScript
pnpm
pnpm workspace
Wrangler
Vitest
ESLint
Prettier
```

原因：

```text
Cloudflare Worker 原生适合 TypeScript

CLI 可以直接复用协议和 Markdown 包

未来 MCP 官方生态与 TypeScript 很契合

Skill 本质是文档/指令

一个语言可以明显降低 Monorepo 成本
```

---

# 41. Monorepo

建议：

```text
mote/
├── apps/
│   ├── viewer/
│   │   ├── src/
│   │   ├── wrangler.toml
│   │   └── package.json
│   │
│   ├── api/
│   │   ├── src/
│   │   ├── wrangler.toml
│   │   └── package.json
│   │
│   ├── cli/
│   │   ├── src/
│   │   └── package.json
│   │
│   └── mcp/
│       ├── src/
│       └── package.json
│
├── packages/
│   ├── core/
│   │   ├── ids.ts
│   │   ├── mime.ts
│   │   ├── hash.ts
│   │   └── types.ts
│   │
│   ├── renderer/
│   │   ├── markdown.ts
│   │   ├── assets.ts
│   │   ├── template.ts
│   │   └── styles.ts
│   │
│   └── protocol/
│       ├── publish.ts
│       └── errors.ts
│
├── skills/
│   └── mote/
│       └── SKILL.md
│
├── docs/
│   ├── architecture.md
│   ├── protocol.md
│   └── security.md
│
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

---

# 42. Package Responsibilities

## `@mote/core`

只包含纯函数：

```text
Base58 ID
Hash
MIME
Types
Path normalization
Validation
```

不得依赖：

```text
Cloudflare
Node fs
CLI
HTTP
```

---

## `@mote/renderer`

负责：

```text
Markdown parse
Heading extraction
TOC
Asset rewrite
HTML rendering
HTML template
CSS
```

输入：

```ts
render(markdown, manifest, documentId)
```

输出：

```text
HTML string
```

必须保持：

```text
Pure / Deterministic
```

---

## `@mote/protocol`

定义：

```text
PublishManifest
PublishResponse
ErrorResponse
DocumentManifest
```

CLI 和 API 共用。

---

# 43. MCP 设计

MCP 不要单独实现上传逻辑。

它只是：

```text
MCP
 ↓
Mote Publish Client
 ↓
Upload API
```

未来 Tool：

```text
publish_markdown
```

输入：

```json
{
  "markdown": "# Hello"
}
```

返回：

```json
{
  "url": "https://mote.flc.io/..."
}
```

另一个 Tool：

```text
publish_markdown_file
```

Agent 可以将本地文件交给 Mote。

---

# 44. Skill

Skill 的职责不是实现上传协议。

Skill 应指导 Agent：

```text
什么时候使用 Mote

如何调用 CLI

如何发布 Markdown

如何处理输出 URL
```

例如：

```text
skills/mote/SKILL.md
```

核心行为：

```text
当需要将 Markdown 内容转换为可分享页面时：

1. 将内容保存为 Markdown
2. 调用 mote CLI
3. 获取 URL
4. 返回 URL
```

---

# 45. CLI 是核心抽象

整个系统应该形成：

```text
                ┌── Human
                │
                ├── AI Agent
                │
                ├── MCP
                │
                ├── Skill
                │
                └── CI
                       │
                       ▼
                  Publish API
```

所有入口最终调用：

```text
同一个 Publish Protocol
```

避免：

```text
MCP 一套上传逻辑
CLI 一套上传逻辑
Web 一套上传逻辑
```

---

# 46. Web Uploader

V1 可以不做 Web UI。

优先：

```text
Upload API
CLI
Viewer
```

Phase 2 再增加：

```text
https://mote.flc.io/_publish
```

或独立：

```text
https://publish.mote.flc.io
```

支持：

```text
Drag Markdown
Drag Folder
Upload ZIP
```

但必须调用同一个：

```text
Publish API
```

---

# 47. Health

Viewer：

```text
GET /health
```

API：

```text
GET /health
```

Response：

```json
{
  "status": "ok"
}
```

Health 不应该访问 R2。

如需要 R2 health，再单独：

```text
/internal/health/storage
```

不要让普通 health 导致额外 R2 Read。

---

# 48. Logging

V1 使用：

```text
console structured logging
```

例如：

```json
{
  "event": "publish",
  "documentId": "...",
  "markdownBytes": 48129,
  "assetCount": 3,
  "assetBytes": 1729291
}
```

绝对禁止记录：

```text
MOTE_TOKEN
Markdown Content
Secret URL 完整访问日志到第三方系统
```

Document ID 可以记录用于排错，但如果未来接第三方日志平台，需要重新评估其敏感等级。

---

# 49. Metrics

V1 不需要引入完整可观测平台。

优先利用：

```text
Cloudflare Worker metrics
Cloudflare R2 metrics
Cloudflare logs
```

未来可增加：

```text
publish_total
publish_failed_total
render_total
r2_read_total
asset_count
bundle_bytes
render_duration
```

---

# 50. 成本模型

Cloudflare Workers Free 当前限制包括：

```text
100,000 requests/day
10 ms CPU / invocation
128 MB memory
```



R2 Standard 当前免费额度：

```text
10 GB-month storage
1M Class A / month
10M Class B / month
Internet egress free
```



Mote 的特点：

```text
文档较小
上传次数低
HTML CDN 长缓存
Asset CDN 长缓存
内容不可变
```

因此个人和小规模使用场景预期基本可以维持：

```text
≈ $0 / month
```

最大的免费额度压力通常会来自：

```text
Worker Request 数量
```

而不是 Markdown Storage。

---

# 51. 不使用 R2 Infrequent Access

Mote 使用：

```text
R2 Standard
```

不要为了降低存储单价使用：

```text
R2 Infrequent Access
```

因为免费额度只适用于 Standard，而且 Mote 文档本身很小。

---

# 52. Cloudflare 配置

Viewer：

```toml
name = "mote-viewer"
main = "src/index.ts"
compatibility_date = "2026-09-03"

[cache]
enabled = true

[[r2_buckets]]
binding = "DOCUMENTS"
bucket_name = "mote-documents"
```

API：

```toml
name = "mote-api"
main = "src/index.ts"
compatibility_date = "2026-09-03"

[[r2_buckets]]
binding = "DOCUMENTS"
bucket_name = "mote-documents"
```

生产域名：

```text
mote.flc.io
→ mote-viewer

api.mote.flc.io
→ mote-api
```

Staging 可以暂时：

```text
*.workers.dev
```

正式环境使用 Custom Domain。

---

# 53. Worker Cache

不要自己实现：

```ts
caches.default
```

Viewer 应优先使用：

```text
Workers Cache
```

原因：

Workers Cache：

```text
Browser
 ↓
Cache HIT
 ↓
Response
```

Worker 不执行。

而 Cache API：

```text
Browser
 ↓
Worker executes
 ↓
cache.match()
```

Worker 仍然执行，而且 Cache API 内容不会自动跨数据中心复制。

---

# 54. Atomic Publish

Publish 必须遵守：

```text
manifest last
```

流程：

```text
generate document id

↓

generate asset ids

↓

validate everything

↓

write assets

↓

write document.md

↓

write manifest.json

↓

201 Created
```

Viewer：

```text
manifest absent
=
document does not exist
```

即使：

```text
document.md exists
assets exist
```

但：

```text
manifest.json 不存在
```

仍然返回：

```text
404
```

---

# 55. Orphan Cleanup

发布失败可能留下：

```text
document.md
assets
```

但没有：

```text
manifest.json
```

V1：

```text
允许存在少量 orphan
```

原因：

```text
发布量很小
R2 成本极低
```

不要为了 cleanup 引入：

```text
Database
Queue
Durable Object
```

Phase 2 可以做：

```text
Cron
```

删除：

```text
超过 24 小时
且不存在 manifest.json
```

的 Object。

---

# 56. Testing Strategy

## Unit Test

必须覆盖：

```text
Base58 generation
ID validation
path normalization
MIME validation
SHA256
remote/local URL detection
asset mapping
Markdown render
XSS cases
CSP generation
manifest validation
```

---

# 57. Security Tests

必须测试：

```md
<script>alert(1)</script>
```

不得执行。

测试：

```md
[click](javascript:alert(1))
```

不得产生 javascript URL。

测试：

```md
![](javascript:alert(1))
```

不得输出危险 src。

测试：

```html
<img src=x onerror=alert(1)>
```

由于 raw HTML disabled：

```text
不得成为 HTML Element。
```

---

# 58. Integration Test

使用 Miniflare / Wrangler 测试：

```text
publish Markdown
      ↓
R2 objects created
      ↓
GET document
      ↓
render HTML
      ↓
GET asset
      ↓
correct Content-Type
```

---

# 59. E2E

至少包含：

### Case 1

```text
纯 Markdown
```

### Case 2

```text
Markdown + PNG
```

### Case 3

```text
Markdown + 多张图片
```

### Case 4

```text
Remote Image
```

### Case 5

```text
不存在 Document
```

### Case 6

```text
invalid upload token
```

### Case 7

```text
unsupported SVG
```

### Case 8

```text
oversized bundle
```

---

# 60. V1 Implementation Order

AI Agent 应严格按照以下顺序实施。

## Phase 0 — Repository

- [ ] 初始化 `mote`
- [ ] pnpm workspace
- [ ] TypeScript
- [ ] ESLint
- [ ] Prettier
- [ ] Vitest
- [ ] README
- [ ] docs/architecture.md

---

## Phase 1 — Core

实现：

```text
packages/core
packages/protocol
```

包括：

- [ ] Base58
- [ ] Document ID
- [ ] Asset ID
- [ ] SHA256
- [ ] MIME
- [ ] manifest types
- [ ] protocol types
- [ ] validators

完成 Unit Test。

---

## Phase 2 — Renderer

实现：

```text
packages/renderer
```

包括：

- [ ] markdown-it
- [ ] raw HTML disabled
- [ ] local asset resolver
- [ ] remote asset
- [ ] headings
- [ ] TOC
- [ ] HTML template
- [ ] responsive CSS
- [ ] dark mode
- [ ] security headers helper

完成：

```text
renderer unit tests
XSS tests
```

---

## Phase 3 — Viewer Worker

实现：

```text
apps/viewer
```

包括：

- [ ] GET document
- [ ] HEAD document
- [ ] GET asset
- [ ] HEAD asset
- [ ] R2 binding
- [ ] manifest commit check
- [ ] 404
- [ ] content type
- [ ] security headers
- [ ] cache headers
- [ ] Workers Cache

---

## Phase 4 — API Worker

实现：

```text
apps/api
```

包括：

- [ ] Bearer auth
- [ ] multipart
- [ ] Markdown validation
- [ ] Asset validation
- [ ] size limit
- [ ] MIME validation
- [ ] random IDs
- [ ] R2 writes
- [ ] manifest-last commit
- [ ] Publish response
- [ ] error response

---

## Phase 5 — CLI

实现：

```text
apps/cli
```

包括：

- [ ] `mote README.md`
- [ ] Markdown parsing
- [ ] Local asset detection
- [ ] Remote asset skip
- [ ] MIME
- [ ] SHA256
- [ ] multipart
- [ ] API client
- [ ] progress output
- [ ] `--json`
- [ ] env config
- [ ] errors

---

## Phase 6 — Cloudflare

- [ ] 创建 R2 `mote-documents`
- [ ] deploy API
- [ ] deploy Viewer
- [ ] 设置 Secret
- [ ] 绑定 R2
- [ ] 配置 `mote.flc.io`
- [ ] 配置 `api.mote.flc.io`
- [ ] 启用 Workers Cache
- [ ] 验证 Cache HIT
- [ ] 验证新 Worker Version 使用新 Cache

---

## Phase 7 — Documentation

完善：

```text
README.md
docs/architecture.md
docs/protocol.md
docs/security.md
```

README 至少包含：

```bash
npm install -g ...

export MOTE_TOKEN=...

mote README.md
```

---

## Phase 8 — MCP

V1 稳定以后再实现：

```text
apps/mcp
```

不要阻塞核心发布链路。

---

## Phase 9 — Skill

增加：

```text
skills/mote/SKILL.md
```

让 AI Agent 可以发现：

```text
Markdown 需要被分享
→ 使用 Mote
```

---

# 61. Definition of Done

Mote V1 只有满足以下条件才算完成。

### Publish

```bash
mote README.md
```

成功输出：

```text
https://mote.flc.io/{id}
```

---

### Markdown

浏览器打开：

```text
正常渲染 Markdown
```

---

### Local Images

Markdown：

```md
![](./images/demo.png)
```

发布后：

```text
正常显示
```

且公开 URL 不包含：

```text
demo.png
```

---

### Remote Images

```md
![](https://...)
```

正常显示。

---

### Immutable

相同 Markdown 连续发布两次：

```text
生成两个不同 URL
```

旧 URL 不改变。

---

### Security

```text
Raw HTML disabled
JavaScript URL blocked
No JS execution
No indexing
No referrer
```

---

### Cache

第一次：

```text
MISS
```

后续：

```text
HIT
```

并验证 Cache HIT 时：

```text
Viewer Worker 不重新 Render
R2 不重新读取
```

---

### Cost

正常个人使用：

```text
保持 Cloudflare Free Tier 可运行
```

---

# 62. V1 明确不做的事情

AI Agent 不应擅自实现：

```text
用户系统
登录
后台管理
Document 列表
搜索
删除
修改
版本
评论
点赞
统计 Dashboard
数据库
D1
KV
Durable Object
Queue
Web Editor
MDX
Mermaid
复杂 Syntax Highlight
PDF
多页面站点
自定义域名
密码访问
GitHub Sync
GitLab Sync
```

这些全部属于：

```text
Future Work
```

---

# 63. Future Work

后续可以逐步支持：

```text
MCP Server
Skill
Web Upload
Folder Upload
ZIP Upload
Mermaid
Syntax Highlight
Document Expiry
Delete
Password
Custom Theme
Custom Domain
GitHub Publish
GitLab Publish
CI Publish
Analytics
OG Image
PDF Export
```

但必须遵守核心抽象：

```text
Publish
  ↓
Immutable Document
  ↓
Capability URL
```

---

# 64. 最终架构总结

Mote 的最终 V1：

```text
                             Cloudflare

       ┌─────────────────────────────────────────────┐
       │                                             │
       │                                             │
       │     api.mote.flc.io                         │
       │            │                                │
       │            ▼                                │
CLI ─────────► Upload Worker                         │
       │            │                                │
       │            │                                │
       │            ▼                                │
       │         R2 Bucket                           │
       │            ▲                                │
       │            │                                │
       │            │                                │
       │      Viewer Worker                          │
       │            ▲                                │
       │            │ MISS                           │
       │      Workers Cache                          │
       │            ▲                                │
       │            │                                │
       │      mote.flc.io                            │
       │            ▲                                │
       │            │                                │
       │         Browser                             │
       │                                             │
       └─────────────────────────────────────────────┘
```

数据：

```text
R2
=
Markdown
+
Manifest
+
Assets
```

缓存：

```text
Workers Cache
=
Rendered HTML
+
Assets
```

公开地址：

```text
https://mote.flc.io/{16-char-base58}
```

CLI：

```bash
mote README.md
```

核心架构原则：

```text
Markdown is the source of truth.

HTML is ephemeral.

Documents are immutable.

The URL is the capability.

The CDN is the materialized view.
```

---

# 65. AI Agent 执行要求

如果本文被提供给 AI Coding Agent：

1. 本文属于项目架构基线。
2. 优先实现最小正确版本，不进行未经要求的产品扩展。
3. 不得擅自加入数据库。
4. 不得擅自加入用户系统。
5. 不得改变 `/document-id` 路由设计。
6. 不得将 HTML 持久化到 R2。
7. Document 发布后必须 immutable。
8. manifest 必须作为 commit marker 最后写入。
9. Markdown raw HTML 必须关闭。
10. Viewer 与 API Worker 必须职责分离。
11. CLI、未来 MCP、未来 Skill 必须复用同一个 Publish Protocol。
12. 优先保证简单、低成本、安全和可维护性。
13. 每一个 Phase 完成后先确保测试通过，再进入下一 Phase。
14. 如技术实现与本文冲突，应优先保持本文定义的产品模型，再选择等价实现方案。
15. 任何明显增加基础设施复杂度的方案，在没有明确收益前都不要引入。