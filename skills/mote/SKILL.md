---
name: mote
description: Publish Markdown documents as immutable, unguessable web pages via Mote and get back a shareable URL. Use when the user wants to share, publish, or view a Markdown file, report, README, design doc, meeting notes, or any Markdown content as a web page/URL — including making AI-generated output readable in a browser.
---

# Mote — Markdown in, URL out

Mote 把 Markdown 发布为**不可变、不可枚举、浏览器可读**的在线页面，返回一个 URL。本 Skill 只指导何时以及如何使用 Mote；发布协议由 CLI / MCP 实现，**不要自己实现上传逻辑**。

## 何时使用

满足以下任一意图时使用 Mote：

- 「把这份 Markdown / 报告 / 文档分享出去」「发成网页 / 链接」
- 「让 XXX 能在浏览器里看」（设计文档、调研材料、会议记录、README）
- 把你刚生成的报告/分析结果变成一个可打开的页面

**不要使用**：

- 内容包含密码、API Key、私钥等凭证，或企业机密——Mote 的 URL 即访问凭证，知道链接即可阅读，且发布后**不可删除**（V1）
- 需要修改已发布内容——Mote 文档不可变；改内容必须重新发布得到**新 URL**

## 如何发布

按可用性选择路径（任一即可，结果相同）：

### 路径 A：MCP 工具（如果 `mote` MCP server 已连接）

- 内容在对话中（无本地文件）→ 调用 `publish_markdown`，传 `markdown`（可选 `name`，如 `report.md`）
- 本地 Markdown 文件 → 仅本地 stdio 提供 `publish_markdown_file`，传 `path`（本地图片自动上传、按内容去重）；远程只有 `publish_markdown`，需要本地文件/图片时使用已配置的 CLI，不把路径传给远程工具。

### 路径 B：CLI（已安装且已配置鉴权时可用）

1. 如果内容在对话中：先写入临时文件（如 `/tmp/mote-<timestamp>.md`）
2. 执行：

```bash
mote <file.md> --json
```

3. 解析 stdout 的 JSON：`{ "id": "...", "url": "..." }`

CLI 会自动处理：Markdown AST 解析、本地图片收集上传（`![](./images/x.png)` 形式）、远程图片保留、重复图片去重。

## 如何处理返回的 URL

- **原样把 URL 返回给用户**，不要截断、不要改写；
- 一句话说明即可，例如「已发布：<url>」；
- 用户可以立刻用浏览器打开；页面不会被搜索引擎收录；
- 如果用户后续要求「更新这个页面」：说明 Mote 不可变，重新发布会得到新 URL（旧 URL 内容不变）。

## 限制（发布前自检）

- Markdown ≤ 2 MB；单张图片 ≤ 10 MB；图片总数 ≤ 50；整个包 ≤ 20 MB
- 图片格式：png / jpeg / webp / gif / avif（**不支持 SVG**）
- 超出限制时如实告诉用户哪一项超限，不要自行删减内容

## 常见错误

- 登录失效 / `mote auth login` 提示：请用户在交互终端针对同一 `--api` 登录。仅当前支持 auth 的构建有此能力；不自动弹浏览器、不读取 Codex 等其他客户端的凭据、不切换回旧 token；
- `no publish token configured`：确认实例的鉴权模式。静态模式需要实例管理员提供 token；Access 实例需要 OAuth 登录或显式机器模式，不能把 Cloudflare 管理 API token 当发布密钥；不自行生成凭据；
- 机器模式：需要显式 `MOTE_AUTH_MODE=service` 及目标匹配的 `MOTE_SERVICE_API_URL`、`MOTE_SERVICE_CLIENT_ID`、`MOTE_SERVICE_CLIENT_SECRET`。缺失或无效时停止，不用用户登录态替代；
- 超时、5xx 或结果未知：不自动重试发布，可能已经生成不可变文档；先核对结果，再由用户决定是否重新发布；
- `asset not found: <path>`：Markdown 引用的本地图片不存在，提醒用户检查相对路径；
- `unsupported image type`：引用了 SVG 等不支持格式，建议用户转换为 png/webp 后重试。
