# Mote 发布协议

> 本文定义 Upload API 协议。`@mote/protocol` 包是该协议的代码实现，CLI、MCP 与 Skill 共用同一协议；整体设计见[架构](architecture.md)。

## 总览

以下 Bearer 示例表示你自己的静态 token 部署，请替换示例域名。Access 模式使用相同的发布载荷与结果：OAuth 使用 opaque Bearer，机器使用 `CF-Access-Client-Id` / `CF-Access-Client-Secret`；Access 校验后由 Worker 验证签名断言。两种服务端模式不混用，配置见[鉴权指南](zh-CN/authentication.md)。

```text
POST https://mote.example.com/api/v1/publish
Authorization: Bearer <MOTE_TOKEN>
Content-Type: multipart/form-data
```

- 文档一经发布**不可变**：每次发布生成全新 Document ID 与 URL，无更新/删除接口。
- Document ID 与 Asset ID 均由**服务端**生成，客户端不得指定。
- 只有 `manifest.json` 最后写入 R2 成功后，文档才对外可见（见[原子发布](architecture.md#r2-数据模型)）。

## 请求

### Multipart fields

| Field      | 类型   | 必填 | 说明                                    |
| ---------- | ------ | ---- | --------------------------------------- |
| `document` | file   | 是   | Markdown 文件（非空 UTF-8，≤ 2 MiB）    |
| `manifest` | string | 是   | 客户端 manifest（JSON，结构见下）       |
| `asset_N`  | file   | 否   | 第 N 个图片资产（N 从 0 开始，≤ 50 个） |

### 客户端 manifest

```json
{
  "version": 1,
  "entry": "README.md",
  "assets": [
    {
      "field": "asset_0",
      "references": ["./images/architecture.png"]
    },
    {
      "field": "asset_1",
      "references": ["./screenshots/demo.webp", "images/demo.webp"]
    }
  ]
}
```

| 字段                  | 说明                                                                     |
| --------------------- | ------------------------------------------------------------------------ |
| `version`             | 固定为 `1`                                                               |
| `entry`               | 入口文件名（存入 R2 manifest 的 `source.name`）                          |
| `assets[].field`      | 对应 multipart 中的 `asset_N` 字段名，不得重复                           |
| `assets[].references` | 该资产在 Markdown 中的全部引用拼写（同一张图多种写法合并为一个资产上传） |

`entry` 必须为非空字符串，`assets` 必须为数组；每个资产的 `references` 必须是非空字符串组成的非空数组。每个 `field` 必须符合 `asset_N` 格式且不得重复，并存在对应的 multipart 文件，否则返回 `422 INVALID_DOCUMENT`。

### 大小与数量限额

大小按原始字节计量，不按字符串字符数计量。1 MiB = 1,048,576 字节：

| 项目                          | 限额     | 精确值                   |
| ----------------------------- | -------- | ------------------------ |
| Markdown                      | ≤ 2 MiB  | 2,097,152 字节           |
| 单个上传图片                  | ≤ 10 MiB | 10,485,760 字节          |
| 文档包（Markdown + 上传图片） | ≤ 20 MiB | 20,971,520 字节          |
| 上传资产条目                  | ≤ 50     | `manifest.assets.length` |
| 请求体 Content-Length 预检    | ≤ 21 MiB | 22,020,096 字节          |

文档包限额不含 multipart 边界、字段头和 manifest；Content-Length 预检为这些开销预留 1 MiB。该预检只根据收到的 Content-Length 提前拒绝，不能替代解析后的文档包验证。

CLI 与本地文件 MCP 会先按图片内容去重，再计算上传条目数。服务端按 manifest 条目校验，不替自定义客户端去重；远程 HTTP(S) 图片不下载、不计入上传字节与条目数。

### 完整请求示例：静态 token 实例

在一个新目录中创建最小文档，并使用已配置的 token 模式实例。通过自己的凭据配置将 `MOTE_TOKEN` 注入当前终端，替换示例中的 API origin：

```bash
mkdir mote-api-example
cd mote-api-example
printf '# Hello Mote\n\nPublished through the REST API.\n' > hello.md
export MOTE_API_URL="https://mote.example.com"

curl --fail-with-body --silent --show-error \
  --request POST \
  --header "Authorization: Bearer ${MOTE_TOKEN}" \
  --form 'document=@hello.md;type=text/markdown' \
  --form-string 'manifest={"version":1,"entry":"hello.md","assets":[]}' \
  "${MOTE_API_URL}/api/v1/publish"
```

由 curl 生成带 boundary 的 Content-Type，不手工设置 multipart 头。成功返回 `201` 和下文的 `{id,url}` JSON。此静态 token 示例不适用于生产 mote.pub 的 Access 鉴权。每次调用会生成新文档，结果不明确时先核对日志和返回值，再决定是否重新发布。

## 服务端处理

```text
1. 部署模式鉴权（token / Access 断言）   → 401
2. Content-Length 预检（> 21 MiB 直接拒） → 413
3. Content-Type 必须 multipart/form-data → 415
4. multipart 解析                        → 400
5. document：非空、UTF-8                 → 422
6. manifest：JSON 解析 → 400；资产条目 > 50 → 413；其余结构错误 → 422
7. asset：对应文件缺失或不是文件 → 422；Magic Bytes 类型不支持 → 415（仅 png/jpeg/webp/gif/avif，SVG 拒绝）
8. 大小限额：Markdown ≤2 MiB / 单图 ≤10 MiB / 总 ≤20 MiB → 413
9. 生成 Document ID（16 字符 Base58），R2 冲突则内部重试（不对客户端返回 409）
10. 生成 Asset ID（12 字符 Base58）
11. 计算 SHA-256
12. 写入 R2：assets → document.md → manifest.json（最后）
13. 201 Created
```

第 6 步在遍历资产条目和读取图片字节之前检查数量，超限返回 `413 BUNDLE_TOO_LARGE`。此时 multipart 请求体已解析；数量超限优先于 manifest 的其他结构检查。

### R2 Bundle 结构

```text
documents/{document-id}/
├── document.md      # 原始 Markdown（不存预生成 HTML）
├── manifest.json    # 元数据 + commit marker
└── assets/{asset-id}
```

### 服务端 manifest（`manifest.json`）

```json
{
  "version": 1,
  "id": "7Vk3mQ9x2NFaP4Ls",
  "createdAt": "2026-09-03T06:00:00.000Z",
  "source": { "name": "README.md", "size": 48231, "sha256": "..." },
  "assets": [
    {
      "id": "Aq8K3pLm92Xq",
      "references": ["./images/architecture.png"],
      "contentType": "image/png",
      "size": 328291,
      "sha256": "..."
    }
  ]
}
```

上方服务端 manifest 中的哈希为展示而缩写；实际 `sha256` 为 64 字符小写十六进制字符串，`source.size` 和资产 `size` 均为存储字节数。

## 响应

### 201 Created

```json
{
  "id": "7Vk3mQ9x2NFaP4Ls",
  "url": "https://mote.example.com/7Vk3mQ9x2NFaP4Ls"
}
```

### 错误

统一结构：

```json
{
  "error": {
    "code": "INVALID_DOCUMENT",
    "message": "..."
  }
}
```

| HTTP | code                     | 触发条件                                                            |
| ---- | ------------------------ | ------------------------------------------------------------------- |
| 400  | `MALFORMED_REQUEST`      | multipart 无法解析、document 缺失或不是文件、manifest 缺失或非 JSON |
| 401  | `UNAUTHORIZED`           | 缺失、失效或与部署模式不符的发布凭据                                |
| 413  | `BUNDLE_TOO_LARGE`       | 超过任一大小/数量限额                                               |
| 415  | `UNSUPPORTED_MEDIA_TYPE` | 非 multipart 请求，或资产不是支持的图片类型                         |
| 422  | `INVALID_DOCUMENT`       | document 为空/非 UTF-8、manifest 结构错误、资产缺少对应文件         |
| 500  | `INTERNAL_ERROR`         | 服务端内部错误                                                      |

## 公开访问（Viewer）

| 路由                                   | 说明                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `GET/HEAD /{document-id}`              | 渲染后的 HTML；HEAD 仅返回响应头（HTML 白名单净化，仅可信目录与折叠定位/代码复制脚本，严格 CSP） |
| `GET/HEAD /{document-id}/a/{asset-id}` | 图片资产；HEAD 仅返回响应头（Content-Type 来自 manifest）                                        |
| `GET /robots.txt`                      | `User-agent: * Disallow: /`                                                                      |
| `GET /health`                          | `{"status":"ok"}`（不访问 R2）                                                                   |

- Malformed ID 与不存在的 ID 返回**完全相同的 404**，不暴露枚举信息。
- 缓存：Document 边缘缓存 1 年（浏览器 5 分钟）；Asset `immutable` 1 年。
- 安全头：`Content-Security-Policy`（`script-src` 仅授权固定导航（含目录、折叠定位和标签切换）与代码复制脚本的 SHA-256 哈希）、`Referrer-Policy: no-referrer`、`X-Robots-Tag: noindex` 等，详见 [security.md](security.md)。

## ID 格式

| 类型        | 格式           | 熵       | 生成                     |
| ----------- | -------------- | -------- | ------------------------ |
| Document ID | 16 字符 Base58 | ≈ 94 bit | `crypto.getRandomValues` |
| Asset ID    | 12 字符 Base58 | ≈ 70 bit | 同上                     |

Base58 字符表排除 `0 O I l`。校验正则见 `@mote/core` 的 `isDocumentId` / `isAssetId`。
