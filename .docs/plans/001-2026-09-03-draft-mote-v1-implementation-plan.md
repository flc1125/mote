# Mote V1 实施计划

> **计划编号**：001
> **日期**：2026-09-03
> **状态**：draft
> **架构基线**：`.docs/arcs/Mote：不可变 Markdown 在线发布服务方案.md`（下称《基线》）

本计划将《基线》转化为可分阶段执行、逐阶段验收的开发计划。
如本计划与《基线》冲突，以《基线》为准（《基线》§65.14）。

## 阶段审核机制

每个阶段带有一个状态字段，由计划所有者（用户）逐阶段审核：

```text
待审核 → 已审核 → 进行中 → 已完成
   │         │
   └─ 驳回 ──┘（驳回后修正计划，重新进入待审核）
```

- **待审核（pending-review）**：阶段计划已编写，等待用户审核。**禁止执行任何实现工作**。
- **已审核（approved）**：用户已明确批准该阶段，可以开始执行。
- **进行中（in-progress）**：阶段正在实施。
- **已完成（done）**：Checklist 与交付标准全部满足，用户验收通过。

执行者（含 AI Coding Agent）**只允许执行状态为「已审核」或「进行中」的阶段**；
开始执行时将状态更新为「进行中」，交付标准全部满足后提交用户验收，验收通过后标记「已完成」。

---

## 1. 目标与范围

### 1.1 目标

交付 Mote V1：通过 `mote README.md` 将本地 Markdown 发布为不可枚举、永久有效、浏览器可读的在线页面，并满足《基线》§61 全部 Definition of Done。

### 1.2 范围内（V1）

- Monorepo 工程基建（pnpm workspace + TypeScript + Vitest + ESLint/Prettier）
- `packages/core`、`packages/protocol`、`packages/renderer`
- Viewer Worker（`mote.flc.io`）与 API Worker（`api.mote.flc.io`）
- CLI（`mote`）
- Cloudflare 生产部署（R2 + Custom Domain + Workers Cache）
- 文档（README / architecture / protocol / security）

### 1.3 范围外（严格遵守《基线》§62）

用户系统、登录、Document 列表/搜索/删除/修改/版本、评论、统计 Dashboard、数据库（D1/KV/Durable Object/Queue）、Web Editor、MDX、Mermaid、复杂语法高亮、PDF、密码访问、Git 平台同步等。

MCP（Phase 8）与 Skill（Phase 9）在 V1 核心链路稳定后启动，不阻塞 V1 发布。

---

## 2. 阶段与里程碑总览

| 里程碑 | 名称 | 包含阶段 | 里程碑判据（Gate） |
|---|---|---|---|
| **M0** | 仓库就绪 | Phase 0 | `pnpm install && pnpm lint && pnpm test` 全绿 |
| **M1** | 基础库完成 | Phase 1 | core/protocol 单测全绿，core 零外部依赖 |
| **M2** | 渲染器完成 | Phase 2 | renderer 单测 + XSS 安全测试全绿 |
| **M3** | 服务端闭环 | Phase 3 + 4 | Miniflare 集成测试全绿：publish → R2 → render → asset |
| **M4** | CLI 端到端 | Phase 5 | 本地全链路：`mote` 发布 → Viewer 渲染 → 图片可见 |
| **M5** | **V1 上线** | Phase 6 + 7 | 生产环境通过《基线》§61 全部 DoD |
| **M6** | 生态扩展（post-V1） | Phase 8 + 9 | MCP `publish_markdown` 可用；Skill 可被 Agent 发现 |

执行顺序严格按阶段推进；**每个阶段完成后必须测试全绿才允许进入下一阶段**（《基线》§65.13）。

### 阶段状态总览

| 阶段 | 状态 |
|---|---|
| Phase 0 — Repository | 进行中 |
| Phase 1 — Core | 待审核 |
| Phase 2 — Renderer | 待审核 |
| Phase 3 — Viewer Worker | 待审核 |
| Phase 4 — API Worker | 待审核 |
| Phase 5 — CLI | 待审核 |
| Phase 6 — Cloudflare 生产部署 | 待审核 |
| Phase 7 — Documentation | 待审核 |
| Phase 8 — MCP（post-V1） | 待审核 |
| Phase 9 — Skill（post-V1） | 待审核 |

