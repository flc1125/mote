# 鉴权指南

[English](../authentication.md)

Mote 支持交互式发布的浏览器登录、自动化任务的 Service Token，以及 token 模式实例的静态 token。生产实例 `mote.pub` 使用 Cloudflare Access，仅允许获准的发布者。以下示例使用你自己的实例。

## 前置条件

OAuth 登录需要启用 Access 的 API，并提供 OAuth 发现和 `/api/auth/session`。CLI 与本地 stdio server 共享 Mote 凭据库；远程 MCP 客户端各自管理凭据。

安装 CLI、构建本地 stdio 和部署 Worker 是独立操作。安装 CLI 不会升级自托管 Viewer 或 API。发布历史和各版本升级步骤见 [Changelog（英文）](../../CHANGELOG.md)。

## 选择模式

服务端与客户端的配置取值不同：

| 服务端 `MOTE_AUTH_MODE` | 客户端 `--auth-mode` / `MOTE_AUTH_MODE` | 凭据                                                   |
| ----------------------- | --------------------------------------- | ------------------------------------------------------ |
| `token`                 | `token`                                 | 静态 Mote `MOTE_TOKEN`                                 |
| `cloudflare-access`     | `oauth`                                 | 交互式用户登录与 refresh token                         |
| `cloudflare-access`     | `service`                               | Access Service Token 的 Client ID **和** Client Secret |

不要将服务端取值 `cloudflare-access` 导出到 CLI 或 stdio 进程。Cloudflare 管理 API token 或 Wrangler 登录**不是** Mote 发布凭据。Access 模式不会回退到服务端的旧 Mote token。

## 用户登录：CLI 与本地 stdio

