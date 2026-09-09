# 部署操作手册

[English](../deployment.md)

本手册面向已接入 Cloudflare Workers Builds 的生产 Worker 维护者。新实例先完成[自托管配置](self-hosting.md)。

## 部署与发布触发方式

| 事件               | 执行方                                                  | 结果                                                                   |
| ------------------ | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| Pull request       | GitHub Actions CI                                       | lint、类型检查、测试、Worker dry-run 与 CLI 包验证                     |
| 推送 `main`        | GitHub Actions CI 与 Cloudflare Workers Builds 独立执行 | CI 检查提交；两个生产 Worker 分别构建并部署                            |
| 稳定 `vX.Y.Z` 标签 | GitHub Actions Release                                  | 通过 npm Trusted Publishing 发布已验证的 CLI 包，并创建 GitHub Release |
| 重试或回退         | 维护者在 Cloudflare Dashboard 操作                      | 明确选定的 Worker Build 或版本                                         |

合并到 `main` 后，生产部署可能早于该提交的 push CI 完成。合并前应要求 PR 检查通过；GitHub 检查成功本身不代表部署成功。标签不部署 Worker，也不等待 Worker 上线。旧 GitHub Deploy 与诊断工作流已移除，不要重跑历史部署 job。

## 生产域名切换

生产使用 `mote.pub`，`access-test` 继续使用 `mote-test.flc.io`。仓库中的目标白名单按环境选择 DNS zone；Worker 名称、生产 R2 数据、Access issuer 和应用 AUD 保持不变。

合并域名迁移前，准备 `mote.pub` 的代理 DNS 和有效边缘证书，确认两个 Workers Builds 凭据具有新 zone 的路由权限。协调合并与现有生产 Access 应用的三个目标替换：`mote.pub/api/mcp`、`mote.pub/api/v1/publish`、`mote.pub/api/auth/*`。保留发布者策略、Managed OAuth 和回环客户端设置。首页、文档和健康检查保持公开。