---

## 3. Phase 0 — Repository

**状态**：进行中（2026-09-03 用户审核通过；交付完成，待用户验收）

**目标**：建立可构建、可测试、可 lint 的 pnpm workspace Monorepo 骨架。

**前置条件**：无（当前仓库仅有 `.docs/`，无 commit）。

### Checklist

- [x] 初始化 git 首个 commit（包含 `.docs/`）
- [x] `pnpm-workspace.yaml`（`apps/*`、`packages/*`）
- [x] 根 `package.json`（private，统一 scripts：`build` / `lint` / `test` / `typecheck` / `format`）
- [x] 根 `tsconfig.json`（strict）+ 各包继承
- [x] ESLint（typescript-eslint）+ Prettier 配置
- [x] Vitest 根配置（各包可独立运行测试）
- [x] `.gitignore`（node_modules、dist、.wrangler、.dev.vars 等）、`.editorconfig`
- [x] `LICENSE`
- [x] `README.md` 骨架（项目定位 + 一句话使用示例，后续 Phase 7 完善）
- [x] `docs/architecture.md` 初版（提炼自《基线》§7-§10、§64）
- [x] GitHub Actions CI（lint + typecheck + test，仅工程效率用途，不引入额外基础设施）

### 交付标准

1. `pnpm install && pnpm lint && pnpm typecheck && pnpm test` 全部通过。
2. 目录结构与《基线》§41 一致（`apps/`、`packages/` 骨架就位）。
3. 首个 commit 提交完成。

---

## 4. Phase 1 — Core（`@mote/core` + `@mote/protocol`）

**状态**：待审核

**目标**：实现所有纯函数基础能力与共享协议类型。

**前置条件**：M0。

### Checklist

`packages/core`：

- [ ] Base58 编码/解码（字符表排除 `0 O I l`，《基线》§5）
- [ ] Document ID 生成：16 字符 Base58，基于 `crypto.getRandomValues()`；ID 格式校验器
- [ ] Asset ID 生成：12 字符 Base58；格式校验器
- [ ] SHA-256（`crypto.subtle`，Worker 与 Node 均可用的封装）
- [ ] MIME：Magic Bytes 检测（png/jpeg/webp/gif/avif），不信任扩展名（《基线》§13）；白名单校验
- [ ] 路径规范化与 remote/local URL 判定（`https?://` vs `./`、`../`、相对路径）
- [ ] 限制常量集中定义：Markdown ≤ 2MB、Asset ≤ 10MB、Bundle ≤ 20MB、Asset ≤ 50 个（《基线》§14）
- [ ] 各 validator（document id、asset id、manifest 结构、bundle 限额）

`packages/protocol`：

- [ ] `PublishManifest`（客户端 manifest，《基线》§16）
- [ ] `DocumentManifest`（R2 存储 manifest，《基线》§10）
- [ ] `PublishResponse`（《基线》§17）
- [ ] `ErrorResponse` + 错误码枚举（`INVALID_DOCUMENT` 等，《基线》§18）
- [ ] multipart field 约定常量（`document` / `manifest` / `asset_N`）

### 交付标准

1. 单测覆盖《基线》§56 中与 core 相关项：Base58 生成、ID 校验、路径规范化、MIME 校验、SHA256、remote/local 判定、manifest 校验。
2. `@mote/core` **零运行时依赖**：不 import Cloudflare API、Node `fs`、HTTP 客户端（《基线》§42）。
3. 生成的 Document ID 熵验证：单测抽样校验字符表与长度。

---

## 5. Phase 2 — Renderer（`@mote/renderer`）

**状态**：待审核

**目标**：实现纯函数、确定性的 Markdown → HTML 渲染管线。

**前置条件**：M1。

### Checklist

