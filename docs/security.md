# Mote 安全模型

> 本文定义 Mote 的权限模型、防护机制与运维红线；整体设计见[架构](architecture.md)，部署鉴权见[鉴权指南](zh-CN/authentication.md)。

## 1. Capability URL 权限模型

Mote 没有账号体系。访问权限模型为：

> **Anyone who knows the URL can access the document.**

```text
https://mote.example.com/7Vk3mQ9x2NFaP4Ls
                         └── 这就是访问凭证本身
```

防枚举靠的是**高熵随机 ID**，而不是访问控制：

- Document ID：16 字符 Base58（`crypto.getRandomValues()`），约 **94 bit** 熵，约 10²⁸ 分之一的单次猜测概率；
- Malformed ID 与不存在的 ID 返回**完全相同的 404**（状态码、响应体、Content-Type），不泄露任何可枚举信息；
- 服务端不做任何形式的 Document 列表/索引/搜索。

### 适用场景

- 半私密分享（技术方案、设计文档、调研材料、会议记录）
- AI Agent 输出结果在线化
- 不希望被搜索引擎发现的文档

### 不适用场景

- 密码、API Key、私钥等凭证本身
- 企业高度机密资料
- 法规要求强认证的数据

如果文档 URL 可能被公开渠道（论坛、聊天记录归档）留存，应假定其内容最终可被访问。

## 2. 防泄露：Referrer 与搜索引擎

文档中允许引用第三方远程图片，浏览器加载时可能把文档 URL 作为 Referer 泄露给第三方。防护：

| 机制                     | 值                             |
| ------------------------ | ------------------------------ |
| `Referrer-Policy` 响应头 | `no-referrer`                  |
| `<meta name="referrer">` | `no-referrer`                  |
| `X-Robots-Tag` 响应头    | `noindex, nofollow, noarchive` |
| `<meta name="robots">`   | `noindex,nofollow,noarchive`   |
| `/robots.txt`            | `User-agent: * Disallow: /`    |

`robots.txt` 和 `noindex` 都依赖爬虫遵守，不能保证所有搜索引擎或爬虫不收录，也不是访问控制。高熵 ID 用于抵抗猜测；知道链接的人仍可读取和转发内容。

不可变指已存储的 Markdown 和已上传资产不可通过发布接口更新；Viewer 升级可以改变呈现效果，远程图片的内容与可用性由来源站点决定。文档持续可用还依赖实例与存储正常运行。

## 3. XSS 与内容安全

渲染管线（`@mote/renderer`）通过 HTML 净化、URL 校验和严格 CSP 阻止文档内容执行脚本。

### 原始 HTML 净化

Markdown 中的 HTML 经 `packages/renderer/src/sanitize.ts` 的白名单净化器处理，使用 htmlparser2 做词法解析。
只保留展示性标签及逐标签审核过的属性，例如 `p[align]`、`picture/source/img`、`details/summary` 和 `sub/sup/kbd`。
`script/iframe/svg/form/style` 等危险标签，以及 `on*`、`class`、`id` 等用户属性均被移除。
未配对标签在 token 流级别修正，保持输出嵌套正确。

### 危险 URL 拦截

`javascript:`、`data:`、`vbscript:`、`file:`、协议相对 URL 及其反斜杠变体均被拦截。
校验覆盖 Markdown 链接和图片，以及 HTML 的 `href`、`src` 与 `srcset`。

### 仅可信增强脚本

正文、公式和图表仍在服务端生成。页面只附带固定的第一方脚本，用户内容不能修改脚本：

