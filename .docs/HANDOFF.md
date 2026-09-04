# Mote 项目交接文档（Handoff）

> 写给接续的 AI 或协作者。生成于 2026-09-04，当时仓库状态：v0.1.1 已发布，计划 001–003 全部完成。
> 阅读顺序建议：本文 → 架构基线 → 当前执行的计划 005；计划 004 保持待做。

## 1. 项目是什么

**Mote = Markdown in, URL out.** 把本地 Markdown 发布为不可变、不可枚举、浏览器可读的在线页面。

- 仓库：https://github.com/flc1125/mote
- 生产：https://mote.flc.io（Viewer）+ `https://mote.flc.io/api/v1/publish`（发布 API）+ `https://mote.flc.io/api/mcp`（远程 MCP）
- npm 包：`mote-cli`（https://www.npmjs.com/package/mote-cli），命令名 `mote`
- 架构基线（一切决策的权威来源）：`.docs/arcs/Mote：不可变 Markdown 在线发布服务方案.md`

## 2. 文档地图

| 位置 | 内容 |
|---|---|
| `.docs/arcs/` | 架构基线（产品/安全/协议的最终裁决者） |
| `.docs/plans/` | 实施计划：001（V1，done）、002（远程 MCP，done）、003（开源化 v0.1.1，done）、004（待做）、005（Access OAuth，Phase 0 进行中）；见 §6 |
| `.docs/reports/` | 阶段验证记录；区分本地检查、官方资料和真实环境实测，不能用待验证项代替通过结果 |
| `docs/` | architecture / protocol / security / cli / mcp / skill / self-hosting（英文为主）+ `docs/zh-CN/`（中文副本） |
| `SECURITY.md` | 漏洞报告政策（根目录，GitHub 约定位置） |

## 3. 技术栈与关键版本

- pnpm **11.23**（`packageManager` 已固定；pnpm 10+ 会按该字段自动切换）/ Node ≥ 20（CI 用 24）
- TypeScript **5.9.3**（TS 7 暂缓：typescript-eslint v8 未支持）/ ESLint 10 / Prettier 3 / Vitest 4
- Wrangler 4.128 / `@cloudflare/vitest-pool-workers` 0.22（Workers 测试跑在真实 workerd）
- markdown-it 15（`html:false` 等配置见 `@mote/renderer`）/ MCP SDK 1.30 / **zod 注意**：`@mote/protocol` 用 v4；`apps/mcp` 与 SDK 的配合曾踩过 interface 无隐式索引签名的坑（结果类型必须用 type alias）
- `apps/cli` 依赖全部在 devDependencies（esbuild 打包自包含）；发布时 `publishConfig.name` 把 `@mote/cli` 改写为 `mote-cli`

## 4. 工作流程约定（重要，接续者必须遵守）

1. **阶段审核门禁**：计划里的阶段有状态字段（待审核 → 已审核 → 进行中 → 已完成）。**「待审核」阶段禁止实现**，必须用户明确批准并要求执行该阶段；整体同意计划或创建分支不等于一次性授权所有阶段。开始执行改「进行中」，交付后用户验收才标「已完成」，再等待下一阶段指令，不自行连续推进。计划文件命名：`.docs/plans/NNN-YYYY-MM-DD-状态-名称.md`（状态 draft/active/done，流转时同步改文件名）。
2. **不擅自提交或推送**：完成工作后保持变更在工作区。commit 与 push 分别以用户明确指令为准；阶段执行授权不包含提交或推送授权。
3. **main 分支已保护**：一切走 PR（建分支 → 推送 → `gh pr create`）。合并后打 tag 发版。
4. 冲突裁决：实现与基线冲突时保持基线产品模型（基线 §65.14）。
5. PR 会有 **Codex 自动 review**——认真对待其意见但保持独立判断（历史上两条 P1/P2 均为真问题）。

## 5. 基础设施现状（Cloudflare 账号归用户）