- [ ] markdown-it 接入，配置 `html: false, linkify: true, breaks: false, typographer: false`（《基线》§26）
- [ ] Local asset 重写：依据 manifest `references[]` 将 `./images/x.png` → `/{document-id}/a/{asset-id}`（《基线》§31）
- [ ] Remote asset 原样保留 `https?://`（《基线》§32）
- [ ] `javascript:` 等危险协议的 link/image URL 拦截（《基线》§57）
- [ ] Heading anchor（slug 化 + id 注入）
- [ ] Automatic TOC（从 heading 提取，页面顶部/侧边插入）
- [ ] HTML template：`<main><article>` 结构，CSS inline，`<meta name="referrer" content="no-referrer">`，`<meta name="robots" content="noindex,nofollow,noarchive">`（《基线》§29、§32、§34）
- [ ] 响应式 CSS：max-width 860px 居中、代码块/表格水平滚动、`img{max-width:100%}`（《基线》§30）
- [ ] Dark mode：`@media (prefers-color-scheme: dark)`，无 JS（《基线》§30）
- [ ] 代码块输出 `<pre><code class="language-x">`，仅 CSS 基础样式，不做服务端高亮（《基线》§28）
- [ ] Security headers helper：CSP（`default-src 'none'; img-src 'self' https: http:; style-src 'unsafe-inline'; script-src 'none'; ...`）、`X-Content-Type-Options`、`Referrer-Policy`、`X-Frame-Options`、`X-Robots-Tag`（《基线》§33）
- [ ] 对外签名：`render(markdown, manifest, documentId) → HTML string`，保持 Pure / Deterministic（《基线》§42）

### 交付标准

1. renderer 单测全绿（渲染快照、asset 重写、TOC、anchor）。
2. **XSS 安全测试全绿**（《基线》§57）：
   - `<script>alert(1)</script>` 不进入 DOM；
   - `[click](javascript:alert(1))` 不产生 javascript URL；
   - `![](javascript:alert(1))` 不输出危险 src；
   - `<img src=x onerror=alert(1)>` 不成为 HTML Element。
3. 相同输入两次渲染输出完全一致（确定性验证）。
4. CSP 生成单测覆盖。

---

## 6. Phase 3 — Viewer Worker（`apps/viewer`）

**状态**：待审核

**目标**：实现匿名只读公开访问 Worker，manifest 作为存在性判据，接入 Workers Cache。

**前置条件**：M2。

### Checklist

- [ ] 路由（《基线》§24）：
  - [ ] `GET /{document-id}`、`HEAD /{document-id}`
  - [ ] `GET /{document-id}/a/{asset-id}`、`HEAD /{document-id}/a/{asset-id}`
  - [ ] `GET /robots.txt`（`User-agent: * Disallow: /`）、`GET /health`（不访问 R2，《基线》§47）
- [ ] Render flow（《基线》§25）：`manifest.json` 不存在 → 404；存在 → 读 `document.md` → renderer → Response
- [ ] **统一 404**：Malformed ID 与不存在 ID 返回相同 404（《基线》§24）
- [ ] Asset 响应：按 manifest 中 `contentType` 返回正确 Content-Type
- [ ] Security headers（复用 renderer helper，《基线》§33）
- [ ] Cache headers（《基线》§35）：
  - [ ] Document：`Cache-Control: public, max-age=300` + `Cloudflare-CDN-Cache-Control: public, max-age=31536000`
  - [ ] Asset：`Cache-Control: public, max-age=31536000, immutable` + `Cloudflare-CDN-Cache-Control: public, max-age=31536000`
- [ ] `wrangler.toml`：R2 binding `DOCUMENTS`、`[cache] enabled = true`、**不设置** `cross_version_cache`（《基线》§36、§52）
- [ ] 不使用 `caches.default`（《基线》§53）
- [ ] 结构化日志，不记录文档内容与完整敏感信息（《基线》§48）

### 交付标准

