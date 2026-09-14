# 发布第一篇文档

[English](../quick-start.md)

本教程带你用 CLI 将本地 Markdown 文件发布为可在浏览器阅读的页面。需要 Node.js 20 或更新版本、npm、交互式终端，以及同一台电脑上的浏览器。无需检出仓库。

## 1. 选择实例

你需要获得向某个 Mote 实例发布的权限：

- **默认实例：**`https://mote.pub` 仅允许获准的发布者。继续前先向实例管理员确认权限；安装 CLI 不会授予发布权限。
- **自有实例：**向管理员索取 API 源地址（origin）和鉴权模式，或按[自托管指南](self-hosting.md)部署实例。

下文使用 Access 实例的浏览器登录。token 模式实例请参阅 [token 发布配置](self-hosting.md#8-配置客户端)；无人值守任务请使用[机器发布](authentication.md#机器发布)。

## 2. 安装 CLI

在终端运行：

```bash
npm install -g mote-cli
mote --version
```

第二条命令会输出已安装的 CLI 版本。如果找不到 `mote`，检查 npm 全局可执行文件目录是否在 `PATH` 中，再重新打开终端。

## 3. 创建文档

在你选择的工作目录中，用文本编辑器创建 `hello.md`：

```markdown
# Hello, Mote

This is my first published document.

- Written in **Markdown**
- Readable in a browser
```

以 UTF-8 保存。后续命令均在 `hello.md` 所在目录运行。使用你愿意分享的示例内容：任何知道发布后 URL 的人都能直接阅读，无需登录。

## 4. 登录

默认实例使用：

```bash
mote login --api https://mote.pub --auth-mode oauth
```

自有 Access 实例使用以下命令，并替换示例源地址：

```bash
mote login --api https://mote.example.com --auth-mode oauth
```

按你的实例选择其中一条命令。地址只包含 origin，不附加 `/api/mcp` 或 `/api/v1/publish`。

登录命令会显示授权 URL。按 `o` 打开，或在同一台电脑上手动打开该 URL。完成浏览器授权后，等待终端确认登录成功。凭据默认保存在系统凭据库；不可用时参阅[凭据存储与刷新](authentication.md#凭据存储与刷新)。

登录成功后会记住该实例，用于后续发布。如果登录输出提示环境变量或配置冲突，请先按[配置选择规则](authentication.md#配置选择规则)解决冲突。

向服务器验证已保存的登录：

```bash
mote auth status
```

确认输出的 API 是你选择的实例，且鉴权成功。

## 5. 发布

在 `hello.md` 所在目录运行：

```bash
mote hello.md
```

成功后，CLI 输出 `Published:` 和文档 URL。主机名属于你选择的实例，最后一段路径是新生成的文档 ID。

## 6. 打开页面

在浏览器打开返回的 URL，应能看到“Hello, Mote”标题和两个列表项。使用隐私窗口也能阅读，无需发布者登录。

你已发布第一篇文档。修改本地文件不会更新这个页面；再次发布会生成新 URL。页面可用性取决于实例与存储持续运行。

## 步骤失败时

| 现象                                   | 处理方式                                                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 浏览器授权被拒绝                       | 确认实例管理员已允许你的身份发布，参阅[用户登录](authentication.md#用户登录cli-与本地-stdio)。                 |
| 登录无法打开浏览器或保存凭据           | 在同一台电脑上打开显示的链接；参阅[登录与凭据排错](cli.md#故障排查)。                                          |
| 状态查询或发布选择了其他实例或鉴权模式 | 检查[配置选择规则](authentication.md#配置选择规则)，包括继承的环境变量。                                       |
| 找不到 `hello.md`                      | 在文件所在目录运行，或传入文件的完整路径。                                                                     |
| 会话过期或提示需要登录                 | 重新执行登录命令，用 `--api` 明确指定实例。                                                                    |
| 发布超时或返回服务器错误               | 先确认结果再决定是否重新发布；第一次写入可能已经成功，重试会创建新文档。参阅 [CLI 故障排查](cli.md#故障排查)。 |

## 下一步

- 按 [CLI 参考](cli.md)添加本地图片或自动化发布。
- 在 [Markdown 兼容性](markdown.md)中查看支持的语法。
- 通过 [MCP（英文）](../mcp.md)或 [Skill（英文）](../skill.md)让 Agent 发布。
- 浏览[文档导航](README.md)。
