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

| 机制         | 说明                                                                                   |
| ------------ | -------------------------------------------------------------------------------------- |
| Bearer Token | `POST /api/v1/publish` 必须携带 `MOTE_TOKEN`；比较前先对两侧做 SHA-256，避免时序侧信道 |
| 图片白名单   | 仅 png/jpeg/webp/gif/avif，**按 Magic Bytes 判定**，不信任扩展名                       |
| 排除 SVG     | SVG 可携带脚本（Active Content），V1 直接拒绝（415）                                   |
| 大小限额     | Markdown ≤ 2 MB、单图 ≤ 10 MB、包 ≤ 20 MB、≤ 50 个（413）                              |
| 原子发布     | `manifest.json` 最后写入；写入中途失败不会产生半可见文档（Viewer 只认 manifest）       |
| ID 冲突      | Document ID 撞库时服务端内部重试，不对客户端暴露 409                                   |

CLI 侧：只读取 Markdown **实际引用**的文件（AST 解析，非正则），绝不扫描整个目录；逐文件做 存在 → regular file → MIME → 大小 → SHA-256 检查；同内容图片按哈希去重。

## 5. Token 管理

`MOTE_TOKEN` 是 V1 唯一的发布凭证：

- **生成**：≥ 256 bit 随机（如 `openssl rand -hex 32`）；
- **服务端存储**：`wrangler secret put MOTE_TOKEN`，绝不写入 `wrangler.toml`、代码或 Git；
- **本地存储**：环境变量 `MOTE_TOKEN`，或 `~/.config/mote/config.json`（权限建议 600）；
- **禁止**：写入仓库、写入日志、打印到 stdout、出现在错误消息中；
- **轮换**：重新生成后再次 `wrangler secret put` 即生效，旧 token 立即失效；记得同步更新本地配置。

### 远程 MCP（`POST /api/mcp`）

远程 MCP 端点与发布 API 共用同一个 Bearer Token 校验：

- Token **只能出现在 Authorization 请求头**（HTTPS），绝不放进 URL query、工具参数或聊天上下文；
- 配置 Claude 网页版 connector 或客户端 `.mcp.json` 时，header 值就是 token 本身——这些配置文件应视为凭证同等保护（不进 Git、不截图分享）；
- 该端点无状态、无 session：每次请求独立鉴权，不签发任何会话凭证；
- 泄露时的处置与上文一致：`wrangler secret put MOTE_TOKEN` 轮换，所有客户端配置同步更新。

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

- `MOTE_TOKEN` 及 Authorization 头；
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

V1 依赖：高熵 ID（防枚举）+ Cloudflare Cache（吸收读流量）+ Token（写侧门槛）+ 限额。

明确**未实现**（属 Future Work，出现实际需求再评估）：Rate Limiting、Turnstile、per-user quota、多用户 API Key。

## 9. 报告安全问题

如发现 Mote 的安全问题，请通过 GitHub Security Advisory 报告，勿公开披露细节。