1. Miniflare 集成测试通过：构造 R2 数据 → GET document 渲染正确 HTML；GET asset 返回正确 Content-Type（《基线》§58 前半段）。
2. 404 测试：随机 malformed ID 与不存在 ID 的响应体/状态一致。
3. Header 测试：CSP / no-referrer / noindex / cache headers 逐项断言。
4. manifest 缺失（document.md 存在）→ 404 的原子性测试（《基线》§54）。

---

## 7. Phase 4 — API Worker（`apps/api`）

**状态**：待审核

**目标**：实现受 Token 保护的 `POST /v1/publish`，完成验证、ID 生成与 manifest-last 原子写入。

**前置条件**：M2（与 Phase 3 可并行，但 M3 需两者同时完成）。

### Checklist

- [ ] Bearer 认证：`Authorization: Bearer <token>` 对比 Worker Secret `MOTE_PUBLISH_TOKEN`（《基线》§38）；不记录、不返回 token
- [ ] multipart/form-data 解析：`document` / `manifest` / `asset_N` fields（《基线》§16）
- [ ] Markdown 校验：非空、UTF-8、≤ 2MB
- [ ] Asset 校验：数量 ≤ 50、单个 ≤ 10MB、Bundle ≤ 20MB、MIME 白名单（Magic Bytes 复核，拒绝 SVG/HTML/JS → 415）
- [ ] 客户端 manifest 结构校验（`field` 与 multipart 字段对应、`references` 非空 → 422）
- [ ] Document ID 生成 + **R2 冲突检查**（`documents/{id}/manifest.json` 已存在则重新生成，内部 retry，不对客户端返回 409，《基线》§5、§18）
- [ ] Asset ID 生成（12 字符 Base58）
- [ ] **manifest-last 原子写入顺序**：assets → `document.md` → `manifest.json`（含 `createdAt`、`source.sha256`、asset `sha256`，《基线》§10、§54）
- [ ] 响应：`201 Created` + `{ id, url }`（《基线》§17）
- [ ] 统一错误结构 `{ error: { code, message } }`，状态码 400/401/413/415/422/500（《基线》§18）
- [ ] `GET /health`（不访问 R2）
- [ ] `wrangler.toml`：R2 binding、不启用 cache（《基线》§8.2）
- [ ] 结构化 publish 日志：`event/documentId/markdownBytes/assetCount/assetBytes`（《基线》§48）

### 交付标准

1. Miniflare 集成测试全绿：publish → R2 对象按正确 key 创建 → manifest 存在（《基线》§58）。
2. 错误矩阵测试：无 token → 401；坏 multipart → 400；超限 → 413；SVG → 415；manifest 不一致 → 422。
3. 写入顺序测试（mock R2 记录调用序）：manifest.json 最后一次写入。
4. ID 冲突 retry 测试（mock 已存在场景）。
5. **M3 Gate**：与 Viewer 联调——API 发布的文档可被 Viewer 渲染，asset 可访问。

---

## 8. Phase 5 — CLI（`apps/cli`）

**状态**：待审核

**目标**：实现 `mote README.md` 最短路径发布体验，复用 `@mote/core` / `@mote/protocol`。

**前置条件**：M3。

### Checklist

- [ ] 命令：`mote <markdown-file>` 与 `mote publish <markdown-file>` 等价（《基线》§20）
- [ ] 参数：`--api` / `--token` / `--json` / `--verbose` / `--no-assets`
- [ ] 配置优先级：CLI 参数 > 环境变量（`MOTE_API_URL` / `MOTE_TOKEN`）> 配置文件 > 默认值（`https://api.mote.flc.io`）（《基线》§21）
- [ ] **Markdown AST 解析**（不依赖正则），识别行内图片与引用式图片 `![foo][image]` + `[image]: ./path`（《基线》§22）
- [ ] Remote URL（`https?://`）跳过；local URL 解析为文件系统路径
- [ ] 文件安全检查：resolve absolute path → 存在 → regular file → MIME → 大小 → SHA-256 → 按内容去重（同一图片多次引用只上传一次，`references[]` 记录全部引用）（《基线》§22、§23）
- [ ] **只上传实际引用的资产**，不扫描未引用目录（《基线》§23）
- [ ] multipart 组装 + API client（Bearer token、错误结构解析）
- [ ] 进度输出（Scanning / Markdown 大小 / Assets 数 / Total / Published URL，《基线》§19）
- [ ] `--json` 输出 `{ id, url }`（供 AI Agent / CI / MCP 使用，《基线》§20）
- [ ] Token 保护：不写入仓库、不写日志、不打印 stdout（《基线》§21）

