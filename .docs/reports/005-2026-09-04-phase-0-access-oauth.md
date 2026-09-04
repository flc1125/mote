# 计划 005：Phase 0 验证记录

> 日期：2026-09-04（Asia/Shanghai）
> 计划：[Cloudflare Access 登录授权](../plans/005-2026-09-04-active-mote-cloudflare-access-oauth-plan.md)
> 状态：进行中；测试 Access 应用已创建，7 天 / 30 天已通过 API 写入和读回，尚未达到端到端阶段交付标准。
> 本轮起始代码：`5221822`，分支 `feat/cloudflare-access-oauth`，起始工作区干净。

## 1. 本轮结论与执行边界

用户已授权执行 Phase 0。目前完成本地条件盘点、依赖安装、官方资料核验、迁移前的生产只读基线及登录后的控制台检查；经用户确认，已保存单邮箱测试策略并通过 API 创建独立测试 Access 应用。独立 GET 读回确认原定 7 天 / 30 天及其他批准配置，详见 §10。续接检查已核实测试 DNS、Worker、R2 名称没有冲突，本地 Wrangler 未认证，部署授权待确认（§11）。这些测试资源尚未创建，未改动生产配置、发布测试文档或执行客户端 OAuth 登录。

当前证据不足以判定 Managed OAuth 满足全部目标。计划中的 10 项 Checklist 均包含尚未完成的账号或端到端验证，因此全部保持未勾选。Phase 1–5 未启动，提交与推送仍需分别授权。

用户补充确认：测试域名 `mote-oauth-test.flc.io`、资源前缀 `mote-oauth-test`，先以 Codex 为实测对象；准入邮箱已提供，不在公开文档写入明文。最初按尚未配置 Zero Trust / IdP 讨论 `mote-test` 名称；登录后的控制台检查已推翻“未配置”的假设，发现现存团队与登录源，详见 §8。其余客户端暂缓，不视为通过，也不自动变更原定阶段交付标准。

后续记录使用以下证据分类：

- **本地核实**：源码、配置、已安装版本或本机命令的结果。
- **官方资料**：平台文档说明，不代表当前账号可用或已经配置成功。
- **环境实测**：对指定环境的实际请求与结果，注明目标、时间和方法。
- **待确认 / 未验证**：缺少配置、账号、设备或实际观察，不计为通过。

## 2. Cloudflare 与本地执行条件

| 项目 | 当前证据 / 状态 | 后续需要 |
|---|---|---|
| Cloudflare 账号、Zero Trust team domain | 已登录 FLC 账号；实测已有 `flc1125.cloudflareaccess.com` 团队，用户已同意复用；Access 配置写入成功 | 不改名为 `mote-test`；端到端 OAuth 可用性、后续资源权限与费用条件仍需核验 |
| IdP 与允许用户 | 测试应用已关联精确单邮箱 Allow 策略；读回仅有 One-time PIN 的 IdP ID | 未修改现有 IdP 或放行全部用户；仍需真实登录验证 |
| Managed OAuth Beta | API 创建应用返回 201，GET 读回 `enabled: true`、`168h / 720h` | 控制台菜单不代表 API 上限；保存成功不等于实际签发、刷新和撤权通过 |
| 测试域名 | 用户已确认 `mote-oauth-test.flc.io`；控制台搜索没有匹配 DNS 记录，未创建 | 创建前复核，使用测试路径路由，不修改生产 DNS |
| 资源命名 | 已创建 `mote-oauth-test` 应用和 `mote-oauth-test-publisher` 策略；其他测试资源未创建 | 实际 ID 及清理边界见 §10；后续分别登记 API / Viewer Worker、R2 和 DNS |
| 命令行管理入口 | 初始 PATH 中未找到全局 `wrangler`；依赖安装后从包清单核实项目内 Wrangler 为 4.128.0；本轮由临时程序调用 Access API | 尚未完成 Wrangler 登录或部署；Access API 编辑权限不等于 Workers / R2 / DNS 权限 |
| Wrangler 本地凭据 | 初查的 3 个常见配置路径均不存在；续接执行项目内 Wrangler `whoami` 明确返回未认证 | 浏览器登录不等于 Wrangler 登录；新的部署凭据及权限待用户确认，未读取既有凭据内容 |
| 临时 Access API 凭据 | 经用户确认创建，仅限 FLC 账号的 Access 应用/策略编辑权限；API verify 显示有效，截至 `2026-09-04T23:59:59Z` | 本轮验证后进程已退出且未持久化凭据；此权限不包含 DNS、Workers 或 R2，不擅自扩大 |
| 项目依赖 | `pnpm install --frozen-lockfile` 重试成功，退出码 0，实际使用 11.23.0 | 未升级依赖或改锁文件；安装成功不等于构建、类型检查或测试通过 |
| 本机运行环境 | macOS 27.0、arm64、Node v25.9.0 | 不能代替 Node 20 或 Linux / Windows 验证 |