安装 CLI，将示例源地址替换为你的实例，并创建不含敏感信息的 `report.md`。
使用不带 `--api` 的命令前，先移除冲突的实例或鉴权模式设置，详见[配置选择规则](#配置选择规则)。

```bash
npm install -g mote-cli
mote login --api https://mote.example.com --auth-mode oauth
mote auth status --json
mote report.md --json
```

`mote login` 与 `mote auth login` 等价。登录自托管实例时，明确传入 `--api`。
使用**源地址（origin）**，例如 `https://mote.example.com`，不附加 `/api/mcp` 或 `/api/v1/publish`。
OAuth 和 service 模式要求 HTTPS。每个目标的凭据分别保存。

保存凭据后，登录会记住默认 API 源地址。后续命令使用该地址，除非参数、环境变量或配置选择了其他目标。

### 完成浏览器登录

登录会显示授权 URL 并等待操作，不会自动打开浏览器。

1. 按 `o` 打开链接，或按 `c` 复制。按 `Ctrl+C` 取消。
2. 如果这些操作失败，在运行 CLI 的同一台电脑上手动打开显示的 URL。
3. 完成浏览器授权。保持命令运行，直到终端确认凭据已保存。

`--no-browser` 禁用快捷键，改用手动链接模式，但仍要求交互式终端。
登录不支持 `--json`。详见[终端交互说明](cli.md#鉴权命令)。

发布、状态查询和退出都不会发起浏览器登录。会话过期或被撤销后，明确运行 `mote auth login --api <your-instance-origin>`。

除非传入 `--client-id`，否则登录会注册公开客户端（public client）。
Mote CLI 的回调为 `http://127.0.0.1:<port>/oauth/callback`，可用 `--callback-port` 固定端口。
在已验证的 Access 配置中，复用客户端但更改端口会被拒绝。

保留注册时的完整 URI 和端口，或注册新客户端。不要给 CLI 复用 Codex 的回调。
登录最多等待 10 分钟。失败或取消后，重新发起登录，不复用之前的授权 URL 或授权码。

### 凭据存储与刷新

- **系统存储：**默认凭据库已在 macOS Keychain 上验证。
  本地 stdio 使用同一 Mote 凭据库，Codex 独立管理自己的凭据。
- **文件存储：**登录时用 `--credential-store file` 明确选择。
  这是**明文存储**，不是加密存储。Keychain 失败时不会自动回退。
  在 macOS 上，auth 目录必须归当前用户所有，权限为 `0700`；凭据文件权限必须为 `0600`。
  更换存储后端前，先退出同一实例。
- **元数据与锁：**位于 `$XDG_CONFIG_HOME/mote/auth` 或 `~/.config/mote/auth`。
  即使凭据保存在 Keychain 中，也必须保留完整元数据。不要复制、打印或提交该目录。
- **刷新：**CLI 与 stdio 使用按目标隔离的进程间锁串行刷新凭据。
  接近过期的凭据会在使用前刷新。中断或结果不明确的刷新不会重放，出现提示时重新登录。
- **状态：**`mote auth status --offline --json` 返回缓存状态，**不代表**在线鉴权。
  在线查询可能刷新凭据，并验证 `/api/auth/session`。
  `authorizationSessionExpiresAt: null` 表示未知，不是无限期。Mote CLI 无法报告 Codex 的登录状态。

已验证的兼容性限于 macOS CLI/stdio 和 Codex CLI 0.153.4 的 app-server。其他 MCP 客户端以及 Linux/Windows 尚未验证。

## 配置选择规则

API URL 的选择顺序如下，优先级从高到低：

| 命令                 | 选择顺序                                                       |
| -------------------- | -------------------------------------------------------------- |
| 登录                 | `--api` → `https://mote.pub`                                   |
| 发布、状态查询和退出 | 参数 → 环境变量 → 配置文件 → 已记住的实例 → `https://mote.pub` |

登录忽略环境变量、配置文件的 API 地址和已记住的实例。
如果环境变量、配置文件或显式鉴权模式会影响后续发布，登录会报告这些设置。

静态 token 和显式鉴权模式按参数 → 环境变量 → 配置文件的优先级选择。
登录将不含凭据的默认源地址保存在 `auth/default-api.json`，不会改写 `config.json`。
单次命令使用 `--api` 不会修改此偏好，退出也不会清除它。

鉴权模式按以下规则选择，不能仅由是否提供凭据判断：

1. 显式 `--auth-mode`、`MOTE_AUTH_MODE` 或 `authMode` 优先。
2. 否则，目标已有 OAuth 配置记录（profile）时选择 OAuth，包括已退出的记录。
3. 否则使用静态 token 模式。仅设置 Service Token 变量**不会**选择 service 模式。

`--token` 不会覆盖 OAuth 选择。退出会保留不含凭据的模式选择标记，避免旧 `MOTE_TOKEN` 悄然重新生效。
对于 token 模式服务端，仍可明确选择 token 模式。

只要三个 service 环境变量中**任意一个**已定义，全部三个 service 配置项就会从环境变量读取。
它们会替换配置文件的 `serviceToken` 对象。缺失的环境变量值不会从文件补齐。

## 机器发布

管理员为任务创建 Access Service Token，并将这个指定 token 加入仅绑定目标 Mote 应用的 **Service Auth** 策略。
避免使用“Any service token”规则。

通过任务运行环境的凭据存储注入 Client Secret。以下值是占位符，不要把真实凭据粘贴到共享日志或 shell 历史中。

```bash
export MOTE_AUTH_MODE="service"
export MOTE_API_URL="https://mote.example.com"
export MOTE_SERVICE_API_URL="https://mote.example.com"
export MOTE_SERVICE_CLIENT_ID="<client-id>"
export MOTE_SERVICE_CLIENT_SECRET="<client-secret>"
mote auth status --json
mote report.md --json
```

规范化后的 service 源地址必须与发布源地址一致。Mote 每次请求都发送 Client ID 和 Client Secret。
它不复用 Access Cookie，不刷新 OAuth 凭据，也不发起浏览器登录。
凭据缺失、错误或已禁用时，发布失败，不回退到用户凭据或静态 token。

同样的配置适用于本地 stdio。已验证的远程 Codex 配置则使用 OAuth。

### 轮换 Service Token

怀疑凭据泄露时，先立即禁用受影响的 token，再开始恢复。计划内轮换按以下步骤执行：

1. 创建替代 Service Token。
2. 仅授权替代 token 访问同一个 Mote 应用。
3. 更新任务凭据存储中的凭据。
4. 验证任务身份。
5. 发布一份非敏感测试文档。
6. 禁用旧 token。
7. 分别确认已有进程和新进程不能再使用旧凭据发布。
8. 移除旧凭据副本。

选择过期时间并设置续期提醒。Service Token 的有效期与 OAuth 设置相互独立。
参阅 [Cloudflare Service Tokens（英文）](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/)。

## 会话时长、退出与撤权

按部署风险选择 access token 和授权会话时长。较长有效期会延长被盗 token 可能仍可使用的时间。
token 在过期或有效撤销前仍可能可用。不要将 7 天 token 或 30 天会话视为通用默认值。

验证边界：生产撤权/恢复与回退，以及完整 7/30 天自然过期过程尚未验证。依赖这些机制前，先验证所选策略和恢复流程。

`mote auth logout --json` 只移除所选源地址的本地 Mote OAuth 凭据，不会：

- 撤销 Cloudflare 授权或禁用 Service Token。
- 移除静态 token 配置或退出 Codex。
- 删除已发布文档。

`codex mcp logout <server>` 只作用于对应 Codex MCP 登录，而非 Codex 账号。
管理员需单独撤销相应 Access 用户或应用会话，或禁用机器 token。
应用级撤权会影响该应用的其他用户，操作前核对范围。已发布的能力 URL 仍可读取。

每次发布都会创建新的不可变文档。超时、5xx 或结果不明确时，不要自动重试，写入可能已经成功。
若未收到 URL，保留错误信息、发生时间和实例地址，供管理员核查。共享日志中不得包含凭据或私密文档 URL。
再次发布前，按 [发布结果未知](cli.md#发布结果未知)处理。

## 迁移说明

- [迁移到 mote.pub](migrations.md#迁移到-motepub)——适用于仍指向旧默认域名的客户端。
- [将已有实例迁移到 Access](migrations.md#将已有实例迁移到-access)——发布者迁移、验证与回退。
