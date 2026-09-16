# 部署操作手册

[English](../deployment.md)

本手册面向已接入 Cloudflare Workers Builds 的生产 Worker 维护者。新实例先完成[自托管配置](self-hosting.md)。

## 部署与发布触发方式

| 事件               | 执行方                                                  | 结果                                                                   |
| ------------------ | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| Pull request       | GitHub Actions CI                                       | 文档检查、lint、类型检查、测试、Worker dry-run 与 CLI 包验证           |
| 推送 `main`        | GitHub Actions CI 与 Cloudflare Workers Builds 独立执行 | CI 检查提交；两个生产 Worker 分别构建并部署                            |
| 稳定 `vX.Y.Z` 标签 | GitHub Actions Release                                  | 通过 npm Trusted Publishing 发布已验证的 CLI 包，并创建 GitHub Release |
| 重试或回退         | 维护者在 Cloudflare Dashboard 操作                      | 明确选定的 Worker Build 或版本                                         |

合并到 `main` 后，生产部署可能早于该提交的 push CI 完成。合并前应要求 PR 检查通过；GitHub 检查成功本身不代表部署成功。标签不部署 Worker，也不等待 Worker 上线。旧 GitHub Deploy 与诊断工作流已移除，不要重跑历史部署 job。

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
4. 鉴权或发布相关变更还须验证匿名发布拒绝、OAuth 发现及适用的用户/机器授权发布。真实发布会创建新的不可变文档，知道 URL 的人即可阅读；使用明确获准的非敏感样本。例行纯文档上线可复用只读样本与已有鉴权基线。

两个 Worker 独立部署，短暂混合版本窗口属于预期情况；单个 Build 成功不能代表整组验收通过。跨 API/CLI/Viewer 的变更采用两阶段兼容：先同时支持新旧行为，待两个 Worker 与受支持客户端均迁移后再移除旧行为。服务端上线可能早于对应 CLI 版本发布。

## Markdown 发布检查清单

Markdown 语法或阅读交互变更使用以下清单。版本差异与升级说明集中在
[Changelog](../../CHANGELOG.md)；[Markdown 指南](markdown.md)描述完整的支持范围。

- [ ] 记录目标源码提交及通过的 CI 检查，包括文档、Worker dry-run 和 CLI 包验证。本地浏览器验收补充 CI；分别记录浏览器、视口与未验证的设备或交互。
- [ ] 按实际语法、预算和回退核对双语指南、支持矩阵及[可发布示例](markdown.md#可发布的验证示例)。新增能力需要独立说明时补充示例。
- [ ] 共享解析变化时，组合检查 CLI/本地 stdio MCP 与 Viewer。包含受影响结构中的图片，以及代码或纯文本定义里的伪图片；核对资产发现、去重和原始字节保真。仅升级 Viewer 无法补回此前发布时遗漏的资产。
- [ ] 验证折叠、标签页、代码复制、图片和脚注的代表性组合，检查键盘导航与焦点恢复、窄屏与深色、无 JavaScript 阅读、打印、深链接及 GET/HEAD CSP 一致性。部分覆盖应明确记录。
- [ ] 记录新增依赖或借用资源的来源、版本及许可证，并核对实际分发产物保留了所需声明。
- [ ] CLI 发布前确定版本，将相关 `Unreleased` 条目移入带日期的版本章节，并确保 CLI 包版本与稳定标签匹配。说明客户端/Viewer 的升级顺序及既有文档的呈现变化。
- [ ] 按[验收部署](#验收部署)分别核实两个 Worker 的上线结果，并记录发布验证所用的客户端版本。PR 合并、dry-run 通过或 CLI 发布，均不能证明生产版本与行为。

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

`npm publish` 后，工作流最多查询六次仓库；版本尚未出现时，依次等待 1、2、4、8、15 秒，
额外等待合计最多 30 秒，不含请求耗时。仅重试结果查询，不自动重复发布；仓库查询失败、
版本身份或安装包字节冲突会停止核实，不视为“版本尚未出现”。

若仍报 `NPM_OUTCOME_UNKNOWN`，检查运行摘要与结果产物中的 `npmPublish`：
`outcome: returned` 表示发布命令正常返回；`outcome: error` 会附上有限分类，
例如 `NPM_PUBLISH_E403` 或 `NPM_PUBLISH_ETIMEDOUT`，无法识别的错误仍使用通用码。
命令执行结果与发布核实结果分别记录，不输出 npm 原始日志或凭据。决定是否重跑前，
先对照仓库元数据与实际安装包字节。

## 退役旧部署资源

删除前，按当前工作流引用盘点旧 GitHub Environment 凭据、部署变量及 Actions 产物，记录准确目标并取得清理批准。删除 GitHub Secret 副本不等于撤销 Cloudflare Token；须先识别令牌及其他使用方，再单独执行撤销。

保留当前 Workers Builds 凭据、npm Trusted Publishing、GitHub Release 资产、当前 Worker 版本、R2 文档、Access 资源和故障调查仍需要的历史证据。退役 GitHub 部署自动化不代表可以删除测试 Worker 或测试 bucket。

## 迁移历史

<a id="生产域名切换"></a>

迁至 `mote.pub` 的过程见[生产域名切换记录](migrations.md#生产域名切换)。仍使用旧默认域名的客户端请按[迁移到 mote.pub](migrations.md#迁移到-motepub)更新地址并重新授权。