- 两个 Worker：`mote-viewer`（路由 `mote.flc.io/*`，Workers Cache 开启）与 `mote-api`（路由 `mote.flc.io/api/*`，最具体路由优先）；**不要用 Custom Domain**（会遮蔽 /api/* 路由）
- R2 bucket：`mote-documents`；数据结构 `documents/{id}/{document.md,manifest.json,assets/…}`，manifest 最后写入（commit marker）
- 发布凭证 `MOTE_TOKEN`：服务端为 wrangler secret；本地在 `~/.config/mote/config.json`（权限 600）——**不要在任何地方打印或提交真值**
- DNS：`mote` 子域有一条 AAAA `100::`（proxied）占位记录（Worker 路由需要）
- `wrangler.toml` 的 `compatibility_date` 钉在 **2026-08-15**（测试链内置 workerd 较旧，往新改会炸本地测试）
- 发版：改 `apps/cli` 版本号 → 写 CHANGELOG → PR 合并 → 打 tag `vX.Y.Z` 推送 → `release.yml` 全自动（npm OIDC Trusted Publishing + GitHub Release）。npm 端 Trusted Publisher 已配置（repo + release.yml）
- **Cloudflare 自动化部署尚未配置**（用户于 2026-09-04 确认）：上述 npm/GitHub Release 流程不等于 Worker 部署。部署和 Access 配置变更在获授权阶段内按确认的目标环境与清单单独执行；不假定推送即部署，也不擅自新增部署流水线。

## 6. 待办（计划 004，未开始，逐阶段需用户批准）

`.docs/plans/004-2026-09-04-draft-mote-open-source-followup-plan.md`：

- **Phase 0** docs 英文化（architecture/protocol/security 翻译为英文为主，中文移 `docs/zh-CN/`）
- **Phase 1** 首页落地页：`GET /` 目前 404，要变成静态介绍页（设计方案已写在计划里待用户确认；约束：不做列表/搜索/上传表单，无 JS，复用文档页 CSS）
- **Phase 2** favicon 与品牌延伸（资产已就绪：`docs/assets/favicon-32/16.png`，剩 Viewer 集成 + `<link rel="icon">`）
- **Phase 3** 收尾可选项（dependabot、demo 截图、FUNDING）

### 当前执行：计划 005 Phase 0

- 计划：[005 Access OAuth](plans/005-2026-09-04-active-mote-cloudflare-access-oauth-plan.md)，工作分支 `feat/cloudflare-access-oauth`。
- 用户于 2026-09-04 明确要求开始 **Phase 0 — 兼容性与架构验证**；状态为进行中，Phase 1–5 仍待审核，不得自行推进。
- [验证记录](reports/005-2026-09-04-phase-0-access-oauth.md)：已完成本地盘点、官方资料核验、生产只读基线及控制台只读检查。用户已确认测试域名 `mote-oauth-test.flc.io`、资源前缀 `mote-oauth-test`，本轮先测 Codex，其余目标暂缓但不视为通过。
- 用户已登录 FLC 账号并提供准入邮箱（不在公开文档记录明文）。控制台实测已有 `flc1125.cloudflareaccess.com` 团队、One-time PIN / Cloudflare 登录源及其他应用和隧道；用户已同意复用，不再创建或改名为 `mote-test`。不要改动既有团队、IdP、应用或隧道。
- 已创建 `mote-oauth-test` Access 应用，ID `4c2df629-1c20-4ebc-a740-eb37f057a4bc`，关联单邮箱 Allow 策略 `mote-oauth-test-publisher`（ID `722cc89f-5015-4b10-9773-a2e7105833fb`）。API 读回已核对三个保护路径、仅 One-time PIN、仅 localhost / loopback 回调及空公网回调清单。
- 控制台 24 小时菜单限制已通过 API 验证澄清：创建 HTTP 201，独立 GET 仍返回 `access_token_lifetime: 168h`、`session_duration: 720h`。这是配置写入/读回通过，不是实际令牌签发、刷新、撤权或 Codex 登录通过；不要用控制台默认值覆盖这组 API 配置。应用 AUD 与公开 JWKS 结果见验证记录 §10。
- 用户批准的临时 API 凭据仅有当前账号的 Access 应用/策略编辑权限；有效期截至 `2026-09-04T23:59:59Z`（北京时间 9 月 5 日 07:59:59），ID `c1ceb20a6f0a8f2d8772eed514cb5578`。验证进程已退出，未持久化凭据；未主动撤销云端令牌，也没有扩大为 DNS、Workers 或 R2 管理权限。
- 冻结锁文件安装已成功（pnpm 11.23.0），依赖清单与锁文件不变。测试 DNS、Worker、R2 及 OAuth 验证原型仍待准备，先按 Phase 0 范围继续隔离环境与 Codex 实测。生产未改，未提交、推送或部署；Phase 1–5 未启动。

## 7. 已知遗留与坑

- **Dependabot 报 5 个依赖漏洞（1 high / 4 moderate）**：用户决定暂不处理（2026-09-04）。处理时先跑 `pnpm audit` 看是否都是 devDependencies 传递依赖。
- 分支清理完成（2026-09-04）：`chore/release-workflow`、`feat/npm-mote-cli`、`docs/plan-003-done` 均已合并，远端分支已删除；本地已删除这三个分支及 `open-source-root`。
- PR #4（plan 003 done 标记）已合并到 `main`（`b64dbea`），本地 `main` 已同步。
- 本地分支 `archive/pre-open-source-20260904` 是开源首发前的历史备份（仅本地）。
- Node 26 类型（@types/node）的 TypedArray 泛型坑：`Uint8Array<ArrayBuffer>` 收窄，相关处理在 `packages/core`。
- markdown-it v15：自定义 image 规则必须委托默认规则否则丢 alt；危险协议链接在解析期就不生成链接（保留为字面文本）。
- Viewer 读 manifest 用 `text() + JSON.parse`（miniflare 类型不带 json()）。
- Workers 包的类型用 `wrangler types` 生成（`worker-configuration.d.ts`），**不要**装回 `@cloudflare/workers-types`（已被官方取代）。

## 8. 常用命令

```bash
pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm format:check   # 全量验证（179+ 测试）
pnpm --filter @mote/cli build        # 构建 CLI
pnpm --filter @mote/api deploy       # 部署 API Worker（viewer 同理）
mote <file.md> --json                # 发布（本机已全局安装 mote-cli）
```

## 9. 会话背景（如需溯源）

本交接由 Claude Code 会话产生；同机可 `claude --resume` 恢复该会话（项目目录 `/Users/flc/data/www/open-source/flc1125/mote`）。项目级持久记忆在 `~/.claude/projects/-Users-flc-data-www-open-source-flc1125-mote/memory/`（阶段审核门禁、不擅自提交等规则），若接续者也是本机 Claude Code 会自动加载。