本次切换接受短暂停机，不实现双域名运行。两个 Worker 部署完成后，验证新域名登录、发布、文档资源和远程 MCP；客户端需[切换地址并重新授权](../authentication.md#moving-to-motepub)，服务端部署不会更新已安装 CLI 的默认值。旧域名跳转如有保留，也只是随时可能取消的临时便利。故障恢复不应依赖旧域名：回退不兼容的业务变更时，保留新路由和 hostname 配置。

## Workers Builds 预期设置

在每个 Worker 的**设置 → 构建**中核对以下生产设置。fork 必须换成自己的仓库、资源与身份配置。

| 设置                         | `mote-api`                                              | `mote-viewer`                                              |
| ---------------------------- | ------------------------------------------------------- | ---------------------------------------------------------- |
| Repository                   | `flc1125/mote`                                          | `flc1125/mote`                                             |
| Production branch            | `main`                                                  | `main`                                                     |
| Root directory               | `/`                                                     | `/`                                                        |
| Build command                | 留空                                                    | 留空                                                       |
| Deploy command               | `pnpm --filter @mote/api exec wrangler deploy --env=""` | `pnpm --filter @mote/viewer exec wrangler deploy --env=""` |
| Non-production branch builds | 关闭                                                    | 关闭                                                       |
| Build watch paths            | Include `*`；Exclude 留空                               | Include `*`；Exclude 留空                                  |
| Build cache                  | 开启                                                    | 开启                                                       |
| `NODE_VERSION`               | `24`                                                    | `24`                                                       |
| `PNPM_VERSION`               | `11.23.0`                                               | `11.23.0`                                                  |

根目录保持为 workspace 根目录以安装依赖；`pnpm --filter` 在选定应用目录执行 Wrangler。显式 `--env=""` 选择顶层生产配置。Wrangler 在部署阶段打包 TypeScript，因此无需独立 build command。监听所有路径可覆盖共享包、锁文件、根配置，也会触发纯文档提交的构建。

使用由 Cloudflare 管理的专用构建凭据。构建变量和 Secret 与 Worker 运行时配置分离。Worker 名称、Route、R2 binding 和非秘密运行时变量保存在 `apps/api/wrangler.toml`、`apps/viewer/wrangler.toml`，运行时 Secret 单独管理。Access Service Token 和 Mote 发布凭据不能用作 Cloudflare 构建凭据。参考 [Cloudflare 构建配置](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)。

两条生产连接都不部署 `access-test`。测试资源与本地探针保持独立。本方案不使用 Deploy Hook。

## 验收部署

1. 记录预期的完整 `main` SHA 及其 GitHub CI 结果。
2. 打开两个 Worker 的**部署**页面，分别记录 Build ID、来源 SHA、结果、新 Worker 版本及当前流量比例。两者都须匹配预期提交并承接预期生产流量。
3. 检查 `/health`、`/api/health`，再读取既有文档和图片，核对成功响应、缓存行为、安全响应头和未改变的图片字节。
4. 鉴权或发布相关变更还须验证匿名发布拒绝、OAuth 发现及适用的用户/机器授权发布。真实发布会生成永久公开 URL，只能使用明确获准的非敏感样本。例行纯文档上线可复用只读样本与已有鉴权基线。

两个 Worker 独立部署，短暂混合版本窗口属于预期情况；单个 Build 成功不能代表整组验收通过。跨 API/CLI/Viewer 的变更采用两阶段兼容：先同时支持新旧行为，待两个 Worker 与受支持客户端均迁移后再移除旧行为。服务端上线可能早于对应 CLI 版本发布。

## 构建失败、重试与回退

先检查受影响 Worker 的 Build 日志和当前部署，记录提交、Build ID、当前版本及目标恢复版本。报告不得包含凭据或私密文档 URL。

| 现象                   | 处理方式                                                    |
| ---------------------- | ----------------------------------------------------------- |
| 初始化、安装或构建失败 | 修复前置条件；读回当前版本，不仅凭失败 Build 推断线上状态。 |
| 仅一个 Worker 部署成功 | 核对两个版本及兼容性；没有共享事务或整组自动回退。          |
| 部署超时或结果不明确   | 重试前读回当前版本和流量；部署可能已经成功。                |
| Build 成功但冒烟失败   | 保持未验收，调查路由、运行时行为与边缘质询。                |
| 已有更新提交上线       | 重试前审核旧 Build 是否仍适合执行。                         |

维护者审核明确目标后，在 Cloudflare Dashboard 执行重试或回退。重试前重新核对当前命令、分支、变量和凭据，不能假定首次运行时的设置已被冻结。回退前选择已知兼容的 Worker 版本，并核对是否有待执行的自动构建会覆盖恢复结果；适合通过源码修正时，使用经审核的 PR。

Worker 回退不恢复 R2 数据或独立管理的 DNS、Access 策略及其他基础设施。分别核对 Route、binding、Secret 与预期状态。不要通过关闭 Access、开放备用发布主机或删除 R2 数据处理部署失败。恢复后重复健康检查、匿名发布拒绝及既有文档/图片检查；真实发布另行按授权验证。

## CLI Release 操作

推送稳定标签前，核对其指向预期提交，且与 `apps/cli/package.json` 版本和非空 Changelog 章节匹配。工作流验证并打包 CLI，核对 npm/tag/Release 身份，经 OIDC 发布 npm，再创建或核对 GitHub Release；不部署 Worker。

Release 失败时，检查原 Actions 运行并保留 manifest、tarball 和结果产物：`mote-release-<run-id>`、`mote-npm-result-<run-id>-<attempt>`、`mote-release-result-<run-id>-<attempt>`。发布结果不明确时先核对 npm/GitHub 再重跑；相同结果可复用，字节或身份冲突则停止。不要移动已发布标签、覆盖资产或添加长期 npm Token 来绕过错误。

## 退役旧部署资源

删除前，按当前工作流引用盘点旧 GitHub Environment 凭据、部署变量及 Actions 产物，记录准确目标并取得清理批准。删除 GitHub Secret 副本不等于撤销 Cloudflare Token；须先识别令牌及其他使用方，再单独执行撤销。

保留当前 Workers Builds 凭据、npm Trusted Publishing、GitHub Release 资产、当前 Worker 版本、R2 文档、Access 资源和故障调查仍需要的历史证据。退役 GitHub 部署自动化不代表可以删除测试 Worker 或测试 bucket。
