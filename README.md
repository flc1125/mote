# Mote

> **Mote = Markdown in, URL out.**
>
> 将本地 Markdown 文档发布为一个不可枚举、永久有效、可直接通过浏览器阅读的在线页面。

```bash
mote README.md
```

```text
Published:

https://mote.flc.io/7Vk3mQ9x2NFaP4Ls
```

## 核心原则

```text
Markdown is the source of truth.
HTML is ephemeral.
Documents are immutable.
The URL is the capability.
The CDN is the materialized view.
```

- **不可变**：每次发布生成全新 URL，旧 URL 永久保持原内容。
- **Capability URL**：知道 URL 即可访问，无需登录；URL 本身不可枚举、不可预测。
- **无数据库**：Markdown + Manifest + Assets 存于 Cloudflare R2，HTML 只存在于 CDN 缓存。

## 状态

项目处于早期开发阶段（V1 实施中）。安装与使用文档将在 V1 发布后完善。

## 文档

- [架构](docs/architecture.md)

## License

[MIT](LICENSE)