检查的 Wrangler 配置路径为 `~/.wrangler/config/default.toml`、`~/.config/.wrangler/config/default.toml`、`~/Library/Preferences/.wrangler/config/default.toml`；仅检查文件是否存在。

首次打开内置浏览器时停在 Cloudflare 登录页；随后用户自行完成登录。控制台检查与 API 操作均针对用户已确认范围；没有提取浏览器会话凭据、查看既有 API 密钥或代填 Cloudflare 登录表单。新建临时 API 凭据通过一次性显示页面移交至本机内存验证程序，不写入聊天、仓库或日志。

测试资源不得复用生产 `mote-api`、`mote-viewer` 或 `mote-documents`。本轮只新增测试 Access 应用、策略及已批准的一天期管理凭据；不以新增付费服务、宽泛邮箱规则或公网回调通配解决前置条件。

## 3. 架构与官方资料核验

### 本地代码

- `apps/api/src/auth.ts` 仅验证共享 Bearer token；`/api/auth/session` 尚未实现。将现有 API 直接放在 Access 后面，并不能自动成为完整的 OAuth 验证原型。
- `apps/api/wrangler.toml` 的路由为 `mote.flc.io/api/*`，Viewer 为 `mote.flc.io/*`。按这组 Worker 路由，`/.well-known/*` 会落到 Viewer；Access 启用后是否先行接管，必须在隔离环境观察，当前不能判定同域方案失败。
- `apps/api/src/mcp.ts` 先处理不支持的 HTTP 方法，再处理 POST 的鉴权。GET 405 不能作为 POST 鉴权正常、异常或绕过的证据。
- 原型需要验证 Access 签名断言并复用受控的发布链路；不能直接放行任意 `Cf-Access-Jwt-Assertion`，也不能把旧 token 模式的成功误记为 OAuth 成功。

### 官方资料，不是账号实测

