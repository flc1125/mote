# Security Policy

> 中文说明见下方 [中文部分](#中文)。

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Report them privately via **GitHub Security Advisories**:

[Report a vulnerability](https://github.com/flc1125/mote/security/advisories/new)

Please include, where possible:

- A description of the vulnerability and its impact
- Steps to reproduce / proof of concept
- Affected versions or commit hashes

## What to Expect

- **Acknowledgement** of your report within 72 hours
- An initial assessment within 7 days, including whether the report is accepted as a vulnerability
- A fix or mitigation plan for accepted reports, coordinated with you before any public disclosure
- Credit in the release notes once the fix is published (unless you prefer to remain anonymous)

We follow **coordinated disclosure**: please give us reasonable time to fix the issue before publishing any details.

## Scope

Mote is an immutable Markdown publishing service. Issues we care most about:

- **Confidentiality of published documents** — e.g. Document ID enumeration, cache poisoning, referrer/secret URL leakage
- **XSS or content injection** in rendered pages (raw HTML bypass, dangerous URL schemes, CSP gaps)
- **Publish API authentication** — bearer token bypass, unauthorized writes to R2
- **Supply chain** — malicious code in build or release pipelines

Out of scope: rate-limit/DoS observations without a concrete exploit, issues in third-party dependencies without demonstrated impact on Mote, and reports requiring physical access to a maintainer's machine.

## Supported Versions

| Version                 | Supported           |
| ----------------------- | ------------------- |
| latest release (`v0.x`) | ✅                  |
| older releases          | ❌ (please upgrade) |

## Secret Hygiene (for contributors)

Never commit real tokens, `.dev.vars`, or wrangler local config. Tests must use clearly fake tokens (e.g. `test-only-*`). See the security model and token rules in [docs/security.md](docs/security.md).

---

## 中文

### 报告漏洞

**请勿通过公开 GitHub Issue 报告安全漏洞。** 请通过 GitHub Security Advisories 私下报告：[提交漏洞报告](https://github.com/flc1125/mote/security/advisories/new)。

### 响应承诺

- 72 小时内确认收到；7 天内给出初步评估；接受为漏洞的报告将与你协调修复与披露节奏。遵循协同披露原则。

### 支持版本

仅支持最新发布版本（`v0.x`），请升级到最新版。

### 贡献者秘钥规范

严禁提交真实 token、`.dev.vars`、wrangler 本地配置；测试一律使用显式假 token（如 `test-only-*`）。详见 [docs/security.md](docs/security.md)。
