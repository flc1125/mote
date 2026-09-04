# Mote 远程 MCP 实施计划

> **计划编号**：002
> **日期**：2026-09-03
> **状态**：done
> **上游计划**：`.docs/plans/001-2026-09-03-done-mote-v1-implementation-plan.md`（V1 已完成）
> **架构基线**：`.docs/arcs/Mote：不可变 Markdown 在线发布服务方案.md`

本计划为 Mote 增加**远程 MCP（Streamable HTTP transport）**能力，使 Claude 网页版、ChatGPT、Claude Code、Codex 等客户端可通过公网调用 Mote 发布工具。沿用计划 001 的阶段审核机制与执行原则（§15 同样适用，含「不擅自提交代码」）。

## 背景与设计决策（2026-09-03 用户确认）

| 决策点 | 结论 |
|---|---|
| 目标客户端 | Claude 网页版、ChatGPT、Claude Code、Codex 及其他 MCP 客户端 |
| 端点形态 | `POST https://mote.flc.io/api/mcp`，挂在**现有 API Worker**（零新增基础设施） |
| 状态模型 | **无状态**（stateless）：不引入 Durable Object / Session；`GET` → 405，通知 → 202 |
| 鉴权 | 与发布 API 共用 Bearer Token（请求头，HTTPS） |
| Token 模型 | **单 token**（所有客户端共用，泄露时整体轮换） |
| Token 命名 | 服务端 secret 由 `MOTE_PUBLISH_TOKEN` 统一为 **`MOTE_TOKEN`**（与 CLI 客户端环境变量一致） |
| 暴露工具 | 仅 `publish_markdown`（远程服务器无法访问客户端本地文件，`publish_markdown_file` 不适用） |
| 协议实现 | 首选官方 SDK `McpServer` + Worker fetch 适配；兜底手写极简 JSON-RPC dispatch（`initialize` / `notifications/initialized` / `tools/list` / `tools/call`） |

## 阶段状态总览

| 阶段 | 状态 |
|---|---|
| Phase 0 — Token 命名统一迁移 | 已完成 |
| Phase 1 — 远程 MCP 端点 | 已完成 |
| Phase 2 — 客户端验证与文档 | 已完成 |

---

## 1. Phase 0 — Token 命名统一迁移（`MOTE_PUBLISH_TOKEN` → `MOTE_TOKEN`）

**状态**：已完成（2026-09-03 用户验收通过）

**目标**：服务端 secret 与客户端环境变量统一为 `MOTE_TOKEN`，消除命名分裂。

### Checklist

- [x] 代码：`apps/api` 读取 `env.MOTE_TOKEN`（含类型、测试绑定 `miniflare.bindings`）
- [x] 测试：API 全部测试改用 `MOTE_TOKEN`（含 CLI/MCP E2E 中的 `apiEnv`）
- [x] 文档：基线 §38、`docs/security.md`、`docs/protocol.md`、`docs/architecture.md`、README（如涉及）
- [x] 生产迁移：新设 secret `MOTE_TOKEN` → 部署 `mote-api` → 发布验证 → 删除旧 secret `MOTE_PUBLISH_TOKEN`
- [x] 本地 `~/.config/mote/config.json` 无需变更（键名本就是 `token`）

### 交付标准

1. 全仓测试全绿，代码与文档中不再出现 `MOTE_PUBLISH_TOKEN`。 ✅（166 个测试全绿；仅计划 001 历史记录与计划 002 改名说明中保留旧名）
2. 生产环境用 `MOTE_TOKEN` 发布一篇文档成功；旧 secret 已删除。 ✅（设新 secret → 部署 → 发布验证 `h6ZSwoaXk4yz9zsK` → 删旧 secret → 复验发布 `i4tuzUsHrufnsmTW`）

---

## 2. Phase 1 — 远程 MCP 端点（`POST /api/mcp`）

**状态**：已完成（2026-09-03 用户验收通过）

**目标**：API Worker 提供无状态 Streamable HTTP MCP 端点，暴露 `publish_markdown` 工具。

**前置条件**：Phase 0 完成。

### Checklist

- [x] `POST /api/mcp` 路由（Bearer 校验，复用现有 auth）
- [x] JSON-RPC 方法：`initialize`、`notifications/initialized`（202）、`tools/list`、`tools/call`
- [x] 无状态语义：不签发/不校验 `Mcp-Session-Id`；`GET /api/mcp` → 405
- [x] 工具 `publish_markdown`（参数与返回同 stdio 版：`markdown` 必填、`name` 可选 → `{ id, url }`）
- [x] Worker 内部直接调用 `prepareBundle / commitBundle`（**不做自我 HTTP 回环**）
- [x] 协议适配层与 `@mote/mcp` 的 stdio 版共享工具定义（schema/description 单一来源，避免两份漂移）
- [x] 错误映射：401（无/错 token）、400（坏 JSON-RPC）、404（未知方法/路由按 API 约定）、500
- [x] 日志：仅 `event/documentId/字节数`，不记 token 与内容