1. Managed OAuth 提供授权码流程和动态注册配置；非浏览器认证挑战、resource 与精确回调要抓取实际结果。已有应用通过 API 更新时，应先读取并保留原配置，避免覆盖其他字段。本次创建的是新测试应用；7 天 / 30 天的账号接受与读回证据见 §10，实际签发仍待测。来源：[Managed OAuth](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/managed-oauth/)。
2. 客户端令牌是 opaque token，Worker 验证的是 Access 转发的签名身份断言；二者不可混用。来源：[Token format](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/managed-oauth/#token-format)。
3. Worker 必须验证断言；签发方使用 team domain，AUD 来自对应 Access 应用，JWKS 地址为 `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`。目前已取得测试应用 AUD，并无凭据读取公开 JWKS，但尚未取得真实身份断言进行 issuer / AUD / 签名端到端验证。来源：[Validate JWTs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)。

本轮通过 Context7 先解析 `/cloudflare/cloudflare-docs` 再查询，并核对官方页面。检索同时返回普通 Application session duration 的说明；它不等同于 `oauth_configuration.grant.session_duration` 的平台限制，不据此宣布 OAuth 30 天已受支持。Access Applications API 页面在本轮检索中因响应过大未能完整读取，未据此新增字段范围结论。

## 4. 生产只读基线

以下均为 2026-09-04 对 `https://mote.flc.io` 的单次、无凭据 GET 请求，使用 `Accept: application/json`、不跟随重定向、不发送 Cookie 或 Authorization、不调用发布工具。只记录状态码及必要响应头，不保存正文或 Cookie。

| 路径 | HTTP 状态 | Content-Type | WWW-Authenticate | 其他 |
|---|---|---|---|---|
| `/api/health` | 200 | `application/json; charset=utf-8` | 无 | — |
| `/health` | 200 | `application/json; charset=utf-8` | 无 | — |
| `/.well-known/oauth-authorization-server` | 404 | `text/plain; charset=utf-8` | 无 | — |
| `/.well-known/oauth-protected-resource` | 404 | `text/plain; charset=utf-8` | 无 | — |
| `/.well-known/oauth-protected-resource/api/mcp` | 404 | `text/plain; charset=utf-8` | 无 | — |
| `/api/mcp` | 405 | `application/json; charset=utf-8` | 无 | `Allow: POST` |

首次在受限沙箱内请求发生 `ENOTFOUND`；在获准的网络环境重新执行后得到上表结果。沙箱 DNS 错误不算服务故障。这里仅是迁移前基线，不是测试环境结果，也不能替代 OAuth、发布鉴权或历史文档阅读验收。

## 5. 客户端条件盘点

用户指定本轮先测 Codex，其余客户端暂缓。下表全部尚未完成本计划的真实 OAuth / MCP 验证；“本机可见”不代表具备目标账号能力。所有客户端的注册方式、实际回调 URI、resource、原生/桥接分类及刷新/撤权结果均待实测后填写。

| 目标 | 已核实的本地条件 | 未验证原因 / 待补条件 |
|---|---|---|
| Mote CLI — macOS | 当前源码无 `auth` 命令组；本机 macOS 27.0 / arm64 | 等待隔离环境及验证原型；不提前实现 Phase 2 |
| Mote CLI — Linux / Windows | 未提供对应测试环境 | 系统、版本及账号待确认；本机结果不能替代 |
| Mote 本地 MCP（stdio） | 现有实现仍依赖静态 token | 等待与 CLI 原型共享认证的隔离测试 |
| Cursor IDE / Agent | CLI 和应用版本 3.18.9，arm64 | 桌面账号能力待确认；云端入口另外验证 |
| Claude Code | `claude --version` 为 2.1.252 | 未连接测试 MCP，未发起登录 |
| Claude Desktop | `/Applications/Claude.app` 版本 1.24012.9 | 远程连接器与本地 stdio 分别待测 |
| Claude.ai | 未检查实际账号入口 | 用户确认账号与连接器权限 |
| ChatGPT | 本机应用版本 26.901.31953 | 安装应用不代表具备自定义写入工具权限；实际连接器入口待确认 |
| Codex CLI / Desktop / IDE | CLI 0.152.0；`mcp login --help` 支持 `auto / cimd / dcr` 注册选项 | 仅帮助输出核实，不代表 Access 支持所有注册方式；三个入口分别待测 |
| VS Code / GitHub Copilot | PATH 中无 `code`，常见应用目录未找到 VS Code | 其他安装位置与可用账号待用户确认，未安装新软件 |
| Gemini CLI | PATH 中无 `gemini` | 其他安装方式与可用账号待用户确认，未安装新软件 |

版本核验仅运行版本/帮助命令及读取应用版本元数据，没有读取客户端凭据库、创建连接器或改变现有 MCP 配置。Codex 帮助命令提示沙箱无法创建 PATH aliases，但正常返回上述版本和选项；Cursor 版本命令有 macOS codesign 诊断输出，未据此认定客户端不可用。

## 6. 后续验证顺序

1. 登录、准入邮箱、团队复用及 Access 保存的动作确认均已落实，不重复索取同一授权。测试应用、单邮箱策略和原定 7 天 / 30 天已保存并读回；不再受控制台时长菜单阻塞，也不能在后续编辑时用默认值覆盖 API 配置。无需在聊天或仓库提供密码、API token 或旧 `MOTE_TOKEN`。
2. 按已确认的测试域名和资源前缀，核验 DNS / Worker / R2 冲突、费用与部署权限；仅创建隔离资源并登记，不改生产或添加自动化部署。临时 Access 凭据不包含这些管理权限，若需新的授权、接受协议或订阅，先交由用户确认。
3. 用隔离原型取得认证挑战、资源元数据、授权服务器元数据、实际 issuer / AUD / JWKS 和回调证据。保存经筛选的结构与时间，不保存原始令牌、授权码、Cookie 或正文。
4. 在已通过 7 天 / 30 天配置写入与读回的基础上，继续验证实际签发结果；分别记录访问令牌刷新、会话失效、撤权与重新授权。短周期测试可以补充机制证据，但不能冒充自然经过 7 天 / 30 天的观测；若需长时间观察，先明确观察安排，不擅自创建监控任务。
5. 先以 Codex CLI 打通最小 OAuth 与 MCP 调用，再验证实际可用的 Codex Desktop / IDE 入口；填入操作系统、版本、账号能力、回调、注册方式、时间与结果。其余客户端按用户指令继续，暂缓项继续标记未验证，不自动缩小原定范围。
6. 汇总路径/resource、生命周期及兼容性证据，提交用户验收。尚有必要目标未验证时不宣布 Phase 0 通过，不进入 Phase 1。

## 7. 本轮验证与变更

- 本地检查及 6 个公开只读端点检查已执行，结果见上文。
- 未执行真实 OAuth 登录、刷新、撤权、MCP 工具调用或发布；已新增测试 Access 应用、策略及临时管理凭据，清理范围见 §10。测试 DNS、Worker、R2 尚未创建。
- 仓库只更新计划状态、验证记录和 Handoff；本机临时目录中的 API 验证程序不属于正式产品实现。生产源码、Worker 配置与依赖锁文件不变。
- 文档位于 `.prettierignore` 排除的 `.docs/`；本轮使用结构、相对链接及 `git diff --check` 校验，不声称完成仓库格式检查或测试套件。

## 8. 登录后的控制台核验（2026-09-04）

| 检查页面 | 实际观察 | 结论 / 边界 |
|---|---|---|
| FLC 账号主页 | 可见 `flc.io`、`mote-api` 和 `mote-viewer` | 当前账号包含本项目现有资源；没有进入生产 Worker 编辑 |
| Cloudflare One 概述 | 团队名称 `flc1125`，团队域 `flc1125.cloudflareaccess.com`；存在 1 个应用和隧道记录 | 不是全新 Zero Trust 环境，不能直接按原拟议名称改名或重新初始化 |
| 身份提供程序集成 | 列表有 One-time PIN 与 Cloudflare 两种登录源 | 无需为了测试新建或修改全局 IdP；具体登录成功仍需验证 |
| Access 应用列表 | 仅 1 个其他用途的应用，没有 `mote-oauth-test` | 当次列表未见同名 Access 应用；DNS / Worker / R2 名称冲突尚未核验，不展开无关应用策略 |
| 新建自托管应用 → 其他设置 | “托管 OAuth”标为 Beta；展开后有 localhost、loopback、回调 URI、授权会话与访问令牌时长字段 | 仅打开并展开未填写、未保存的表单；没有切换 OAuth 开关或点击创建 |

首次只读观察时，OAuth 表单提示访问令牌受剩余授权有效期约束，但尚未填写目标参数。后续获确认后的填写结果见 §9；仍没有令牌响应或生命周期实测。

用户随后已同意保留并复用现有团队，仅创建独立的 Mote 测试应用和资源；不将这个同意扩大为允许修改其他既有配置，也不把首次开通步骤套用于已有团队。

## 9. 测试策略保存与 OAuth 时长阻点（2026-09-04）

本节保留 API 创建之前的控制台观察；时长阻点随后已通过 API 验证澄清，当前结果以 §10 为准。

用户已明确回复“确认”，同意保存并启用已列明的测试应用、单邮箱策略、仅本机回调及 7 天 / 30 天目标。已点击“保存策略”，表单返回策略 ID；未点击“创建应用”。

| 项目 | 当前内容与状态 |
|---|---|
| 团队 | 复用 `flc1125.cloudflareaccess.com`，保持既有配置 |
| 应用名称 | `mote-oauth-test`，未创建的草稿，无应用 ID / AUD |
| 保护目标 | `mote-oauth-test.flc.io/api/mcp`、`mote-oauth-test.flc.io/api/v1/publish`、`mote-oauth-test.flc.io/api/auth/*` |
| 登录源 | 在新应用草稿中关闭“接受所有可用的标识提供程序”，仅选择 One-time PIN；不修改全局 IdP |
| 策略名称与动作 | `mote-oauth-test-publisher`，Allow，已保存；ID `722cc89f-5015-4b10-9773-a2e7105833fb` |
| 包含规则 | 精确邮箱匹配，仅用户提供的一个邮箱；明文仅填入用户指定的 Cloudflare 页面，不写入此公开文档 |
| 策略会话 | 保持随应用会话，不覆盖全局 MFA，不新增 Bypass 或 Service Auth |

随后在应用草稿中开启 Managed OAuth，观察结果如下：

| OAuth 字段 | 控制台实测 | 结论 |
|---|---|---|
| 允许 localhost / loopback 客户端 | 两个开关均为开；没有添加公网重定向 URI | 仅草稿配置，未注册任何 OAuth 客户端 |
| 授权会话持续时间 | 菜单包含 `1 week`、`2 weeks`、`1 month`；输入 `720h` 显示“没有有效选项”，随后在草稿选中 `1 month` | 未知 `1 month` 对应的精确小时数；不能宣称 30 天配置已被接受 |
| 访问令牌有效期 | 默认以及 10 / 15 / 20 / 30 分钟、1 / 2 / 6 / 12 / 24 小时；没有 7 天，输入 `168h` 显示“没有有效选项” | 只能确认控制台无法选择 7 天，尚未取得 API 拒绝或接受的证据 |
| 表单留存状态 | 已清除搜索文字；访问令牌仍为“默认”，应用未创建 | 不能直接提交该草稿，否则不符合已批准的 7 天目标 |

通过 find-docs 重新解析 Cloudflare 文档并查询 Managed OAuth 时长，官方示例仅给出字符串形式的 `access_token_lifetime` 与 `session_duration`，没有提供 7 天支持或 API 上限证据。普通 Application session duration 的“最多一个月”不用于推断这两个 OAuth 字段。来源：[Managed OAuth](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/managed-oauth/)。

当时暂停创建应用，保留 7 天 / 30 天目标并请求 API 管理授权；没有擅自选择较短时长、放宽回调或改用其他架构。随后用户批准并完成的 API 验证见 §10。

**当时资源边界**：当时仅新增上述测试策略，尚未关联到生效的测试应用。API 验证后的资源登记与清理边界见 §10；没有生产资源需要恢复。

**本地依赖准备**：系统入口 pnpm 11.2.2 根据项目设置成功切换到 11.23.0。首次安装因 npm registry 的 `ECONNRESET` 与慢下载而中断（退出码 130）；按 `pnpm install --frozen-lockfile` 重试后成功，日志显示 268 个包已添加、安装脚本完成，退出码 0。依赖清单、锁文件及生产代码均未修改；未据此宣称构建、类型检查或测试通过。

安装后的版本复核另遇到受限环境中的 pnpm `fetch failed`，已中断该检查（退出码 130）；这不推翻前述安装成功结果，也不能记为 Wrangler 版本命令通过。改从已安装的包清单核实 Wrangler 4.128.0。失败检查产生的本地 `.pnpm-store` 已移到系统临时目录保留，未加入仓库；未修改用户的全局 pnpm 配置。文档相对链接、邮箱隐私、57 项 Checklist 未误勾选及 `git diff --check` 检查通过。

## 10. API 创建与独立读回（2026-09-04）

### 已批准的临时管理授权

用户明确批准创建仅限当前账号、一天有效的 Access 应用/策略编辑 API 凭据。实际权限摘要仅有 FLC 账号的“访问：应用和策略—编辑”，没有其他账号、区域、DNS、Workers、R2 或全局密钥权限。

| 项目 | 实际结果 |
|---|---|
| 名称 | `mote-oauth-test-phase0-access-20260904` |
| API token ID（非凭据值） | `c1ceb20a6f0a8f2d8772eed514cb5578` |
| `/user/tokens/verify` | `active`，2026-09-04 23:24:25 北京时间核验 |
| `not_before` | `2026-09-04T00:00:00Z` |
| `expires_on` | `2026-09-04T23:59:59Z`，即北京时间 9 月 5 日 07:59:59 |
| 生命周期边界 | 配置窗口不超过一天；从实际创建时刻起的剩余可用时间不足 24 小时，不宣称完整 24 小时后才过期 |
| 凭据处理 | 仅通过一次性显示页移交本机回环验证程序；不输出令牌值、不写文件或命令参数；验证结束清空变量并退出进程，退出码 0 |

控制台日期选择器将所选结束日包含在有效期内，摘要日期可能比所选日期晚一天；已在创建前收紧至摘要 9 月 4 日至 5 日，并用 API 返回的 UTC 时间核实。未修改或使用任何既有 API 令牌。

权限与 TTL 的官方说明见 [Create API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)。临时令牌尚未主动撤销，将按上述期限失效；本机没有保留可供后续命令重用的凭据。

### 测试应用创建与读回

创建前通过 API 列表核实没有同名或相同测试主机名的 Access 应用。随后仅发出一次创建请求，不自动重试写入：

- 2026-09-04 23:25:10 北京时间：`POST /accounts/{account_id}/access/apps` 返回 **HTTP 201**。
- 2026-09-04 23:25:12 北京时间：独立 `GET /accounts/{account_id}/access/apps/{app_id}` 返回成功，以下字段与批准配置一致。
- 控制台应用列表随后显示新应用及关联的测试策略；旧未保存草稿已离开，不能再次提交生成重复应用。

| 字段 | API 读回值 |
|---|---|
| 应用名称 / 类型 | `mote-oauth-test` / `self_hosted` |
| 应用 ID | `4c2df629-1c20-4ebc-a740-eb37f057a4bc` |
| AUD | `67f852eaf06730f1a47b30b8fc2594df66d9e09a9d51b44b48ff932808831853` |
| 保护目标 | `mote-oauth-test.flc.io/api/mcp`、`mote-oauth-test.flc.io/api/v1/publish`、`mote-oauth-test.flc.io/api/auth/*` |
| 策略 | `mote-oauth-test-publisher`，ID `722cc89f-5015-4b10-9773-a2e7105833fb`；Allow，优先级 1，仅一个 email 包含规则 |
| 允许的 IdP | 仅 One-time PIN，ID `8ef21911-2386-457b-abd9-80174e39b8b2` |
| 直接 IdP 跳转 / WARP 登录 | `auto_redirect_to_identity: true` / `allow_authenticate_via_warp: false` |
| 普通应用会话 | `24h`，不是 OAuth 授权会话时长 |
| Managed OAuth | `enabled: true` |
| 访问令牌有效期 | `grant.access_token_lifetime: "168h"`，即 7 天 |
| OAuth 授权会话 | `grant.session_duration: "720h"`，即精确 30 天 |
| 动态客户端注册 | `enabled: true`；localhost / loopback 均允许；`allowed_uris: []`，没有公网回调通配 |

创建结构使用当前官方 SDK 的 `destinations: [{type: "public", uri: "..."}]`，关联已有策略 ID，不重建策略或触碰既有应用。字段依据：[Cloudflare 官方 SDK](https://github.com/cloudflare/cloudflare-typescript/blob/main/src/resources/zero-trust/access/applications/applications.ts)、[Managed OAuth](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/managed-oauth/)。

对已脱敏的读回结果执行断言，已通过：应用 ID、7 天 / 30 天、OAuth 开关、三个精确路径、单一 IdP、单邮箱 Allow 策略、本机回调和临时凭据过期时间。首次在受限沙箱连接本机验证端口出现 `EPERM`；获准后检查通过，不算 API 功能失败。

### JWKS 与证据边界

无凭据 GET `https://flc1125.cloudflareaccess.com/cdn-cgi/access/certs` 返回 **HTTP 200**，JSON 中有 2 个 RSA / RS256 / sig 公钥。不记录原始公钥正文，也未取得或记录任何 OAuth 访问令牌、刷新令牌、授权码或 Access 身份断言。

结论：**当前账号已接受并保存 7 天 / 30 天配置**，不能再把控制台最高 24 小时的菜单当作 API 上限。但这不是实际签发、自动刷新、撤权传播或经过 7 天 / 30 天后的观测结果；Codex OAuth / MCP 端到端验证尚未开始。JWT 预期 issuer 基于团队域，仍需真实断言核验；已取得 AUD 和可访问的 JWKS 不等于签名验证已通过。

### 当前资源与后续清理范围

已新增的云端对象只有上表的测试 Access 应用、单邮箱策略和短期管理令牌。测试 DNS、API / Viewer Worker、R2 及发布文档均未创建；生产和其他已有资源没有改动。若终止测试，按上述精确 ID 核验引用后处理测试应用与策略；不按名称前缀批量清理，不操作其他令牌或生产 R2。

本机临时验证程序只监听 `127.0.0.1`，校验 Host、Origin、CSRF 值及请求大小；固定 API 目标和请求体，不提供任意请求代理。仅保存脱敏结果，结束时退出进程并关闭临时页面，浏览器保留 Access 应用列表。该程序不属于正式 CLI / Worker 实现，也没有创建部署自动化。

## 11. 部署前资源盘点（2026-09-04 续接）

本次从 `7a9b373`（`Document Access OAuth Phase 0 progress`）续接，分支仍为 `feat/cloudflare-access-oauth`，起始工作区干净。该提交是续接时观察到的既有状态，不是本轮执行的提交。

### 已核实

| 检查 | 证据 / 结果 |
|---|---|
| Workers 清单 | FLC 控制台显示全部 2 个应用：`mote-api`、`mote-viewer`；没有测试 Worker |
| R2 清单 | 控制台仅显示 `mote-documents`，分页不可继续；没有测试 bucket，未进入或读取生产对象 |
| DNS | `flc.io` DNS 搜索 `mote-oauth-test`，返回“没有 DNS 记录”；没有新增或修改记录 |
| Zone | `flc.io`，ID `817d37a603a2d3419a545b1a090c7595`；控制台现有路由仍为生产 API / Viewer 两条路径路由 |
| 费用状态 | Workers 与 R2 控制台均显示当前周期可计费使用量 `$0.00`；这是当前摘要，不是后续测试免费承诺，未升级套餐或接受新订阅 |
| Wrangler | 项目内命令实际输出 `4.128.0`；`whoami` 返回 `You are not authenticated`，未执行登录 |

Wrangler 同时提示沙箱不允许创建用户目录下的日志目录（`EPERM`），但仍返回上述版本与认证结果；未修改全局设置，也未把日志目录错误误判为 Cloudflare 账号故障。后续命令可将日志位置显式设为任务临时目录。

### 计划部署目标，尚未创建

| 类型 | 精确目标 | 约束 |
|---|---|---|
| API Worker | `mote-oauth-test-api` | 路由 `mote-oauth-test.flc.io/api/*`，验证签名断言后才进入发布管线 |
| Viewer Worker | `mote-oauth-test-viewer` | 路由 `mote-oauth-test.flc.io/*`，继续验证免登录阅读和发现端点的实际边界 |
| R2 bucket | `mote-oauth-test-documents` | 仅供测试 API / Viewer 使用，不绑定生产 bucket |
| DNS | `mote-oauth-test.flc.io` | 拟使用 proxied AAAA `100::` 占位，与生产相同的路径路由布局；不使用 Custom Domain 遮蔽 API 路由 |

项目内 Wrangler schema 已核对 `account_id`、`routes`、`workers_dev`、`preview_urls` 和 `r2_buckets` 字段。测试配置应固定账号与 Zone、关闭 `workers.dev` 和 Preview URL，并加入允许主机校验。当前仅完成准备设计，尚未编写隔离 Worker 原型、生成配置或执行构建/测试。

### 待确认的部署授权

上一枚临时 Access API 凭据不含部署权限，且未保留凭据值，不能直接复用。拟单独申请一天有效的测试部署 API 凭据：

- 仅 FLC 账号：Workers Scripts 编辑、Workers R2 Storage 编辑、Account Settings 读取。
- 仅 `flc.io` Zone：Workers Routes 编辑、DNS 编辑、Zone 读取。
- 不增加 KV、D1、Access、用户管理、创建其他 API token 或所有账号 / 所有 Zone 权限；若实际命令仍缺权限，记录具体失败后再确认，不自行扩大。

权限类别依据 [Cloudflare API token permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/) 与 [API token templates](https://developers.cloudflare.com/fundamentals/api/reference/template/) 核对。这组凭据按账号 / Zone 授权，**不是按 `mote-oauth-test` 名称隔离**：技术上可能操作同账号的其他 Worker / R2，以及该 Zone 的其他 DNS / 路由。只操作上表目标属于执行约束，不能冒充平台权限隔离；创建前需向用户说明并确认。凭据只供本机部署过程使用，不写入聊天、仓库、命令参数或日志。

本轮在新的管理授权前暂停云端写入；没有创建新凭据、测试资源或原型，没有部署、提交、推送，也没有启动 Phase 1–5。后续继续时先确认部署授权，实际创建前重新核对目标，不能把本次无冲突观察当作永久保证。
