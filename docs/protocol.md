# Mote 发布协议

> 本文定义 Upload API 协议。`@mote/protocol` 包是该协议的代码实现，CLI 与未来 MCP/Skill 共用同一协议（基线 §45）。

## 总览

```text
POST https://mote.flc.io/api/v1/publish
Authorization: Bearer <MOTE_TOKEN>
Content-Type: multipart/form-data
```

- 文档一经发布**不可变**：每次发布生成全新 Document ID 与 URL，无更新/删除接口。
- Document ID 与 Asset ID 均由**服务端**生成，客户端不得指定。
- 只有 `manifest.json` 最后写入 R2 成功后，文档才对外可见（原子发布，基线 §54）。

## 请求

### Multipart fields

| Field      | 类型   | 必填 | 说明                                    |
| ---------- | ------ | ---- | --------------------------------------- |
| `document` | file   | 是   | Markdown 文件（UTF-8，≤ 2 MB）          |
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

校验规则：`assets` 中每个 `field` 必须存在对应的 multipart 文件，否则 `422`。

## 服务端处理

```text
1. Bearer Token 校验                     → 401
2. Content-Length 预检（> 21 MB 直接拒）  → 413
3. Content-Type 必须 multipart/form-data → 415
4. multipart 解析                        → 400
5. document：非空、UTF-8                 → 422
6. manifest：JSON 合法、结构校验          → 400 / 422
7. asset：Magic Bytes 检测图片类型        → 415（仅 png/jpeg/webp/gif/avif，SVG 拒绝）
8. 限额：Markdown ≤2MB / 单图 ≤10MB / 总 ≤20MB / ≤50 个 → 413
9. 生成 Document ID（16 字符 Base58），R2 冲突则内部重试（不对客户端返回 409）
10. 生成 Asset ID（12 字符 Base58）
11. 计算 SHA-256
12. 写入 R2：assets → document.md → manifest.json（最后）
13. 201 Created
```

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

## 响应

### 201 Created

```json
{
  "id": "7Vk3mQ9x2NFaP4Ls",
  "url": "https://mote.flc.io/7Vk3mQ9x2NFaP4Ls"
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

| HTTP | code                     | 触发条件                                       |
| ---- | ------------------------ | ---------------------------------------------- |
| 400  | `MALFORMED_REQUEST`      | multipart 无法解析、缺少字段、manifest 非 JSON |
| 401  | `UNAUTHORIZED`           | 缺失或错误的 Bearer Token                      |
| 413  | `BUNDLE_TOO_LARGE`       | 超过任一大小/数量限额                          |
| 415  | `UNSUPPORTED_MEDIA_TYPE` | 非 multipart 请求，或资产不是支持的图片类型    |
| 422  | `INVALID_DOCUMENT`       | document 为空/非 UTF-8、manifest 校验失败      |
| 500  | `INTERNAL_ERROR`         | 服务端内部错误                                 |

## 公开访问（Viewer）

| 路由                              | 说明                                           |
| --------------------------------- | ---------------------------------------------- |
| `GET /{document-id}`              | 渲染后的 HTML（`html:false`，无 JS，严格 CSP） |
| `GET /{document-id}/a/{asset-id}` | 图片资产（Content-Type 来自 manifest）         |
| `GET /robots.txt`                 | `User-agent: * Disallow: /`                    |
| `GET /health`                     | `{"status":"ok"}`（不访问 R2）                 |

- Malformed ID 与不存在的 ID 返回**完全相同的 404**，不暴露枚举信息。
- 缓存：Document 边缘缓存 1 年（浏览器 5 分钟）；Asset `immutable` 1 年。
- 安全头：`Content-Security-Policy`（`script-src 'none'` 等）、`Referrer-Policy: no-referrer`、`X-Robots-Tag: noindex` 等，详见 [security.md](security.md)。

## ID 格式

| 类型        | 格式           | 熵       | 生成                     |
| ----------- | -------------- | -------- | ------------------------ |
| Document ID | 16 字符 Base58 | ≈ 94 bit | `crypto.getRandomValues` |
| Asset ID    | 12 字符 Base58 | ≈ 70 bit | 同上                     |

Base58 字符表排除 `0 O I l`。校验正则见 `@mote/core` 的 `isDocumentId` / `isAssetId`。