### 交付标准

1. 本地端到端（对接本地 API + Viewer，wrangler dev / Miniflare）：
   - `mote` 发布含本地图片的 Markdown → 返回 URL → Viewer 正常渲染且图片可见。
2. 单测覆盖：AST 图片提取（行内 + 引用式）、去重、路径解析、配置优先级。
3. E2E 用例覆盖《基线》§59 Case 1-8（纯 Markdown / +PNG / 多图 / 远程图 / 不存在文档 / 无效 token / SVG 拒绝 / 超限）。
4. **M4 Gate**：一条命令完成 publish → view 闭环。

---

## 9. Phase 6 — Cloudflare 生产部署

**状态**：待审核

**目标**：V1 在生产环境按《基线》架构运行。

**前置条件**：M4。

### Checklist

- [ ] 创建 R2 bucket `mote-documents`（Standard，不用 Infrequent Access，《基线》§51）
- [ ] `wrangler secret put MOTE_PUBLISH_TOKEN`（≥ 256 bit 随机，《基线》§38）
- [ ] 部署 `mote-api`，绑定 R2，配置 Custom Domain `api.mote.flc.io`
- [ ] 部署 `mote-viewer`，绑定 R2，`[cache] enabled = true`，配置 Custom Domain `mote.flc.io`
- [ ] 验证 DNS/TLS 由 Cloudflare Custom Domain 自动处理（《基线》§8.2）
- [ ] 验证 Workers Cache：首次 MISS、后续 HIT，且 HIT 时 Viewer Worker 不执行（无 render 日志、无 R2 Read 计量）（《基线》§61 Cache）
- [ ] 验证部署 Viewer 新版本后使用新 cache namespace（`cross_version_cache` 默认行为，《基线》§36）
- [ ] 生产 smoke test：CLI 真实发布 → 浏览器访问 → 图片可见

### 交付标准

生产环境逐条通过《基线》§61 Definition of Done（见 §11 汇总表）。

---

## 10. Phase 7 — Documentation

**状态**：待审核

**目标**：文档达到可独立上手与可维护水平。

**前置条件**：可与 Phase 6 并行收尾。

### Checklist

- [ ] `README.md`：安装（`npm install -g`）、`export MOTE_TOKEN=...`、`mote README.md`、参数说明、限制说明（《基线》§60 Phase 7）
- [ ] `docs/architecture.md`：架构图、Worker 划分、R2 数据模型、原子发布、缓存策略
- [ ] `docs/protocol.md`：Upload API 协议（multipart fields、manifest schema、响应与错误码）
- [ ] `docs/security.md`：Capability URL 模型与适用/不适用场景、CSP、XSS 防护、Token 管理、日志红线

### 交付标准

1. 新用户仅按 README 可独立完成 安装 → 配置 token → 发布 → 访问。
2. 文档内容与实现一致（链接、字段名、命令可执行）。

**M5（V1 上线）= Phase 6 + Phase 7 交付标准全部满足。**

---

## 11. V1 总验收标准（Definition of Done 汇总）

| # | 项 | 判据 | 来源 |
|---|---|---|---|
| 1 | Publish | `mote README.md` 输出 `https://mote.flc.io/{id}` | §61 |
| 2 | Markdown | 浏览器正常渲染 | §61 |
| 3 | Local Images | 发布后正常显示，公开 URL 不含原始文件名 | §61、§11 |
| 4 | Remote Images | 正常显示，页面带 no-referrer | §61、§32 |
| 5 | Immutable | 相同 Markdown 发布两次得到两个不同 URL，旧 URL 内容不变 | §61、§3 |
| 6 | Security | raw HTML 关闭、javascript URL 拦截、无 JS 执行、noindex、no-referrer | §61、§33 |
| 7 | Cache | 首 MISS 后 HIT；HIT 时 Worker 不重新 render、R2 不重新读 | §61、§35 |
| 8 | Cost | 正常使用保持 Cloudflare Free Tier 可运行 | §61、§50 |

