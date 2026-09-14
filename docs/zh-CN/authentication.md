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
| `token`（原有模式）     | `token`                                 | 已有 Mote `MOTE_TOKEN`                                 |
| `cloudflare-access`     | `oauth`                                 | 交互式用户登录与 refresh token                         |
| `cloudflare-access`     | `service`                               | Access Service Token 的 Client ID **和** Client Secret |

不要将服务端取值 `cloudflare-access` 导出到 CLI 或 stdio 进程。Cloudflare 管理 API token 或 Wrangler 登录**不是** Mote 发布凭据。Access 模式不会回退到服务端的旧 Mote token。

## 用户登录：CLI 与本地 stdio

安装 CLI，将示例源地址替换为你已配置的实例：

```bash
npm install -g mote-cli
mote login --api https://mote.example.com --auth-mode oauth
mote auth status --json
mote report.md --json
mote auth logout --json
```

`mote login` 与 `mote auth login` 等价。登录自托管实例时明确传入 `--api`。登录成功后，先保存凭据，再保存默认 API 源地址；后续命令使用该地址，除非参数、环境变量或配置选择了其他目标。使用上方省略参数的命令前，先移除冲突的实例或鉴权模式覆盖项。`--api` 接收的是**源地址（origin）**，不是 `/api/mcp` 或 `/api/v1/publish`。OAuth 和 service 模式要求 HTTPS，每个目标的凭据分别保存。详见[配置选择规则](#配置选择规则)。

登录会显示授权 URL 并等待操作：按 `o` 在浏览器打开，按 `c` 复制，或按 `Ctrl+C` 取消。它不会自动打开浏览器。桌面操作不可用时，在运行 CLI 的同一台电脑上手动打开完整 URL。`--no-browser` 禁用快捷键，改用手动链接模式，但仍要求交互式终端。详见[终端交互说明](cli.md#鉴权命令)。登录不支持 `--json`；发布、状态查询和退出都不会发起浏览器登录。会话过期或被撤销后，需显式运行 `mote auth login --api <your-instance-origin>`。

除非传入 `--client-id`，否则登录会注册 public client。Mote CLI 的回调为 `http://127.0.0.1:<port>/oauth/callback`，可用 `--callback-port` 固定端口。在已验证的 Access 配置中，复用客户端但更改端口会被拒绝。保留注册时的完整 URI 和端口，或注册新客户端。不要给 CLI 复用 Codex 的回调。登录最多等待 10 分钟；失败或取消后，不要重放之前的授权 URL 或 code。

### 凭据存储与刷新

- 默认使用系统凭据库，已验证 macOS Keychain。本地 stdio 使用同一 Mote 凭据库；Codex 独立管理自己的凭据。
- 显式备用方式：`mote auth login --api https://mote.example.com --auth-mode oauth --credential-store file`。这是**明文存储**，不是加密存储。在 macOS 上，auth 目录必须归当前用户所有，权限为 `0700`，凭据文件权限为 `0600`。Keychain 失败时不会自动回退。更换存储后端前，先退出同一实例。
- 存储元数据和锁位于 `$XDG_CONFIG_HOME/mote/auth` 或 `~/.config/mote/auth`。即使秘密值在 Keychain 中，也必须保留完整元数据。不要复制、打印或提交该目录。
- CLI 与 stdio 使用按目标隔离的进程间锁串行刷新凭据。接近过期的凭据会在使用前刷新；中断或结果不明确的刷新不会重放，出现提示时重新登录。
- `auth status --offline --json` 返回缓存状态，**不代表**在线鉴权。在线查询可能刷新凭据，并验证 `/api/auth/session`。`authorizationSessionExpiresAt: null` 表示未知，不是无限期。Mote CLI 无法报告 Codex 的登录状态。

已验证的兼容性限于 macOS CLI/stdio 和 Codex CLI 0.153.4 的 app-server。其他 MCP 客户端以及 Linux/Windows 尚未验证。

## 配置选择规则

登录按 `--api` → `https://mote.pub` 选择目标，忽略环境变量、配置文件的 API 地址和已记住的实例。发布、状态查询和退出按参数 → 环境变量 → 配置文件 → 已记住的实例 → `https://mote.pub` 选择 API URL。登录会报告影响后续发布的环境变量/配置 API 冲突及显式鉴权模式。

静态 token 和显式鉴权模式按参数 → 环境变量 → 配置文件的优先级选择。登录将非秘密的默认源地址保存在 `auth/default-api.json`，不会改写 `config.json`。其他命令的一次性 `--api` 覆盖不会修改此偏好，退出也不会清除它。鉴权模式按以下规则选择，不能仅由是否提供凭据判断：

1. 显式 `--auth-mode`、`MOTE_AUTH_MODE` 或 `authMode` 优先。
2. 否则，目标已有 OAuth profile 时选择 OAuth，包括带有已退出标记的 profile。
3. 否则使用静态 token 模式。仅设置 Service Token 变量**不会**选择 service 模式。

`--token` 不会覆盖 OAuth 选择。退出会保留非秘密的模式选择标记，避免旧 `MOTE_TOKEN` 悄然重新生效。对于 token 模式服务端，仍可有意显式选择 token 模式。

只要三个 service 环境变量中**任意一个**已定义，环境变量三元组就会整体替换配置文件的 `serviceToken` 对象；缺失的环境变量值不会从文件补齐。

## 机器发布

管理员为任务创建 Access Service Token，将这个指定 token 加入仅绑定目标 Mote 应用的 **Service Auth** 策略。避免使用“Any service token”规则。通过运行环境的 secret 存储注入秘密值；以下值是占位符，不应将真实秘密值代入后粘贴到共享日志或 shell 历史中：

```bash
export MOTE_AUTH_MODE="service"
export MOTE_API_URL="https://mote.example.com"
export MOTE_SERVICE_API_URL="https://mote.example.com"
export MOTE_SERVICE_CLIENT_ID="<client-id>"
export MOTE_SERVICE_CLIENT_SECRET="<client-secret>"
mote auth status --json
mote report.md --json
```

规范化后的 service 源地址必须与发布源地址一致。Mote 每次请求都发送 ID/Secret 双凭据，不复用 Access Cookie，也不执行 OAuth 刷新或浏览器登录。凭据缺失、错误或已禁用时失败，不回退到用户凭据或静态 token。同样的配置适用于本地 stdio；已验证的远程 Codex 配置则使用 OAuth。

轮换时，创建替代 token，仅授权同一应用，更新任务的 secret 存储，验证身份并发布一份非敏感示例，再禁用旧 token，并分别确认已有进程和新进程均无法使用旧凭据。移除旧 secret 副本。怀疑泄露时，先立即禁用，再恢复。明确选择过期时间并设置续期提醒，不要从 OAuth 设置推断 Service Token 的有效期。参阅 [Cloudflare Service Tokens（英文）](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/)。

## 会话时长、退出与撤权

按部署风险选择 access token 和授权会话时长。长期 token 会延长泄露后的暴露窗口：被盗 token 在过期或有效撤销前仍可能可用。不要将 7 天 token 或 30 天会话视为通用默认值。

验证边界：生产撤权/恢复与回退，以及完整 7/30 天自然过期过程尚未验证。依赖这些机制前，先验证所选策略和恢复流程。

`mote auth logout` 只移除所选源地址的本地 Mote OAuth 秘密值，不会撤销 Cloudflare 授权、禁用 Service Token、移除静态 token 配置、退出 Codex 或删除已发布文档。`codex mcp logout <server>` 同样只作用于对应 Codex MCP 登录，而非 Codex 账号。管理员需单独撤销相应 Access 用户/应用会话或禁用机器 token。应用级撤权会影响该应用的其他用户，操作前核对范围。已发布的能力 URL 仍可读取。

每次发布都是不可变的，并创建新文档。超时、5xx 或结果不明确时，不要自动重试：写入可能已经成功。先确认结果，再决定是否重新发布。

## 迁移说明

- [迁移到 mote.pub](migrations.md#迁移到-motepub)——适用于仍指向旧默认域名的客户端。
- [将已有实例迁移到 Access](migrations.md#将已有实例迁移到-access)——发布者迁移、验证与回退。
