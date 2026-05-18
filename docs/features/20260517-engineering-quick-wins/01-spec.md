---
name: engineering-quick-wins
artifact_type: software
status: approved
created: 2026-05-17
---

# Spec: 工程快赢 + CI/CD + 内容分发

## 背景

《数据库全书》已完成 18 章内容、10 个验证脚本、VitePress 站点部署在 Vercel。项目处于**在线免费发布**阶段，需要提升工程健壮性和内容分发能力。

## 目标

1. 清理技术债务（.gitignore、缓存头）
2. 建立 CI 门禁防止质量回退
3. 改善 GitHub 首页吸引力和分发能力
4. SEO 相关优化暂缓，等自定义域名后再做

## Scope

### In Scope

| # | 任务 | 文件 | 预估 |
|---|------|------|------|
| T1 | `.gitignore` 去重 | `.gitignore` | 1 min |
| T2 | `vercel.json` 加 Cache-Control 头 | `vercel.json` | 5 min |
| T3 | 创建 `robots.txt`（Allow all，不含 Sitemap 行） | `site/public/robots.txt` | 2 min |
| T4 | GitHub Actions CI 门禁 | `.github/workflows/verify.yml` | 15 min |
| T5 | `package.json` 加 `packageManager` 字段 | `package.json` | 2 min |
| T6 | README 优化（阅读引导 + badge + 内容亮点） | `README.md` | 20 min |

### Out of Scope（有域名后做）

- sitemap 配置
- OG 标签（`transformPageData` hook）
- JSON-LD 结构化数据
- hreflang 标签
- 自定义域名绑定

## 详细规格

### T1: .gitignore 去重

当前文件有 6 个条目重复了一遍。去重后保留：

```
node_modules/
dist/
.DS_Store
*.log
.vercel
.playwright-mcp/
```

### T2: vercel.json Cache-Control

VitePress 构建产物中 JS/CSS 文件名带 content hash，可安全设置长缓存。图片设置 1 天缓存。

```json
{
  "buildCommand": "pnpm docs:build",
  "outputDirectory": "site/.vitepress/dist",
  "installCommand": "pnpm install",
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/images/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "max-age=86400" }
      ]
    }
  ]
}
```

### T3: robots.txt

创建 `site/public/robots.txt`：

```
User-agent: *
Allow: /
Disallow: /examples/
```

注意：不含 Sitemap 行（没有域名时指向 vercel.app 无意义）。

### T4: GitHub Actions CI

创建 `.github/workflows/verify.yml`：

- 触发：PR to main + push to main
- 步骤：checkout → pnpm setup → node setup → install → verify → build
- pnpm 版本锁定为 9（匹配现有 lockfile）
- Node 版本锁定为 18（匹配 .nvmrc）

```yaml
name: Verify
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm verify
      - run: pnpm docs:build
```

### T5: packageManager 字段

在 `package.json` 加 `"packageManager": "pnpm@9.x.x"`（x.x 取决于当前 pnpm 版本），确保 CI 和本地使用相同版本。

### T6: README 优化

改善 GitHub 首页，包含：
- 一句话介绍 + 在线阅读链接
- 书籍覆盖范围（5 部分 18 章概要）
- 章节目录 badge 或表格
- 快速开始（本地运行命令）
- 项目结构说明
- 贡献/反馈指引

## 验收标准

- [ ] `.gitignore` 无重复条目
- [ ] `vercel.json` 包含 `/assets/` 和 `/images/` 的 Cache-Control 头
- [ ] `site/public/robots.txt` 存在且 Allow all
- [ ] `.github/workflows/verify.yml` 存在且语法正确
- [ ] `package.json` 包含 `packageManager` 字段
- [ ] README 包含在线阅读链接、章节概要、快速开始
- [ ] `pnpm verify` 全部通过
- [ ] `pnpm docs:build` 构建成功

## 风险

| 风险 | 概率 | 缓解 |
|------|------|------|
| CI pnpm 版本与 lockfile 不匹配 | 低 | 用 `packageManager` 字段锁定 |
| Vercel 缓存头导致更新不生效 | 极低 | VitePress assets 带 content hash |

## 未来工作（有自定义域名后）

1. 绑定自定义域名到 Vercel
2. 启用 VitePress 内置 sitemap：`sitemap: { hostname: 'https://your-domain.com' }`
3. 加 `transformPageData` hook 生成每页 OG 标签
4. 加 JSON-LD 结构化数据（Book schema）
5. 更新 robots.txt 加 Sitemap 指令
6. 考虑向掘金/知乎投稿章节摘要