---

## 12. Phase 8 — MCP（post-V1）

**状态**：待审核

**目标**：提供 MCP Server，复用 Publish Client，不重复实现上传逻辑（《基线》§43）。

### Checklist

- [ ] `apps/mcp` 骨架（stdio transport）
- [ ] Tool `publish_markdown`：输入 `{ markdown }`，返回 `{ url }`
- [ ] Tool `publish_markdown_file`：输入文件路径，走 CLI 同款 asset 扫描链路
- [ ] 配置复用 `MOTE_API_URL` / `MOTE_TOKEN`

### 交付标准

MCP 客户端调用 `publish_markdown` 返回可访问 URL；与 CLI 使用同一 protocol 包（无平行上传实现）。

---

## 13. Phase 9 — Skill（post-V1）

**状态**：待审核

**目标**：让 AI Agent 发现"Markdown 需要被分享 → 使用 Mote"。

### Checklist

- [ ] `skills/mote/SKILL.md`：何时使用、如何调用 CLI、如何处理返回 URL（《基线》§44）
- [ ] 不包含上传协议实现，仅指导调用 CLI

### 交付标准

在支持 Skill 的 Agent 环境中，给出"把这份 Markdown 分享出去"类指令可触发 Mote 流程。

---

## 14. 风险与应对

| 风险 | 影响 | 应对 |
|---|---|---|
| Workers Cache 行为依赖（`cache.enabled` 需 Wrangler 4.69.0+，版本纳入 cache key） | 缓存不生效或跨版本串缓存 | 锁定 Wrangler ≥ 4.69.0；Phase 6 显式验证 HIT 与新版本新缓存（《基线》§35、§36） |
| multipart 解析内存压力（Worker 128MB 限制） | 大 bundle OOM | Bundle 限 20MB；Phase 4 超限测试；必要时流式解析（《基线》§14） |
| markdown-it 与 Workers 运行时兼容性 | 渲染失败 | Phase 2 即在 Miniflare 环境跑 renderer 测试，而非仅 Node |
| Free tier 10ms CPU / invocation | 渲染超时 | 渲染保持轻量；不做服务端高亮；Phase 6 观察 CPU 计量（《基线》§28、§50） |
| 发布失败产生 orphan 对象 | R2 脏数据 | V1 容忍少量 orphan；Phase 2 后再评估 Cron 清理（《基线》§55） |
| Token 泄露 | 任何人可发布 | ≥256bit、wrangler secret、日志红线；泄露即轮换（《基线》§38、§48） |
| 枚举/滥用 | 隐私暴露、成本上升 | 94bit ID + 统一 404 + Cache；超限再引入 Rate Limiting/Turnstile（《基线》§39） |

---

## 15. 执行原则（对实施者的约束）

1. **阶段审核门禁**：只执行状态为「已审核」或「进行中」的阶段；「待审核」阶段禁止任何实现工作。每个阶段由用户明确批准后才开始，交付后由用户验收通过才标记「已完成」。
2. 严格按 Phase 顺序执行；每阶段测试全绿再进入下一阶段。
3. 最小正确版本：不实现《基线》§62 所列任何项。
4. 不擅自引入数据库、用户系统；不改变 `/{document-id}` 路由；不将 HTML 持久化到 R2；manifest 必须最后写入；raw HTML 必须关闭；Viewer/API 职责分离；CLI/MCP/Skill 复用同一 Publish Protocol。
5. 技术实现与《基线》冲突时，保持产品模型，选择等价实现（《基线》§65.14）。
6. 任何明显增加基础设施复杂度的方案，在无明确收益前不引入（《基线》§65.15）。
7. 本计划变更需更新状态字段（draft → active → done）并记录变更说明。
