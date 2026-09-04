# Mote 开源化后续优化计划

> **计划编号**：004
> **日期**：2026-09-04
> **状态**：draft
> **上游计划**：`.docs/plans/003-2026-09-04-done-mote-open-source-plan.md`（v0.1.0 npm 首发、v0.1.1 自动化 Release）
> **架构基线**：`.docs/arcs/Mote：不可变 Markdown 在线发布服务方案.md`

本计划收纳**不阻塞首个开源版本发布**的锦上添花项，在计划 003 完成后启动。沿用计划 001 的阶段审核机制与执行原则。

## 阶段状态总览

| 阶段 | 状态 |
|---|---|
| Phase 0 — docs 英文化 | 待审核 |
| Phase 1 — 首页落地页 | 待审核 |
| Phase 2 — favicon 与品牌延伸 | 待审核 |
| Phase 3 — 收尾可选项 | 待审核 |

---

## 1. Phase 0 — docs 英文化

**状态**：待审核

**目标**：docs 与 README 同策略（英文为主 + 中文副本），降低国际用户与贡献者阅读成本。

### Checklist

- [ ] `docs/architecture.md` → 英文为主，中文移至 `docs/zh-CN/architecture.md`
- [ ] `docs/protocol.md` → 英文为主，中文移至 `docs/zh-CN/protocol.md`
- [ ] `docs/security.md` → 英文为主，中文移至 `docs/zh-CN/security.md`
- [ ] `docs/zh-CN/README.md` 索引页
- [ ] 所有互链更新（README、文档间互链）
- [ ] 维护规范：英文为准、中文副本可滞后（写入相关文档头部注明）

### 交付标准

1. 英文版信息完整度不低于中文版；无死链。

---

## 2. Phase 1 — 首页落地页

**状态**：待审核

**目标**：`https://mote.flc.io/` 从 404 变为静态介绍页。

**设计约束（自基线）**：不做 Document 列表/搜索/上传表单（§62 不触碰）；纯静态、无 JS、与文档页同一套设计语言（CSS 复用、dark mode）；不泄露任何文档信息。

### 设计方案（待用户确认）

1. **Hero**：Logo + `Mote — Markdown in, URL out.` + 一句话（把 Markdown 发布成不可变、不可枚举的在线页面）
2. **快速开始**：三步代码块（install → token → `mote README.md` → Published URL）
3. **特性**：Immutable / Capability URL / Fast（CDN 长缓存）/ No JS
4. **入口链接**：GitHub 仓库、文档（architecture/protocol/security/self-hosting）、MCP 端点说明
5. **页脚**：MIT License

### Checklist

- [ ] 用户确认设计方案（可改）
- [ ] Viewer 渲染静态首页（`GET /`）：内嵌 HTML（复用 PAGE_CSS 变量）、缓存与安全头与文档页一致
- [ ] 更新 Viewer 测试（`/` 原 404 断言改为首页断言；新增首页内容快照）
- [ ] 基线文档 §24 Viewer 路由补充 `/`
- [ ] 部署并生产验证

### 交付标准

1. `https://mote.flc.io/` 返回 200 介绍页（桌面/移动/暗色正常）；不含任何文档信息；其余路由行为不变。

---

## 3. Phase 2 — favicon 与品牌延伸

**状态**：待审核

**前置条件**：计划 003 Phase 1（Logo 资产已入库）。

### Checklist

- [ ] favicon 尺寸资产（32/16）从 Logo 产出
- [ ] Viewer 增加 `GET /favicon.ico`（静态内嵌资源，长缓存，安全头一致；文档页 `<link rel="icon">` 指向它）+ 测试
- [ ] 基线文档 §24 Viewer 路由补充 `/favicon.ico`
- [ ] 部署并生产验证（文档页浏览器标签显示图标）

### 交付标准

1. 浏览器访问文档页有 favicon；`/{document-id}` 路由行为不变。

---

## 4. Phase 3 — 收尾可选项

**状态**：待审核

### Checklist

- [ ] `.github/dependabot.yml`（npm 周更、github-actions 月更）
- [ ] README demo：发布页面截图或 asciinema 录屏
- [ ] `.github/FUNDING.yml`（如需要）
- [ ] 仓库 About 区 social preview 图（如需要）

### 交付标准

1. 所列项如保留则完成；删除则整阶段跳过。

---

## 5. 执行原则

沿用计划 001 §15：阶段审核门禁、不擅自提交代码、最小正确版本。本计划在计划 003（v0.1.0 发布）完成后启动；各阶段独立，可按需调整顺序或删项。
