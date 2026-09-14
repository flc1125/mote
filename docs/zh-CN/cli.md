# Mote CLI 参考

[English](../cli.md)

`mote` CLI 将本地 Markdown 文件发布到 Mote 实例，并输出文档 URL。

OAuth/service 鉴权需要启用 Access 的部署。配置、凭据安全存储与模式选择见[鉴权指南](authentication.md)，各版本升级说明见 [Changelog（英文）](../../CHANGELOG.md)。

```bash
mote <markdown-file>
# equivalent to
mote publish <markdown-file>
```

## 安装

```bash
npm install -g mote-cli
```

**从源码安装**（推荐开发环境：Node.js 24 与根 `package.json` 固定的 pnpm 版本）：

```bash
git clone https://github.com/flc1125/mote.git
cd mote
pnpm install --frozen-lockfile
pnpm --filter @mote/cli build
cd apps/cli && npm install -g .
```

验证：

```bash
mote --help
```

## 配置

选择顺序如下，优先级从高到低：

```text
登录 API URL：--api > 内置默认值（https://mote.pub）
其他命令 API URL：命令行参数 > 环境变量 > 配置文件 > 已记住的实例 > 默认值
其他配置：命令行参数 > 环境变量 > 配置文件 > 默认值
```

`mote login` 与 `mote auth login` 选择登录目标时，会忽略 `MOTE_API_URL`、配置 `apiUrl` 和已记住的实例。登录自托管实例时使用 `--api`。登录成功后会记住目标供后续命令使用；发布时，环境变量和配置覆盖项仍有更高优先级。如果这些覆盖项选择了不同的发布实例，登录会给出提示。

| 配置项         | 命令行参数           | 环境变量                     | 配置文件键                  | 默认值                                          |
| -------------- | -------------------- | ---------------------------- | --------------------------- | ----------------------------------------------- |
| API URL        | `--api <url>`        | `MOTE_API_URL`               | `apiUrl`                    | `https://mote.pub`                              |
| Token          | `--token <token>`    | `MOTE_TOKEN`                 | `token`                     | —                                               |
| 鉴权模式       | `--auth-mode <mode>` | `MOTE_AUTH_MODE`             | `authMode`                  | 已有 OAuth profile 时使用 OAuth，否则为 `token` |
| Service 目标   | —                    | `MOTE_SERVICE_API_URL`       | `serviceToken.apiUrl`       | —                                               |
| Service ID     | —                    | `MOTE_SERVICE_CLIENT_ID`     | `serviceToken.clientId`     | —                                               |
| Service secret | —                    | `MOTE_SERVICE_CLIENT_SECRET` | `serviceToken.clientSecret` | —                                               |

配置文件位于 `$XDG_CONFIG_HOME/mote/config.json`，通常为 `~/.config/mote/config.json`。以下示例用于自有 token 模式实例，请替换主机名；生产 `mote.pub` 要求 Access 鉴权：

```json
{
  "apiUrl": "https://mote.example.com",
  "authMode": "token",
  "token": "your-token"
}
```

建议权限为 `chmod 600 ~/.config/mote/config.json`。token 不会写入日志、stdout 或错误信息。

