# Mote 安全模型

> 本文说明 Mote 的权限模型、防护机制与运维红线。架构决策以基线文档为准。

## 1. Capability URL 权限模型

Mote 没有账号体系。访问权限模型为：

> **Anyone who knows the URL can access the document.**

```text
https://mote.flc.io/7Vk3mQ9x2NFaP4Ls
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

注意：robots.txt 只是君子协定，真正防枚举的是高熵 ID；真正防收录的是 noindex 头。

## 3. XSS 与内容安全

渲染管线（`@mote/renderer`）的多层防护：

1. **Raw HTML 关闭**（markdown-it `html: false`）：Markdown 中的任何 HTML 都只作为文本转义输出，永远不会成为 DOM 元素；
2. **危险协议拦截**：`javascript:`、`data:`、`vbscript:`、`file:`、协议相对 URL 不会成为链接 `href` 或图片 `src`（markdown-it 解析期拒绝 + 渲染期二次拦截）；
3. **页面零 JS**：渲染结果不包含任何脚本；
4. **严格 CSP**：

```text
default-src 'none'; img-src 'self' https: http:; style-src 'unsafe-inline';
object-src 'none'; frame-src 'none'; script-src 'none'; connect-src 'none';
base-uri 'none'; form-action 'none'; frame-ancestors 'none'
```

外加 `X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`。

这些行为由 `packages/renderer/src/security.test.ts` 中的基线 §57 测试用例锁定（`<script>`、`javascript:` 链接/图片、`<img onerror>` 等）。

## 4. 上传侧防护

| 机制       | 说明                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------- |
| 发布鉴权   | token 模式使用原生 HMAC 验证避免直接字符串比较；Access 模式验证受信签名断言，均先于正文读取 |
| 图片白名单 | 仅 png/jpeg/webp/gif/avif，**按 Magic Bytes 判定**，不信任扩展名                            |
| 排除 SVG   | SVG 可携带脚本（Active Content），V1 直接拒绝（415）                                        |
| 大小限额   | Markdown ≤ 2 MB、单图 ≤ 10 MB、包 ≤ 20 MB、≤ 50 个（413）                                   |
| 原子发布   | `manifest.json` 最后写入；写入中途失败不会产生半可见文档（Viewer 只认 manifest）            |
| ID 冲突    | Document ID 撞库时服务端内部重试，不对客户端暴露 409                                        |

CLI 侧：只读取 Markdown **实际引用**的文件（AST 解析，非正则），绝不扫描整个目录；逐文件做 存在 → regular file → MIME → 大小 → SHA-256 检查；同内容图片按哈希去重。

## 5. 发布鉴权与凭据管理

本检出的 Access 能力尚未发布，生产未切换。服务端 `MOTE_AUTH_MODE=token|cloudflare-access`，默认仍是 token，未知模式拒绝。客户端选择 `token|oauth|service`，不可与服务端枚举混用，详见[鉴权与迁移](authentication.md)。

Access 模式由 Cloudflare 校验 OAuth 或 Service Token 双凭据、注入 `Cf-Access-Jwt-Assertion`；Worker 仅接受配置的 HTTPS API 主机并校验签名、issuer、AUD、时间、类型与明确身份。用户为非空 sub；机器为合法 common_name 且空 sub，无歧义混用。旧 `MOTE_TOKEN`、邮箱头、Cookie、客户端自报身份及管理 API token 均不能绕过校验。公开阅读仍是 capability URL，不因发布者鉴权升级而要求读者登录。

### 兼容的静态 token 模式

`MOTE_TOKEN` 仅用于该模式：

- **生成**：≥ 256 bit 随机（如 `openssl rand -hex 32`）；
- **服务端存储**：`wrangler secret put MOTE_TOKEN`，绝不写入 `wrangler.toml`、代码或 Git；
- **本地存储**：环境变量 `MOTE_TOKEN`，或 `~/.config/mote/config.json`（权限建议 600）；
- **禁止**：写入仓库、写入日志、打印到 stdout、出现在错误消息中；
- **轮换**：重新生成后再次 `wrangler secret put` 即生效，旧 token 立即失效；记得同步更新本地配置。

### 远程 MCP（`POST /api/mcp`）

远程 MCP、REST 发布和 `/api/auth/session` 共用部署模式的鉴权入口，先鉴权再读取正文/访问存储：

- Token **只能出现在 Authorization 请求头**（HTTPS），绝不放进 URL query、工具参数或聊天上下文；
- 含静态 header 的客户端配置须按秘密保护；Access OAuth 交给客户端自己的凭据存储，不复制到聊天或另一客户端；
- 该端点无状态、无 session：每次请求独立鉴权，不签发任何会话凭证；
- Access 泄露时撤销相应用户/应用授权或禁用 Service Token；静态 token 泄露时轮换 Worker secret 并更新其客户端。应用级撤权会影响其他会话，必须先确认范围。

### 本地存储、会话与失效

Mote CLI/stdio 共享自身的按 API 目标、issuer/resource 绑定的凭据与进程间刷新锁，不读取 Codex Keychain。默认系统凭据库已验证 macOS Keychain；失败不会自动降级。`--credential-store file` 显式选择私有明文，目录 0700、文件 0600、当前用户所有；元数据和锁也不得擅自删除。Linux/Windows 未实机验收。

OAuth logout 删除本地秘密并保留无秘密选择标记，阻止旧 token 自动复活；不执行远端撤权、不删静态配置、不禁用 Service Token。机器模式须显式选择，三项环境配置缺一/目标不同即拒绝；每次发送双凭据，不复用 cookie。`status --offline` 不是在线有效性证明，授权会话到期时间未知时返回 null。

测试配置为 168h / 720h，长生命周期增加泄露暴露窗口，应按实例风险选择。短期自然到期续用及撤权恢复已实测；未等待 7/30 天。并发刷新串行，未知交换或发布结果不自动重放。退出、撤权、禁用均不删除已发布内容；URL 泄露仍需按阅读能力凭证泄露处理。

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

## 7. 贡献者秘钥规范

面向仓库贡献者的硬性规则（与本项目的运行时秘钥管理互补）：

- **严禁提交**：真实 token（任何环境/任何实例的）、`.dev.vars`、wrangler 本地配置（`~/Library/Preferences/.wrangler` 或 `~/.wrangler` 下内容）、`~/.config/mote/config.json`、任何 `*.pem` / 私钥；
- **测试凭证**：一律使用显式假 token，命名必须自证其假（如 `test-only-publish-token-not-a-secret`），不得使用任何真实凭证的片段；
- **示例文档**：文档与 issue 中引用 token 时使用占位符（如 `<your-token>`），即使是自己实例的真 token 也不要贴进 Git；
- **提交前自检**：`git diff --cached | grep -iE "token|secret|bearer"` 人工过一遍；
- **发现泄露**：如果自己或他人的真实凭证进入了 git 历史，立即按 §5 轮换该凭证，并按根目录 [SECURITY.md](../SECURITY.md) 的流程处理（历史改写无法挽回已泄露的凭证，轮换才是正解）。

漏洞报告政策见根目录 [SECURITY.md](../SECURITY.md)（GitHub Security Advisory 渠道、响应承诺）。

## 8. 滥用防护现状

当前依赖：高熵 ID（防枚举）+ Cloudflare Cache（吸收读流量）+ 所选发布鉴权模式（写侧门槛）+ 限额。Access 用户身份不等于文档所有权、ACL 或独立配额。

明确**未实现**（属 Future Work，出现实际需求再评估）：Rate Limiting、Turnstile、per-user quota、多用户 API Key。

## 9. 报告安全问题

如发现 Mote 的安全问题，请通过 GitHub Security Advisory 报告，勿公开披露细节。
