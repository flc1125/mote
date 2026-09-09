---
name: mote
description: Publish Markdown as an immutable web page with a shareable URL via Mote. Use when the user asks to publish or share a Markdown document or AI-generated content online. Local preview, reading, and editing alone do not require publishing.
---

# Mote — Markdown in, URL out

Mote 把 Markdown 发布为**不可变、不可枚举、浏览器可读**的在线页面，返回一个 URL。本 Skill 只指导何时以及如何使用 Mote；发布协议由 CLI / MCP 实现，**不要自己实现上传逻辑**。

## 何时使用

满足以下任一意图时使用 Mote：

- 「把这份 Markdown / 报告 / 文档分享出去」「发成网页 / 链接」
- 明确要求把设计文档、调研材料、会议记录或 README 变成在线链接
- 要求把你刚生成的报告/分析结果发布为网页

仅阅读、编辑 Markdown 或在本地浏览器预览时，不发布到 Mote。

**不要使用**：

- 内容包含密码、API Key、私钥等凭证，或企业机密——Mote 的 URL 即访问凭证，知道链接即可阅读，当前不提供用户侧删除入口
- 需要修改已发布内容——Mote 文档不可变；改内容必须重新发布得到**新 URL**

## 如何发布

先检查是否引用本地图片，再按已配置的工具选择路径。尊重用户指定的实例；已有自托管配置时，不强制切换到公共实例 `https://mote.pub`。

### 路径 A：MCP 工具（如果 `mote` MCP server 已连接）

- 内容在对话中且没有本地图片 → 调用 `publish_markdown`，传 `markdown`（可选 `name`，如 `report.md`）。本地和远程的这个工具都不收集本地图片，只保留远程图片 URL。
- 本地 Markdown 文件 → 仅本地 stdio 提供 `publish_markdown_file`，传 `path`（本地图片自动上传、按内容去重）；远程只有 `publish_markdown`，需要本地文件/图片时使用已配置的 CLI，不把路径传给远程工具。

### 路径 B：CLI（已安装且已配置鉴权时可用）

1. 已有文件直接发布原文件。对话内容没有本地图片时，可写入临时文件；有本地图片时，将 Markdown 与所需图片放入保持相对路径关系的临时目录，再通过 CLI 或本地 `publish_markdown_file` 发布。图片相对于 Markdown 文件所在目录解析，不是相对于终端工作目录；不要只把 Markdown 移到 `/tmp`。
2. 执行：

```bash
mote <file.md> --json
```

3. 解析 stdout 的 JSON：`{ "id": "...", "url": "..." }`

CLI 会自动处理 Markdown 和受支持 HTML 中的本地图片引用、路径校验、上传和内容去重；远程图片保留原 URL，不会下载打包。只有图片会随文档上传，指向其他本地 Markdown 文件的链接不会自动发布目标文件。

## 内容兼容性

- 支持常用 Markdown、表格、任务列表、脚注、GitHub 风格 Alerts，以及指定语言的代码高亮。
- 数学公式支持 TeX 子集；`mermaid` 代码块支持六类静态图表子集，每篇最多尝试渲染四个图表。无效、不支持或超出预算的内容可能显示为源码，发布成功不代表所有扩展语法均已渲染。
- HTML 仅允许安全子集，不执行脚本、MDX 或交互嵌入。不支持上传或直接嵌入原始 SVG；Mote 生成的图表 SVG 经独立清理，可以显示。
- 发布复杂公式或图表后，检查实际页面的公式、连线、标签和图片；未经检查，不声称渲染效果已验证。

需要详细语法或限制时，查看[兼容性说明](https://github.com/flc1125/mote/blob/main/docs/markdown.md)及[在线案例](https://mote.pub/PBqEnukxpQrkamSi)。自托管实例的支持范围取决于部署版本。

## 如何处理返回的 URL

- **原样把 URL 返回给用户**，不要截断、不要改写；
- 一句话说明即可，例如「已发布：<url>」；
- 页面设置了禁止搜索引擎索引的指令，这不是访问控制或绝对不被收录的保证；
- 如果用户后续要求「更新这个页面」：说明 Mote 不可变，重新发布会得到新 URL（旧 URL 内容不变）。

## 限制（发布前自检）

- Markdown ≤ 2 MB；单张图片 ≤ 10 MB；图片总数 ≤ 50；整个包 ≤ 20 MB
- 图片格式：png / jpeg / webp / gif / avif（**不支持 SVG**）
- 超出限制时如实告诉用户哪一项超限，不要自行删减内容

## 常见错误

- 登录失效：引导用户针对同一实例完成交互登录；用户已明确要求协助登录时，按授权范围继续。不因发布失败擅自发起浏览器登录、不读取其他客户端的凭据、不切换回旧 token。具体步骤见[鉴权说明](https://github.com/flc1125/mote/blob/main/docs/authentication.md)；
- `no publish token configured`：确认实例的鉴权模式。静态模式需要实例管理员提供 token；Access 实例需要 OAuth 登录或显式机器模式，不能把 Cloudflare 管理 API token 当发布密钥；不自行生成凭据；
- 机器模式：需要显式 `MOTE_AUTH_MODE=service` 及目标匹配的 `MOTE_SERVICE_API_URL`、`MOTE_SERVICE_CLIENT_ID`、`MOTE_SERVICE_CLIENT_SECRET`。缺失或无效时停止，不用用户登录态替代；
- 超时、5xx 或结果未知：不自动重试发布，可能已经生成不可变文档；先核对结果，再由用户决定是否重新发布；
- `asset not found: <path>`：Markdown 引用的本地图片不存在，提醒用户检查相对路径；
- `unsupported image type`：引用了 SVG 等不支持格式，建议用户转换为 png/webp 后重试。
