---
name: engineering-quick-wins-plan
artifact_type: software
plan_topology: parallel
created: 2026-05-17
reviewers: ceo, eng
review_status: amended
---

# Plan: 工程快赢 + CI/CD + 内容分发

## 假设

- pnpm 版本 `10.26.1`（lockfile 格式 `9.0`，pnpm 10 使用该格式）
- Node.js 版本 `18`（.nvmrc 锁定）
- Vercel 部署在默认域名，SEO 暂缓
- 单人项目，无协作分支策略

## 依赖图

```
T1 README 优化 ─────────┐  最高 ROI，先做
                         │
T2 .gitignore ───────────┤
T3 vercel.json ──────────┤  互不依赖，可并行
T4 robots.txt ───────────┤
T5 packageManager ───────┤
                         ├──▶ T6 GitHub Actions（需要 T5）
T7 GitHub 仓库元数据 ────┘
```

**Plan Topology:** `parallel` — T1-T5/T7 并行安全，T6 依赖 T5。

## 任务列表

### Task 1: README 优化 [最高优先级]

- **操作:** 重写 README 为读者友好的首页
- **修改文件:** `README.md`
- **保留内容:** "核心定位"段落、"写作路线"段落、"最小闭环"代码块
- **新增内容:**
  - 顶部：标题 + 一句话描述 + 在线阅读链接（指向 Vercel 部署地址）
  - 章节概要：5 部分 18 章表格（部分名 + 章节范围）
  - 快速开始：`pnpm install && pnpm docs:dev`
  - 项目结构：简要目录说明（manuscript/site/scripts/project-workbench）
  - 反馈：GitHub Issues 链接
- **删除内容:** "在线阅读站点"段落中的脚本列表（过于内部）
- **验收:** README 包含"在线阅读"链接且首屏可见
- **parallel_safe:** true

### Task 2: .gitignore 去重

- **操作:** 编辑 `.gitignore`，删除重复行，保留 6 个唯一条目
- **修改文件:** `.gitignore`
- **验收:** `sort .gitignore | uniq -d` 输出为空
- **parallel_safe:** true

### Task 3: vercel.json 加 Cache-Control

- **操作:** 在 `vercel.json` 添加 `headers` 数组，为 `/assets/` 和 `/images/` 设置缓存
- **修改文件:** `vercel.json`
- **验收:** `cat vercel.json | jq '.headers | length'` 返回 2
- **parallel_safe:** true

### Task 4: 创建 robots.txt

- **操作:** 创建 `site/public/robots.txt`
- **创建文件:** `site/public/robots.txt`
- **内容:**
  ```
  User-agent: *
  Allow: /
  Disallow: /examples/
  ```
- **验收:** `test -f site/public/robots.txt && grep -q "Allow: /" site/public/robots.txt`
- **parallel_safe:** true

### Task 5: package.json 加 packageManager

- **操作:** 在 `package.json` 添加 `"packageManager": "pnpm@10.26.1"`
- **修改文件:** `package.json`
- **验收:** `jq -r '.packageManager' package.json` 返回 `pnpm@10.26.1`
- **parallel_safe:** true

### Task 6: GitHub Actions CI 门禁

- **操作:** 创建 `.github/workflows/verify.yml`（先创建 `.github/workflows/` 目录）
- **创建文件:** `.github/workflows/verify.yml`
- **依赖:** Task 5（packageManager 字段）
- **CI 配置:**
  - `pnpm/action-setup@v4` 不指定 `version`，从 `packageManager` 字段读取
  - `actions/setup-node@v4`，node-version: 18，cache: pnpm
  - `pnpm install --frozen-lockfile`
  - `pnpm verify`
  - `pnpm docs:build`
- **验收:** `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/verify.yml'))"` 无报错
- **parallel_safe:** false（依赖 Task 5）

### Task 7: GitHub 仓库元数据

- **操作:** 设置 GitHub 仓库 description、homepage URL、topics
- **修改文件:** 无文件变更（通过 `gh repo edit` 命令）
- **建议 topics:** `database`, `postgresql`, `data-engineering`, `chinese`, `ebook`, `vitepress`
- **验收:** `gh repo view --json description,homepageUrl,repositoryTopics` 返回正确值
- **parallel_safe:** true
- **注意:** 需要用户确认或手动执行（涉及远程仓库修改）

### Checkpoint: 全量验证

- **操作:** 运行 `pnpm verify` + `pnpm docs:build`
- **依赖:** Task 1-6 全部完成
- **验收:** verify 通过 + build 成功

## 文件变更汇总

| 文件 | 操作 | Task |
|------|------|------|
| `README.md` | 重写 | T1 |
| `.gitignore` | 修改 | T2 |
| `vercel.json` | 修改 | T3 |
| `site/public/robots.txt` | 新建 | T4 |
| `package.json` | 修改 | T5 |
| `.github/workflows/verify.yml` | 新建 | T6 |

共 6 个文件 + 1 个远程操作（T7）。

## Review 修正记录

| 问题 | 来源 | 修正 |
|------|------|------|
| pnpm 版本矛盾（spec 写 9，实际 10.26.1） | Eng | CI 不指定 version，从 packageManager 读取 |
| README 应排第一 | CEO | T1 改为 README |
| 缺少 GitHub 仓库元数据 | CEO | 新增 T7 |
| 任务编号与 spec 不一致 | Eng | 重新编号，plan 独立于 spec |
| .github/workflows/ 目录需显式创建 | Eng | T6 步骤中注明 |
