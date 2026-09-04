# Mote 首个开源版本（v0.1.0）实施计划

> **计划编号**：003
> **日期**：2026-09-04
> **状态**：draft
> **上游计划**：001（V1，done）、002（远程 MCP，done）
> **后续计划**：`.docs/plans/004-2026-09-04-draft-mote-open-source-followup-plan.md`（发布后锦上添花项）
> **架构基线**：`.docs/arcs/Mote：不可变 Markdown 在线发布服务方案.md`

本计划目标：**尽快发布 Mote 的第一个开源版本（v0.1.0）**。范围只保留阻塞发布的必需项，锦上添花内容拆至计划 004。沿用计划 001 的阶段审核机制与执行原则（含「不擅自提交代码」）。

## 已确认的决策（2026-09-04 用户确认）

| 决策点 | 结论 |
|---|---|
| 语言策略 | README 英文为主 + `README.zh-CN.md` 中文副本（docs 英文化移至计划 004） |
| 拆分原则 | 「没有自托管指南，开源用户无法使用 Mote」（发布需个人 token，外人不能用作者实例）——自托管指南属发布必需 |
| Logo | 随首个版本一起发布（用户指定） |
| 秘钥现状 | git 历史已审计：真实 token / 密钥模式 / `.env` 类文件**零泄露**（2026-09-04 全历史扫描） |

## 待决策（审核时确定）

| 决策点 | 选项 |
|---|---|
| npm 包名 | **已定：`mote-cli`**（`@mote` org 不可用；`mote.sh`/`mote-cli`/`@flc1125/mote` 中用户选择 `mote-cli`） |

## 阶段状态总览

| 阶段 | 状态 |
|---|---|
| Phase 0 — 秘钥安全与仓库卫生 | 已完成 |
| Phase 1 — Logo 品牌资产 | 已完成 |
| Phase 2 — 英文 README | 已完成 |
| Phase 3 — 仓库元数据 | 已完成 |
| Phase 4 — 自托管指南 | 已完成 |
| Phase 5 — npm 发布 | 进行中 |
| Phase 6 — CHANGELOG 与 v0.1.0 Release | 待审核 |

---

## 1. Phase 0 — 秘钥安全与仓库卫生

**状态**：已完成（2026-09-04 用户验收通过）

**目标**：把秘钥安全固化为仓库规范，堵住未来的泄露路径。

### Checklist

- [x] 根目录 `SECURITY.md`：漏洞报告政策（GitHub Security Advisory 渠道、响应时效、支持版本、披露流程），与 `docs/security.md`（安全模型）明确分工并互链
- [x] 秘钥管理规范补充进 `docs/security.md`：贡献者禁止提交 `.dev.vars` / 真实 token / wrangler 本地配置；测试一律使用显式假 token（如 `test-only-*`）
- [x] `.gitignore` 复核：`.dev.vars*`、`.env*`、`*.pem` 等遗漏项
- [x] git 历史审计结果写入交付备注（零泄露，含扫描方法）

### 交付标准

1. SECURITY.md 存在且包含可执行的报告渠道；文档中秘钥规范完整。 ✅
2. `git check-ignore` 验证敏感文件名模式全部被忽略。 ✅（.dev.vars* / .env* / *.pem / *.key 全部命中）

### 交付备注（2026-09-04）

- 新增根目录 `SECURITY.md`（中英双语）：Security Advisory 报告渠道、72h/7d 响应承诺、scope（文档机密性/XSS/发布鉴权/供应链）、支持版本表、贡献者秘钥卫生；与 `docs/security.md`（安全模型）互链分工。
- `docs/security.md` 新增 §7 贡献者秘钥规范：禁提交清单、假 token 命名约定（`test-only-*`）、文档占位符、提交前自检、泄露处置（轮换优先于历史改写）。
- `.gitignore` 增补：`.dev.vars.*`、`.env*`、`*.pem`、`*.key`。
- **git 历史审计**（2026-09-04 执行）：全历史 `git log -p --all` 扫描真实 token 值（0 次）、64 位十六进制 secret 模式（0 次）、`.env`/`.dev.vars` 跟踪文件（0 个）——零泄露确认。

---

## 2. Phase 1 — Logo 品牌资产

**状态**：已完成（2026-09-04 用户验收通过）

**目标**：确定 Mote Logo，随首个版本发布（用于 README；favicon 属计划 004 首页阶段的可选延伸）。

### Checklist

