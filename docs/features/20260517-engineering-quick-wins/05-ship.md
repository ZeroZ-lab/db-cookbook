---
name: engineering-quick-wins-ship
artifact_type: software
created: 2026-05-18
commit: b6d38f7
---

# Ship: 工程快赢 + CI/CD + 内容分发

## 变更摘要

| 文件 | 操作 | 说明 |
|------|------|------|
| `README.md` | 重写 | 读者友好首页：在线链接、章节概览、快速开始、反馈指引 |
| `.gitignore` | 修改 | 去除 5 行重复 |
| `vercel.json` | 修改 | 添加 /assets/ immutable + /images/ 86400 缓存头 |
| `site/public/robots.txt` | 新建 | Allow all + Disallow /examples/ |
| `package.json` | 修改 | 添加 packageManager: pnpm@10.26.1 |
| `.github/workflows/verify.yml` | 新建 | CI 门禁：verify + build |

## 验证证据

- `pnpm verify` — 11 脚本全部通过
- `pnpm docs:build` — 41s 构建成功
- Spec compliance — 8/8 验收标准满足
- Code quality — 五轴 22/25，零阻塞

## 远程操作

- GitHub 仓库 description 已设置
- GitHub 仓库 homepage 已设置
- GitHub 仓库 topics 已设置（database, postgresql, data-engineering, chinese, ebook, vitepress）

## 后续工作

| 项目 | 条件 | 预估 |
|------|------|------|
| 自定义域名绑定 | 用户购买域名后 | 30 min |
| sitemap + OG tags + JSON-LD | 域名绑定后 | 1-2 hr |
| 内容分发（掘金/知乎投稿） | 优先级决定后 | 按章 |

## 完整交付物路径

- Spec: `docs/features/20260517-engineering-quick-wins/01-spec.md`
- Plan: `docs/features/20260517-engineering-quick-wins/03-plan.md`
- Review: `docs/features/20260517-engineering-quick-wins/04-review.md`
- Ship: `docs/features/20260517-engineering-quick-wins/05-ship.md`