API 地址使用**源地址（origin）**，例如 `https://mote.example.com`，不带 endpoint 路径。客户端模式为 `token`、`oauth` 和 `service`；仅服务端使用的 `cloudflare-access` 在此无效。显式模式优先；未指定模式时，即使 OAuth profile 已退出，也会阻止回退到旧 token。定义任意 service 环境变量会整体替换 service 配置三元组。详见[配置选择规则](authentication.md#配置选择规则)。

## 鉴权命令

```bash
mote login --api https://mote.example.com --auth-mode oauth
mote auth status --api https://mote.example.com --json
mote auth status --api https://mote.example.com --offline --json
mote auth logout --api https://mote.example.com --json
```

`mote login` 是 `mote auth login` 的别名，两者均支持。凭据保存成功后，登录将 API 源地址记入 `auth/default-api.json`。之后可以运行不带 `--api` 的 `mote README.md`，除非环境变量或配置覆盖项选择了其他实例。显式鉴权模式仍生效；单次发布的 `--api` 不会修改默认值。退出会保留默认实例和 OAuth 选择标记，但移除所选目标的 OAuth 凭据。

登录要求交互式终端，并拒绝 `--json`。它显示完整授权 URL 后等待你操作，不自动打开浏览器。按 `o` 打开链接、`c` 复制，或 `Ctrl+C` 取消。打开或复制失败时，仍可手动使用该链接。`--no-browser` 选择无快捷键的手动链接模式；输出重定向到文件或 `TERM=dumb` 终端也使用手动模式，但 stdin 仍须为 TTY。在运行 CLI 的同一台电脑上打开链接，因为授权会返回其回环回调。保持命令运行，直到确认凭据已保存。

```text
Mote · Sign in

Instance  https://mote.example.com

Open this link to authorize:
<full authorization URL>

[o] Open browser   [c] Copy link   [Ctrl+C] Cancel

Waiting for authorization…
```

终端依次报告浏览器/剪贴板操作、验证、凭据存储，最后输出成功或错误。便于人阅读的状态使用带标签的字段；`--offline` 会明确标识未经验证的缓存状态。输出被重定向、`TERM=dumb` 或设置 `NO_COLOR` 时禁用颜色。即使终端很窄，URL 也不会被截断或手动换行。机器可读的 `--json` 结果与退出码保持不变。

`--client-id <public-id>` 复用已有注册；用 `--callback-port <port>` 保持注册时的确切回调端口。在已验证的 macOS 环境中，默认使用 Keychain；`--credential-store file` 显式选择私有明文文件，不会自动回退。详见[凭据存储与刷新](authentication.md#凭据存储与刷新)。

在线状态查询会验证身份，也可能刷新凭据；离线查询只报告缓存（`authenticated: null`）。状态 JSON 包含模式、来源、已知有效期、存储和身份，不含 token。退出 JSON 包含 `loggedOut: true` 和 `remoteRevoked: false`；只移除本地 OAuth 凭据，保留 OAuth 选择标记。静态/service 凭据与 Codex 凭据不受影响。

## 参数

| 参数            | 说明                                                   |
| --------------- | ------------------------------------------------------ |
| `--json`        | stdout 只输出 `{"id","url"}`，供 Agent、CI 和脚本使用  |
| `--token`       | 发布 token，覆盖 `MOTE_TOKEN`                          |
| `--auth-mode`   | 选择 `token`、`oauth` 或 `service`，不隐式回退         |
| `--api`         | API 基础地址，覆盖 `MOTE_API_URL`                      |
| `--no-assets`   | 跳过本地图片上传，保留原始 Markdown 引用               |
| `--verbose`     | 即使 stderr 被重定向也显示进度；与 `--json` 同用时忽略 |
| `-h, --help`    | 显示帮助                                               |
| `-v, --version` | 显示版本                                               |

终端中的可读输出如下。进度与摘要写入 stderr，最终结果写入 stdout：

```text
Scanning README.md…

Markdown  47.1 KB
Assets    3
Total     1.8 MB

Publishing…
Published:
https://mote.example.com/7Vk3mQ9x2NFaP4Ls
```

摘要在扫描与校验完成后、上传开始前显示。终端目前将二进制大小标为 KB/MB；本参考文档使用 KiB/MiB 明确字节值。`Assets` 按内容去重后计算本地图片数量，不含远程图片。`Total` 为 Markdown 与这些图片的字节数之和，不含 multipart 和 manifest 开销。`--no-assets` 显示 `0 (skipped)`，总量只计 Markdown。

stderr 不是终端时默认隐藏进度，可用 `--verbose` 将其写入日志。仅重定向 stdout 不会隐藏终端 stderr 上的进度。`--json` 抑制所有进度，即使同时使用 `--verbose`。扫描失败会输出错误，不显示内容摘要；上传失败不会输出 `Published`。

机器输出（`--json`，stdout 上唯一的内容）：

```json
{ "id": "7Vk3mQ9x2NFaP4Ls", "url": "https://mote.example.com/7Vk3mQ9x2NFaP4Ls" }
```

脚本用法：

```bash
URL=$(mote report.md --json | jq -r .url)
```

## 资产处理方式

CLI 解析 Markdown **AST**，收集本地图片引用，包括行内（`![a](./a.png)`）、引用式（`![a][img]`）、快捷引用（`![img]`）以及嵌套在链接中的图片。HTML tokenizer 还收集 `img src`、`img srcset` 和 `source srcset`，包括 `picture` 与 `details` 中的图片。

路径相对于 Markdown 文件所在目录解析，支持 Unicode、空格和百分号编码引用。识别出的 front matter 与数学公式源码不会产生图片引用。详见 [Markdown 图片与 HTML](markdown.md#图片与-html)。

每个引用文件必须存在、是普通文件，且通过**魔数字节**检测为支持的 MIME 类型。图片计算哈希后**按内容去重**：不同名称的同一图片只上传一次，保留每种引用写法。生成的文档包在上传前检查大小与数量限额。

- 远程 HTTP(S) URL 原样保留，不下载或打包。
- 只读取实际引用的文件，不扫描目录。
- 不支持的格式（如 SVG）会返回明确错误。
- 公开资产 URL 不包含原始文件名。

`--no-assets` 跳过本地图片收集与上传，但不移除或替换图片引用。这些本地图片通常无法供在线读者访问；需要图片时，使用远程 HTTP(S) 图片或上传本地资产。指向其他本地 Markdown 文件的链接不会发布那些文件。

上传限额使用二进制单位：Markdown ≤ 2 MiB、每张图片 ≤ 10 MiB、文档包 ≤ 20 MiB、上传资产最多 50 个。数量按 CLI 去重后计算，远程图片不计入。字节值与服务端错误见[发布协议](../protocol.md#大小与数量限额)。

发布在读取输入文档包前准备鉴权，且不会打开浏览器。成功发布时，`--json` 的 stdout 严格为 `{id,url}`；失败写入 stderr，并以退出码 1 结束。不要自动重试结果未知的写入。

## 故障排查

| 错误                              | 原因与处理                                                    |
| --------------------------------- | ------------------------------------------------------------- |
| `no publish token configured`     | 设置 `MOTE_TOKEN`、传入 `--token`，或在配置文件添加 `"token"` |
| `asset not found: <path>`         | 引用的图片不存在，修正相对路径                                |
| `unsupported image type`          | 引用了 SVG 或非图片文件，转换为 png/webp                      |
| `markdown is … bytes, limit is …` | Markdown 超过 2 MiB，拆分文档                                 |
| `UNAUTHORIZED`                    | token 错误或过期                                              |
| `BUNDLE_TOO_LARGE`                | 文档包超出大小限额，见 README 限额                            |

- **Login required / refresh pending：**明确运行 `mote auth login --api <your-instance-origin> --auth-mode oauth` 登录同一 API。不要删除元数据来重新启用旧 token。
- **Service mode requires matching variables：**设置全部三个 service 变量，显式选择 `service`，并匹配 API 源地址。不要把秘密值粘贴到问题报告中。
- **Keyring 或权限错误：**修复系统凭据库，或退出后显式选择私有文件后端；不会静默回退。
- **回调不匹配 / 端口被占用：**复用注册时的确切 URI 与可用固定端口，或注册新客户端。重新登录，不重放旧 code。
- **旧服务端的在线状态查询：**`/api/auth/session` 需要对应服务端实现；查询失败不能证明旧静态 token 发布功能失效。