- [x] 我提供 Logo 设计 brief 与 3-4 个方向的提示词（含义：Mote = 微尘/微粒，契合"轻量、Markdown → URL"气质；风格：极简、几何、16px 可辨、单色可复现、明暗背景均可用）
- [x] 用户用 ChatGPT 生成候选图，选定方向
- [x] 产出资产：主 Logo（SVG 或高清 PNG）、方形 icon 版、README 展示版，存入 `docs/assets/`（或 `.github/assets/`）
- [x] README（Phase 2）顶部预留并填入 Logo

### 交付标准

1. Logo 资产入库并在 README 顶部展示；明暗背景下观感正常。 ✅

### 交付备注（2026-09-04）

- 选定方向 D（像素方点拖尾），ChatGPT 生成原图 1254×1254，经裁切（内容包围盒 855×581）后产出 `docs/assets/`：logo.png（主展示 640 宽）、icon.png（512×512 方形）、favicon-32/16.png（计划 004 favicon 阶段使用）、logo-dark.png（暗色背景变体：非透明像素重着色为 #e6edf3，程序化生成）。
- README（中英）顶部已嵌入 `<picture>`：light 模式用 logo.png、dark 模式自动切 logo-dark.png。

---

## 3. Phase 2 — 英文 README

**状态**：已完成（2026-09-04 用户验收通过）

**前置条件**：Phase 1（Logo 填入）。

**目标**：README.md 英文为主、中文副本，达到国际开源项目门面水准。

### Checklist

- [x] `README.md` 重写为英文：Logo、tagline、demo（发布示例输出）、特性列表、快速开始（安装/配置/使用）、MCP（远程+本地）、限制、自托管链接、文档地图、License
- [x] `README.zh-CN.md`：现有中文内容保留并同步结构调整
- [x] 两个 README 顶部互链语言切换
- [x] Badges：CI 状态、License、（npm 发布后加 version badge）
- [x] 链接全部有效

### 交付标准

1. 英文读者仅靠 README.md 完成 安装 → 配置 → 发布 → 访问。 ✅
2. 中英文内容一致（结构相同、无信息缺失）。 ✅

### 交付备注（2026-09-04，按用户要求重构为收敛版）

- **README 收敛为精炼门面**：Logo 预留位（注释块，Phase 1 产出后替换）、badges、tagline、demo、特性 5 条、Quick Start、Usage 指引（链接 docs）、Limits 小表、文档地图；`README.zh-CN.md` 同步结构，顶部互链。
- **细节下沉 docs**：新增 `docs/cli.md`（CLI 完整参考：安装/配置优先级/全部参数/资产处理链/排错表）与 `docs/mcp.md`（远程+本地 MCP 指南：端点规格、工具参数表、Claude.ai/Codex/通用配置、排错）。
- 链接校验通过；唯一未落地链接 `docs/self-hosting.md` 由 Phase 4 提供。
- 安装方式暂以源码构建为主，Phase 5 npm 发布后切换为 `npm install -g` 为主。
- 补充（2026-09-04 用户提出）：新增 `docs/skill.md`（Skill 说明与 `npx skills add flc1125/mote` 安装方式，已实测 `--list` 能发现仓库 skill）；README 中英双版 Usage 与文档地图同步补充。

---

## 4. Phase 3 — 仓库元数据

**状态**：已完成（2026-09-04 用户验收通过）

### Checklist

- [x] 仓库元数据（通过 `gh` 或 Dashboard）：description、homepage = `https://mote.flc.io`、topics（`markdown` `cloudflare-workers` `mcp` `mcp-server` `cli` `immutable` `r2`）

### 交付标准

1. `gh repo view` 显示完整元数据。

---

## 5. Phase 4 — 自托管指南

**状态**：已完成（2026-09-04 用户验收通过）

**目标**：开源用户可独立部署自己的 Mote 实例（开源用户的实际使用路径）。

### Checklist

- [x] `docs/self-hosting.md`（英文）：前置（Cloudflare 账号、自有域名 zone、Node ≥ 20、pnpm、wrangler login）→ fork/clone → 创建 R2 → 生成 token（`openssl rand -hex 32`）→ `wrangler secret put MOTE_TOKEN` → 修改两个 `wrangler.toml` 的 routes/zone_name 与 `VIEWER_BASE_URL` → deploy 两个 Worker → DNS 记录（AAAA `100::` proxied）→ 验证（health → 发布 → 页面）→ 配置 CLI/MCP 指向自有实例（`MOTE_API_URL`）
- [x] 中文副本 `docs/zh-CN/self-hosting.md`
- [x] README 的 Self-hosting 小节链接到该文档
- [x] 每一步命令可复制执行（域名等用占位符 `<your-domain>`）

