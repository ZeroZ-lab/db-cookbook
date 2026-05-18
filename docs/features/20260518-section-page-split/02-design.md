---
name: section-page-split-design
artifact_type: software
status: draft
created: 2026-05-18
spec_ref: 01-spec.md
---

# Design: 拆页 — 每节独立成页

## Design References

| 来源层 | 来源 | 模式 |
|--------|------|------|
| Official System | VitePress sidebar API | 嵌套 items + collapsed + prev/next frontmatter |
| Official System | VitePress routing | 目录结构映射路由：`site/chapters/10/10-1.md` → `/chapters/10/10-1` |
| Enterprise Product | Vue.js 官方文档 | 章概览页 + 子概念页 + sidebar 嵌套 |
| Enterprise Product | MDN | 每个概念独立 URL，outline 目录导航页内跳转 |
| Local Project Truth | `generate-site.mjs` | `readSections()` 已有节文件读取 + STUB_THRESHOLD 过滤 |
| Local Project Truth | `integrateSectionsInOverview()` | 章源文件骨架 + 节文件详细内容的分离机制 |

## Pattern Synthesis

1. **章源文件 = 骨架**（问题切入、核心判断、系统位置、小结）— 保留在章首页
2. **节文件 = 详细内容**（机制详解、代码、示例）— 拆为独立页面
3. **VitePress 原生嵌套 sidebar** 无需自定义组件
4. **prev/next frontmatter** 提供连续阅读流

## Assumptions

1. Ch00、Ch01、Ch15 无节文件 → 保持单页，URL 不变
2. Ch02-14、Ch16-17 有节文件 → 拆页
3. STUB_THRESHOLD (2000 bytes) 行为保持：低于阈值的节不生成页面
4. 每节文件的标题从首行 `### X.Y <title>` 提取
5. `/book` 大文档的 `createBookPage()` 不动

## 关键设计决策

### D1: 页面分类 — 三类页面

| 页面类型 | 适用章节 | URL 模式 | 生成逻辑 |
|----------|----------|----------|----------|
| **单页章** | Ch00, Ch01, Ch15 | `/chapters/XX-name/` | 与当前逻辑相同 |
| **章索引页** | Ch02-14, Ch16-17 | `/chapters/XX/` | 骨架内容 + 节链接表 |
| **节详情页** | Ch02-14, Ch16-17 | `/chapters/XX/XX-Y` | 节文件内容 |

### D2: 章索引页内容分配

**保留在章索引页**（来自 `chapter.source` 骨架）：
- `# 标题` + `::: tip 本章导读`
- `::: info 本章验收问题`
- Mermaid 流程图
- `## 问题切入`
- `## 核心判断`
- `## 本章内容`（新增：节链接表格）
- `## 系统位置`
- `## 场景案例`
- `## 工程层对比`（如有）
- `## 故障清单`（如有）
- `## 常见误区`
- `## 实战任务`
- `## 小结引出下一章`

**移到节详情页**：`## 机制解释` 下的所有 `### X.Y` 子节内容。

**实现方式**：复用 `integrateSectionsInOverview()` 的 `intro` + `closing` 切分逻辑，但在中间插入节链接表格而非节内容。

### D3: 节链接表格格式

```markdown
## 本章内容

| 节号 | 主题 |
|------|------|
| [10.1](/chapters/10/10-1) | 向量数据库概述 |
| [10.2](/chapters/10/10-2) | 向量表示与嵌入 |
| ... | ... |
```

表格放在 `## 核心判断` 之后、`## 系统位置` 之前。

### D4: 节详情页模板

```markdown
---
title: "10.1 向量数据库概述"
description: "<截取节内容前 120 字符，去除 markdown>"
prev:
  text: "<前一节标题或章首页标题>"
  link: "<前一节 URL 或章首页 URL>"
next:
  text: "<后一节标题或下一章首页标题>"
  link: "<后一节 URL 或下一章首页 URL>"
---

<节文件完整内容>
```

### D5: Sidebar 结构

```js
{
  text: "第四部分：AI 时代的数据基础设施",
  collapsed: false,
  items: [
    {
      text: "10. 向量数据库",
      collapsed: false,  // 默认展开
      items: [
        { text: "章节概览", link: "/chapters/10/" },
        { text: "10.1 向量数据库概述", link: "/chapters/10/10-1" },
        { text: "10.2 向量表示与嵌入", link: "/chapters/10/10-2" },
        // ... 只包含非 stub 节
      ]
    },
    // ... 其他章
  ]
}
```

对于单页章（Ch00, Ch01, Ch15），sidebar 格式不变：
```js
{ text: "0. 核心定位", link: "/chapters/00-positioning" }
```

### D6: prev/next 链路规则

```
全局顺序：章首页 → 各节 → 下一章首页 → 各节 → ...

具体规则：
- 章首页.prev = 上一章最后一节（或上一章首页）
- 章首页.next = 本章第一节
- 第一节.prev = 章首页
- 第 Y 节.prev = 第 Y-1 节
- 第 Y 节.next = 第 Y+1 节（或下一章首页）
- 最后一节.next = 下一章首页
```

### D7: 节标题提取

从节文件首行匹配 `### \d+\.\d+\s+(.+)`，提取标题文本。
如果首行不匹配，使用 `Y.Y 节内容` 作为 fallback。

### D8: 目录生成（createCatalog）

章节链接更新为新 URL：
- 有节文件的章：`/chapters/XX/`
- 无节文件的章：保持 `/chapters/XX-name/`

### D9: STUB_THRESHOLD 行为

保持现有 `STUB_THRESHOLD = 2000` bytes 过滤：
- 高于阈值的节 → 生成独立页面 + 出现在 sidebar + 出现在节链接表
- 低于阈值的节 → 不生成页面 + 不出现在 sidebar + 不出现在节链接表

## generate-site.mjs 改造清单

### 新增函数

1. **`extractSectionTitle(sectionFileContent)`** — 从 `### X.Y <title>` 提取标题
2. **`sectionPage(chapter, sectionNum, sectionContent, prevRef, nextRef)`** — 生成节详情页
3. **`sectionLinksTable(sections)`** — 生成节链接表格 markdown
4. **`sectionSidebarItems(chapter, sections)`** — 生成章节 sidebar 子项

### 改造函数

5. **`chapterPage()` → `chapterIndexPage()`** — 添加节链接表格，去掉 `integrateSectionsInOverview()` 调用
6. **`createConfig()`** — sidebar 嵌套改造
7. **`createCatalog()`** — URL 更新

### 主循环改造

8. 主生成循环：对有节文件的章，额外调用 `sectionPage()` 生成各节页面，输出到 `site/chapters/XX/` 子目录

## 不做清单

- 不改 manuscript 文件
- 不改 `createBookPage()`（完整大文档保留）
- 不改辅助页面（glossary、sql-lab 等）
- 不引入自定义 Vue 组件
- 不降低 STUB_THRESHOLD
- 不做旧 URL redirect

## 批准标准

1. 生成后本地 `pnpm dev` 可正常浏览所有页面
2. 章首页显示节链接表格
3. 每节页面 ~1,200-2,000 字（非 stub 节）
4. Sidebar 正确显示嵌套结构
5. prev/next 链路连续无断裂
6. `/book` 大文档不受影响