| 脚本              | 插入条件               | 用途                                       |
| ----------------- | ---------------------- | ------------------------------------------ |
| `TOC_SCRIPT`      | 有目录、折叠区或标签组 | 目录、章节定位、标签切换、键盘与焦点管理   |
| `COPY_SCRIPT`     | 有可复制的代码围栏     | 用户激活按钮后复制代码文本                 |
| `IMAGE_SCRIPT`    | 有图片                 | 为符合条件的独立大图提供原生 dialog 查看器 |
| `FOOTNOTE_SCRIPT` | 有脚注引用             | 在原引用旁显示脚注预览                     |
| `THEME_SCRIPT`    | 每个文档页             | 应用和保存主题选择                         |
| `PAGE_SCRIPT`     | 每个文档页             | 复制页面链接、复制 Markdown 和返回顶部     |

导航脚本在链接到隐藏内容时，激活目标标签面板并展开包含目标的折叠区。
打印时，它展开折叠正文并显示全部标签面板。禁用 JavaScript 后，全部面板可见，静态目录锚点、代码标题和重点行仍可使用。

图片查看器复用已有安全 URL，查看原图仍受 `img-src` 限制，不使用外部脚本或 fetch。
用户文本通过 DOM 文本属性赋值，不拼入脚本或 HTML。

脚注预览仅用 DOM API 重建已净化正文的静态子集，不解析 HTML 字符串。
它不复制 ID、ID 引用、控件或运行时状态。复制过程受节点数、深度、文字与属性长度、图片数量限额约束。
复杂或超限内容保留原脚注跳转。

复制 Markdown 使用 HTML 中独立携带的 UTF-8 Base64 数据，不把用户原文拼入可执行脚本。
手动复制框通过 textarea 的 `value` 赋值，不解析原文 HTML。复制不发起网络请求，图片路径保持原样。

**持有文档 URL 的读者可以获取完整原文，包括 front matter、注释和未显示在正文中的内容。**
Base64 是传输编码，不是加密。发布前必须检查完整源文件，不能只检查渲染后的正文。

### 严格 CSP

```text
default-src 'none'; img-src 'self' https: http:; style-src 'unsafe-inline';
object-src 'none'; frame-src 'none'; script-src 'sha256-<TOC_SCRIPT 的 SHA-256 Base64>' 'sha256-<COPY_SCRIPT 的 SHA-256 Base64>' 'sha256-<IMAGE_SCRIPT 的 SHA-256 Base64>' 'sha256-<FOOTNOTE_SCRIPT 的 SHA-256 Base64>' 'sha256-<THEME_SCRIPT 的 SHA-256 Base64>' 'sha256-<PAGE_SCRIPT 的 SHA-256 Base64>'; connect-src 'none';
base-uri 'none'; form-action 'none'; frame-ancestors 'none'
```

Viewer 在首次请求时计算固定脚本集合的哈希并复用，页面按需插入脚本。
GET 与 HEAD 的策略一致，HEAD 不必读取正文。

`script-src` 不允许 `self`、`unsafe-inline`、`unsafe-eval` 或外部源。
首页的复制脚本使用独立哈希，不与文档页互相授权。
基础 `documentSecurityHeaders()` 禁止所有脚本；文档响应显式使用 `tocDocumentSecurityHeaders()` 授权固定脚本哈希。

外加 `X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`。

这些行为由 `packages/renderer/src/security.test.ts` 中的安全回归测试锁定（`<script>`、`javascript:` 链接/图片、`<img onerror>` 等）。

## 4. 上传侧防护

| 机制       | 说明                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------- |
| 发布鉴权   | token 模式使用原生 HMAC 验证避免直接字符串比较；Access 模式验证受信签名断言，均先于正文读取 |
| 图片白名单 | 仅 png/jpeg/webp/gif/avif，**按 Magic Bytes 判定**，不信任扩展名                            |
| 排除 SVG   | SVG 可携带脚本等主动内容，上传时直接拒绝（415）；生成的图表 SVG 使用独立净化器              |
| 大小限额   | Markdown ≤ 2 MiB、单图 ≤ 10 MiB、包 ≤ 20 MiB、上传资产 ≤ 50 个（413）                       |
| 原子发布   | `manifest.json` 最后写入；写入中途失败不会产生半可见文档（Viewer 只认 manifest）            |
| ID 冲突    | Document ID 撞库时服务端内部重试，不对客户端暴露 409                                        |

