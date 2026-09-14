# 迁移记录

[English](../migrations.md)

更新受域名或鉴权变更影响的已有安装时，参阅本指南。新用户从[首次发布](quick-start.md)或[自托管](self-hosting.md)开始。各版本的具体变更保留在 [Changelog（英文）](../../CHANGELOG.md)。

## 迁移到 mote.pub

**历史适用范围：**v0.5.0 将默认生产源地址从 `https://mote.flc.io` 改为 `https://mote.pub`。以下步骤适用于仍指向旧默认实例的客户端；自托管实例继续使用自己的源地址。

升级不会改写已保存的实例、显式环境变量或配置值。更新旧的 `MOTE_API_URL` 或配置 `apiUrl`，再登录新源地址：

```bash
mote login --api https://mote.pub --auth-mode oauth
mote auth status --api https://mote.pub --json
```

登录成功后会记住所选源地址，但不会改写显式环境变量或配置覆盖项。迁移时明确传入 `--api`；日常命令行为见[配置选择规则](authentication.md#配置选择规则)，各版本的登录变更见 [Changelog（英文）](../../CHANGELOG.md)。

- **远程 MCP：**将 endpoint 改为 `https://mote.pub/api/mcp`，并单独重新授权该连接。
- **本地 stdio：**升级源码时重新构建，更新固定的 API 源地址并重启进程。
- **机器客户端：**同时更新发布 API 源地址和 `MOTE_SERVICE_API_URL`（或 `serviceToken.apiUrl`）。Service Token 必须获准访问目标应用。
- **已有链接：**文档 ID 不变，使用 `https://mote.pub/<existing-id>`。旧域名的可用性不作保证。

凭据按源地址隔离。不要跨源地址复制凭据，也不要依赖重定向：OAuth 发现与发布会拒绝重定向。部署 Worker 不会更新已安装 CLI 的默认值。

## 生产域名切换

**历史适用范围：**本节记录 v0.5.0 相关的生产域名切换，不是日常部署步骤。当前上线与恢复流程见[部署操作手册](deployment.md)。

本次切换将生产迁至 `mote.pub`，`access-test` 保留在 `mote-test.flc.io`。目标白名单按环境选择 DNS zone；Worker 名称、生产 R2 数据、Access issuer 和应用 AUD 均保留。

当时的协调切换流程如下：

1. 准备 `mote.pub` 的代理 DNS 和有效边缘证书，确认两个 Workers Builds 凭据具有该 zone 的路由管理权限。
2. 协调路由/配置合并与现有生产 Access 应用的公开目标替换：`mote.pub/api/mcp`、`mote.pub/api/v1/publish`、`mote.pub/api/auth/*`。
3. 保留发布者策略、Managed OAuth 和回环客户端设置。首页、文档与健康检查保持公开。
4. 接受短暂停机，不实现双域名运行。验证两个 Worker 的部署、新源地址登录、发布、文档资产和远程 MCP。
5. 让客户端[切换源地址并重新授权](#迁移到-motepub)。

旧域名跳转即使存在也只是临时便利。恢复不能依赖旧域名：回退不兼容的业务变更时，保留新路由和 hostname 配置。两个 Worker 独立于 CLI Release 部署，发布标签本身不能证明切换成功。

## 将已有实例迁移到 Access

**适用范围：**Access 支持于 v0.2.0 引入。本流程用于运维者选择从 token 模式迁往 Access 的已有实例。token 模式仍可使用；新建 Access 实例可从[自托管](self-hosting.md#access-部署)开始。

1. 盘点所有发布者和 secret 来源，不记录秘密值。准备可用的 token 模式回退配置和维护窗口。
2. 按[自托管指南](self-hosting.md#access-部署)先在独立主机名上准备 Access。验证发现、CLI 登录/状态/发布/退出、stdio、Codex、机器凭据和匿名读取。
3. 单独取得生产 Access 策略与 Worker 切换批准。不要将仓库的测试账号、Client ID、AUD、路由或 bucket 复制到新部署。
4. 交互式发布者选择 OAuth，无人值守发布者选择 service 模式。从每个已迁移客户端移除旧 `MOTE_TOKEN`、`--token`、配置 `token` 和远程 MCP Bearer 设置。更新实际父进程的环境，必要时重启 stdio 客户端。
5. 验证旧凭据在 Access 模式下不能发布，匿名读取仍可用。在批准的回退窗口结束前，将回退 secret 保存在运维者控制的存储中；不要将其留作客户端的隐藏回退凭据。
6. 确认退役凭据的所有剩余使用者后再撤销。回退时先恢复可用的 token 模式 Worker，再移除 Access 保护并显式恢复客户端；始终避免无鉴权的发布窗口。

每次发布都是不可变的，并创建新文档。超时、5xx 或结果不明确时，不要自动重试：写入可能已经成功。先确认结果，再决定是否重新发布。