### 交付标准

1. 文档步骤与真实部署流程一致（对照本仓库部署记录逐步核对）。 ✅（逐步对照本仓库 2026-09-03 生产部署记录）

### 交付备注（2026-09-04）

- `docs/self-hosting.md`（英文）+ `docs/zh-CN/self-hosting.md`（中文）：8 步流程（登录 → R2 → token → wrangler.toml routes → 部署 → DNS AAAA 100:: → 验证 → 客户端配置），含 staging 用 workers.dev 的替代路径与成本说明。
- 全仓文档死链扫描通过（唯一例外为 cli.md 中代码示例的演示路径）。
- Phase 3（仓库元数据）同步完成：description / homepage / 7 个 topics 已设置并经 `gh repo view` 验证。

---

## 6. Phase 5 — npm 发布

**状态**：进行中（2026-09-04 用户审核通过；交付完成，待用户验收）

**前置决策**：npm 包名（见「待决策」）。

### Checklist

- [x] 包名确定并验证可用性（`npm view <name>` 404 / scope 可注册）
- [x] `apps/cli/package.json`：`private: false`、version `0.1.0`、description、keywords、repository、homepage、license、engines、files（仅 dist）、`preferGlobal: true`
- [x] 发布（首次可手动 `npm publish --access public`；OIDC 自动化在 Phase 6）
- [x] `npm install -g <name>` 真实安装并 `mote --help` / 发布一篇文档验证
- [x] README 安装方式更新为 `npm install -g <name>` 为主、源码构建为辅

### 交付标准

1. 任意机器 `npm install -g <name>` 后可完成发布全流程。 ✅

### 交付备注（2026-09-04）

- 包名 `mote-cli@0.1.0` 已发布：<https://www.npmjs.com/package/mote-cli>（`npm view` 验证）。
- 依赖全部归入 devDependencies（esbuild 打包后 dist 自包含），发布物仅 dist + README + package.json（177.8 KB）。
- `prepublishOnly` 自动构建；`--version` 与包版本对齐 0.1.0。
- 验证链：tarball 本地安装发布 ✅ → registry 全新安装发布 ✅（`82bFuC9TfLrTGrxp` 页面 HTTP 200）。
- README 中英 + docs/cli.md 安装方式已切换为 `npm install -g mote-cli` 为主、源码构建折叠为辅。
- 发布过程 npm 需 OTP 二次验证（用户交互完成）；Phase 6 的 OIDC Trusted Publishing 将免除手动发布。

---

## 7. Phase 6 — CHANGELOG 与 v0.1.0 Release

**状态**：待审核

**前置条件**：Phase 0–5 全部完成。

### Checklist

- [ ] `CHANGELOG.md`：Keep a Changelog 格式 + 头部 semver 说明；回填 `0.1.0`（V1 + 远程 MCP + Skill + 开源化的完整特性清单）
- [ ] `.github/workflows/release.yml`：tag `v*` 触发 → CI 全量验证 → GitHub Release（附 CHANGELOG 节录）→ npm publish（Trusted Publishing/OIDC，不在仓库存 npm token）
- [ ] 打 `v0.1.0` tag，验证 Release 与 npm 版本产出
- [ ] README 加 npm version badge

### 交付标准

1. `v0.1.0` GitHub Release 存在，npm 包版本与 tag 一致，`npm view <name>` 可见。

---

## 8. 风险与应对

| 风险 | 影响 | 应对 |
|---|---|---|
| npm `@mote` scope 已被他人注册 | 首选包名不可用 | 备选 `mote-cli` / `@flc1125/mote`（发布前验证） |
| Trusted Publishing 配置复杂 | Release 流程阻塞 | 首次发布允许手动 `npm publish`，OIDC 流程后补或降级为手动 |
| Logo 生成效果不理想 | 阻塞 README | 多方向提示词迭代；最终可用极简文字标作为兜底 |
| 英译与实现漂移 | 文档误导 | README 命令全部实跑验证；自托管步骤对照真实部署记录 |

## 9. 执行原则

沿用计划 001 §15：阶段审核门禁、不擅自提交代码、最小正确版本。Phase 1（Logo）需用户生成图片，Phase 5/6 需用户在场配合（npm 登录/scope 注册/GitHub 设置）。
