# Mote 文档

[English](../README.md)

从终端或 AI Agent 发布 Markdown、运维自己的实例，或参与 Mote 开发。按你要完成的任务选择入口。

## 首次发布

- [发布第一篇文档](quick-start.md)——选择实例、登录并发布一个小型 Markdown 文件。
- [项目概览](../../README.zh-CN.md)——功能、示例与限额。
- [自托管](self-hosting.md)——没有可用实例时，部署自己的实例。

## 日常使用

- [CLI 参考](cli.md)——命令、配置、本地图片与脚本用法。
- [鉴权指南](authentication.md)——浏览器登录、凭据存储、Service Token 与实例选择。
- [MCP 指南（英文）](../mcp.md)——通过远程 HTTP 或本地 stdio 连接 Agent。
- [发布 Skill（英文）](../skill.md)——让 Agent 按指引使用 CLI 或 MCP 工具。
- [Markdown 兼容性](markdown.md)——支持的语法、图片与渲染预算。
- [示例文档（英文）](../examples/)——可阅读或发布到自己实例的源文件。

## 实例运维

- [自托管](self-hosting.md)——配置并部署 API 与 Viewer Worker。
- [部署操作手册](deployment.md)——Workers Builds、上线验证、恢复与 CLI Release。
- [迁移记录](migrations.md)——默认域名变更历史，以及将已有实例迁移到 Access 的步骤。
- [Changelog（英文）](../../CHANGELOG.md)——发布历史与各版本升级说明。

## 开发与原理

- [贡献指南（英文）](../../CONTRIBUTING.md)——仓库结构、本地开发与完整 CI 检查。
- [文档检查（英文）](../../CONTRIBUTING.md#documentation-checks)——通过 `pnpm docs:check` 离线校验链接、发布记录与上传限额。
- [架构](../architecture.md)——组件、存储与设计决策。
- [发布协议](../protocol.md)——请求格式、校验、错误与不可变提交。
- [安全模型](../security.md)——发布鉴权、能力 URL 与渲染防护。
- [漏洞报告政策](../../SECURITY.md#中文)——私下报告安全漏洞。

快速开始、CLI、鉴权、Markdown、自托管、部署与迁移指南均提供中英文版本，可通过页面顶部切换。MCP、Skill、贡献指南与发布历史等尚未翻译，入口已标注语言。