CLI 通过 Markdown AST 和 HTML tokenizer 收集图片引用，包括 `img src`、`img srcset` 与 `source srcset`。
已识别的 front matter 和数学源码中的图片语法不参与收集。CLI 只读取实际引用的文件，不扫描目录。

图片必须存在、为普通文件，并通过 MIME 检测。CLI 按 SHA-256 去重，上传前统一验证文档包限额。
1 MiB = 1,048,576 字节，精确限额见[协议](protocol.md#大小与数量限额)。

## 5. 发布鉴权与凭据管理

服务端 `MOTE_AUTH_MODE` 接受 `token` 或 `cloudflare-access`。服务端省略该配置时，使用 token 模式；未知模式被拒绝。
仓库生产部署配置显式选择 `cloudflare-access`。

客户端接受 `token`、`oauth` 或 `service`，不能使用服务端取值 `cloudflare-access`。
客户端的模式选择规则与服务端不同，详见[鉴权指南](zh-CN/authentication.md)。

Access 模式由 Cloudflare 校验 OAuth token，或 Service Token 的 Client ID 和 Client Secret，再注入 `Cf-Access-Jwt-Assertion`。
Worker 仅接受配置的 HTTPS API 主机，校验断言签名、issuer、AUD、时间、类型和身份。

- 用户身份必须具有非空 `sub`。
- 机器身份必须具有合法 `common_name` 和空 `sub`。
- 类型与身份不能含混或混用。

旧 `MOTE_TOKEN`、邮箱头、Cookie、客户端自报身份及管理 API token 均不能绕过校验。
公开阅读仍使用 capability URL，不因发布者鉴权升级而要求读者登录。

### 兼容的静态 token 模式

`MOTE_TOKEN` 仅用于该模式：

- **生成**：≥ 256 bit 随机（如 `openssl rand -hex 32`）；
- **服务端存储**：`wrangler secret put MOTE_TOKEN`，绝不写入 `wrangler.toml`、代码或 Git；
- **本地存储**：环境变量 `MOTE_TOKEN`，或 `~/.config/mote/config.json`（权限建议 600）；
- **禁止**：写入仓库、写入日志、打印到 stdout、出现在错误消息中；
- **轮换**：重新生成后再次 `wrangler secret put` 即生效，旧 token 立即失效；记得同步更新本地配置。

### 远程 MCP（`POST /api/mcp`）

远程 MCP、REST 发布和 `/api/auth/session` 共用部署模式的鉴权入口，先鉴权再读取正文/访问存储：

- 静态 token 和 OAuth token **只能出现在 Authorization 请求头**（HTTPS），绝不放进 URL query、工具参数或聊天上下文；
- Service Token 使用 `CF-Access-Client-Id` 和 `CF-Access-Client-Secret` 请求头，同样不得放进 URL、工具参数或聊天上下文；
- 含静态 header 的客户端配置须按秘密保护；Access OAuth 交给客户端自己的凭据存储，不复制到聊天或另一客户端；
- 该端点无状态、无 session：每次请求独立鉴权，不签发任何会话凭证；
- Access 泄露时撤销相应用户/应用授权或禁用 Service Token；静态 token 泄露时轮换 Worker secret 并更新其客户端。应用级撤权会影响其他会话，必须先确认范围。

### 本地存储、会话与失效

Mote CLI/stdio 共享按 API 目标、issuer 和 resource 绑定的凭据，以及进程间刷新锁。它们不读取 Codex Keychain。
默认系统凭据库已验证 macOS Keychain，失败时不会自动降级。Linux/Windows 未实机验收。

`--credential-store file` 显式选择私有明文文件。在已验证的 macOS 环境中，目录权限必须为 `0700`，文件权限为 `0600`，且归当前用户所有。
即使凭据保存在 Keychain 中，也不得擅自删除元数据和锁。

OAuth logout 删除本地凭据，但保留不含凭据的模式选择标记，阻止旧 token 自动生效。
它不撤销远程授权，不删除静态配置，也不禁用 Service Token。
机器模式须明确选择。service 配置必须包含实例源地址、Client ID 和 Client Secret，并与发布目标匹配。
配置不完整或目标不匹配时，拒绝发布。每次请求发送 Client ID 和 Client Secret，不复用 Cookie。

`status --offline` 不证明凭据在线有效。授权会话到期时间未知时返回 `null`。
并发刷新使用锁串行执行，结果未知的凭据交换或发布不会自动重放。发布结果未知时，按 [CLI 排错步骤](zh-CN/cli.md#发布结果未知)处理。

较长有效期会延长被盗凭据可能仍可使用的时间。按实例风险选择有效期，并验证撤权与恢复流程，验证范围见[会话与撤权](zh-CN/authentication.md#会话时长退出与撤权)。
退出、撤权和禁用凭据都不会删除已发布内容。文档 URL 泄露应按阅读凭证泄露处理。

`mote login` 的回环回调页（`http://127.0.0.1:<port>/oauth/callback`）是纯静态品牌页：不回显任何回调参数（state/code/error 都不会出现在 HTML 中），CSP 为 `default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'`——仅在默认全禁之上允许内联样式，并保持 `Cache-Control: no-store` 与 host/state 校验不变。

## 6. 日志红线

允许记录（结构化 JSON）：

```json
{
  "event": "publish",
  "documentId": "...",
  "markdownBytes": 48129,
  "assetCount": 3,
  "assetBytes": 1729291
}
```

**绝对禁止**记录：

- `MOTE_TOKEN`、Authorization/Cookie、Access 断言、OAuth code/access/refresh token、Service Token Secret、管理 API token 和完整授权回调 URL；
- Markdown 内容、资产内容；
- 完整 Secret URL 到第三方日志系统（Document ID 仅可用于排错，接入第三方平台前需重新评估敏感等级）。

<a id="7-贡献者秘钥规范"></a>

## 7. 贡献者凭据保护规范

以下规则适用于仓库贡献者，与运行时凭据管理要求相互补充：

- **严禁提交**：真实 token（任何环境/任何实例的）、`.dev.vars`、wrangler 本地配置（`~/Library/Preferences/.wrangler` 或 `~/.wrangler` 下内容）、`~/.config/mote/config.json`、任何 `*.pem` / 私钥；
- **测试凭证**：一律使用显式假 token，命名必须自证其假（如 `test-only-publish-token-not-a-secret`），不得使用任何真实凭证的片段；
- **示例文档**：文档与 issue 中引用 token 时使用占位符（如 `<your-token>`），即使是自己实例的真 token 也不要贴进 Git；
- **提交前自检**：`git diff --cached | grep -iE "token|secret|bearer"` 人工过一遍；
- **发现泄露**：如果自己或他人的真实凭证进入了 git 历史，立即按 §5 轮换该凭证，并按根目录 [SECURITY.md](../SECURITY.md#中文) 的流程处理（历史改写无法挽回已泄露的凭证，轮换才是正解）。

漏洞报告政策见根目录 [SECURITY.md](../SECURITY.md#中文)（GitHub Security Advisory 渠道、响应承诺）。

## 8. 滥用防护现状

当前依赖：高熵 ID（防枚举）+ Cloudflare Cache（吸收读流量）+ 所选发布鉴权模式（写侧门槛）+ 限额。Access 用户身份不等于文档所有权、ACL 或独立配额。

明确**未实现**（属 Future Work，出现实际需求再评估）：Rate Limiting、Turnstile、per-user quota、多用户 API Key。

## 9. 报告安全问题

如发现 Mote 的安全问题，请通过 GitHub Security Advisory 报告，勿公开披露细节。