### 交付标准

1. pool-workers 集成测试全绿：initialize → tools/list（恰一个工具）→ tools/call 发布成功 → R2 bundle 正确。 ✅（API 28 个测试，其中 MCP 13 个）
2. 错误矩阵：无 token 401、坏 JSON 400、未知方法 -32601、坏参数 -32602、超限 isError、GET → 405、通知 → 202、batch → 400。 ✅
3. 生产部署后 `curl` 实测 initialize/tools/list 通过。 ✅（另实测 tools/call 真实发布 `7oyEmcUpc3F8LcCX`，页面正常渲染）

### 交付备注（2026-09-03）

- 协议实现采用**手写极简无状态 JSON-RPC dispatch**（计划中的兜底方案）：官方 SDK 的 StreamableHTTP transport 绑定 Node req/res，对 4 个方法的无状态端点而言适配层比 dispatch 更复杂。
- 工具 schema/description 单一来源在 `@mote/protocol` 的 `mcpTools.ts`，stdio（apps/mcp）与远程（apps/api）共用。
- tools/call 通过把 raw markdown 包装成 multipart 形式，**原样复用** `prepareBundle / commitBundle`，无平行发布逻辑。

---

## 3. Phase 2 — 客户端验证与文档

**状态**：已完成（2026-09-04 用户验收通过；Claude 网页版与 ChatGPT 两项实测按用户决定跳过）

**目标**：真实客户端连通验证 + 配置文档。

**前置条件**：Phase 1 生产部署完成。

### Checklist

- [ ] ~~Claude 网页版 connector 实测~~（用户决定跳过，2026-09-04）
- [x] Codex 远程 MCP 配置实测 ✅（2026-09-04：用户通过 Codex 成功调用 `publish_markdown` 发布文档 `gBrkktbu6vLBm8iE`，页面渲染正常；配置方式 `codex mcp add mote --url ... --bearer-token-env-var MOTE_TOKEN`）
- [ ] ~~ChatGPT 连通性验证~~（用户决定跳过，2026-09-04）
- [x] README 增加「远程 MCP」一节（Claude 网页版 / Claude Code / 通用客户端配置示例）
- [x] `docs/security.md` 补充远程 MCP 的鉴权说明与 token 使用红线（token 只在 header，不进 URL/日志/聊天上下文）

### 交付标准

1. ~~Claude 网页版实际完成一次「对话中发布 Markdown → 拿到 URL → 浏览器可打开」~~（用户决定跳过）
2. README 配置示例与生产行为一致（照抄可用）。 ✅

### 交付备注（2026-09-04）

- **实测覆盖**：服务端协议 curl 全量验证（initialize/tools/list/tools/call/错误矩阵）；Codex 真实调用 `publish_markdown` 成功发布并渲染（`gBrkktbu6vLBm8iE`）。
- **用户决定跳过**：Claude 网页版 connector 实测与 ChatGPT 连通性验证。理由：MCP 服务端已被上述两项验证覆盖，用户认可「MCP 服务端没问题」。ChatGPT 的 Deep Research search/fetch 语义兼容性未验证，如未来需要再单独立项。
- README「MCP」一节与 `docs/security.md` 远程鉴权说明已完成。

---

## 4. 风险与应对

| 风险 | 影响 | 应对 |
|---|---|---|
| ChatGPT connector 仅支持特定工具语义（Deep Research 的 search/fetch） | ChatGPT 侧无法使用发布工具 | Phase 2 如实验证并记录；不为了兼容而扭曲 publish 语义（Future Work 再评估 search/fetch 形态） |
| 官方 SDK 的 StreamableHTTP transport 不适配 Workers Fetch API | 端点实现受阻 | 兜底手写极简无状态 JSON-RPC dispatch（4 个方法，范围可控） |
| 公网 token 被暴力枚举/泄露 | 任何人可发布 | token ≥ 256 bit；只走 HTTPS header；泄露即 `wrangler secret put` 轮换（所有客户端同步更新）；必要时再评估 rate limiting |
| 工具定义在 stdio 与远程两处漂移 | 行为不一致 | schema/description 抽为单一来源（`@mote/mcp` 或 protocol 包共享），两处 import |

## 5. 执行原则

沿用计划 001 §15：阶段审核门禁（待审核阶段禁止执行）、不擅自提交代码、最小正确版本、冲突以基线为准、不引入无明显收益的基础设施复杂度。Token 重命名属基线 §38 变更，随 Phase 0 同步更新基线文档。
