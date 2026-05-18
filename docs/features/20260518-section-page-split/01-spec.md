---
name: section-page-split
artifact_type: software
status: approved
created: 2026-05-18
---

# Spec: 拆页 — 每节独立成页

## 背景

当前 db-cookbook 站点每章所有节合并为单个页面（5,000-17,000 字/页），读者学习压力大。brainstorm 阶段确认：**不砍内容，只改呈现粒度**，把每节拆为独立页面（~1,200 字/页）。

## 目标

- 单页字数从 5,000-17,000 降至 ~1,200-1,800 字
- 零 manuscript 内容改动
- 保留 `/book` 完整大文档页面

## 决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| URL 结构 | `/chapters/10/10-1` 嵌套目录 | 语义清晰，可独立分享 |
| 章首页 | 目录索引页（标题 + 导读 + 节链接列表） | 快速概览，按需深入 |
| `/book` 大文档 | 保留 | 打印和全文搜索用途 |
| 旧 URL 处理 | 直接切换，不保留旧页面 | 简单干净 |
| Sidebar 默认 | 章节子项展开 | 方便浏览 |

## 实现范围

**只改一个文件**：`scripts/generate-site.mjs`

### 1. 新增 `sectionPage()` 函数

为每节生成独立 markdown 文件到 `site/chapters/XX/XX-Y.md`。

每节页面 frontmatter：
```yaml
---
title: "10.1 向量数据库概述"
description: "<从节内容提取前 120 字>"
prev: { text: "10. 向量数据库", link: "/chapters/10/" }  # 第一节指回章首页
next: { text: "10.2 向量表示与嵌入", link: "/chapters/10/10-2" }
---
```

最后一节的 `next` 指向下一章首页。

### 2. 改造 `chapterPage()` → `chapterIndexPage()`

章首页从"全文"变为目录索引：

```markdown
---
title: "10. 向量数据库：面向 AI / RAG / 语义检索的数据系统"
description: "..."
prev: { text: "9. OLAP 数据库", link: "/chapters/09/" }
next: { text: "10.1 向量数据库概述", link: "/chapters/10/10-1" }
---

# 10. 向量数据库

::: tip 本章导读
...
:::

## 本章内容

| 节 | 主题 |
|----|------|
| [10.1](/chapters/10/10-1) | 向量数据库概述 |
| [10.2](/chapters/10/10-2) | 向量表示与嵌入 |
| ... | ... |

## 系统位置
<保留原有的系统位置内容>

## 常见误区
<保留原有的常见误区内容>

## 小结引出下一章
<保留原有的小结内容>
```

章首页保留：导读、验收问题、Mermaid 图、系统位置、场景案例、常见误区、实战任务、小结。
章首页去掉：`integrateSectionsInOverview()` 注入的 12 节详细内容。

### 3. 改造 `createConfig()` sidebar

从：
```js
{ text: "10. 向量数据库", link: "/chapters/10-vector-databases" }
```

变为：
```js
{
  text: "10. 向量数据库",
  collapsed: false,
  items: [
    { text: "章节概览", link: "/chapters/10/" },
    { text: "10.1 向量数据库概述", link: "/chapters/10/10-1" },
    { text: "10.2 向量表示与嵌入", link: "/chapters/10/10-2" },
    // ...
  ]
}
```

每个 part-group 下嵌套章节子组。

### 4. 节标题提取

需要从 `manuscript/chapter-XX-section-Y-complete.md` 的第一个 `### X.Y` 行提取节标题，用于 sidebar 和目录索引。

### 5. 不改动的部分

- `manuscript/` 目录所有文件不动
- `createBookPage()` 不动（完整大文档保留）
- `createCatalog()` — 章节链接需要更新为新 URL
- 其他辅助页面（glossary、sql-lab 等）不动

## URL 映射

| 内容 | 旧 URL | 新 URL |
|------|--------|--------|
| 章索引 | `/chapters/10-vector-databases` | `/chapters/10/` |
| 10.1 节 | (页内锚点) | `/chapters/10/10-1` |
| 10.12 节 | (页内锚点) | `/chapters/10/10-12` |
| 完整大文档 | `/book` | `/book`（不变） |

## prev/next 链路

```
/chapters/09/ → /chapters/09/9-12 (最后一节)
→ /chapters/10/ (章首页)
→ /chapters/10/10-1 → /chapters/10/10-2 → ... → /chapters/10/10-12
→ /chapters/11/ (下一章首页)
→ /chapters/11/11-1 → ...
```

章节之间的 prev/next 穿越章首页，形成连续阅读流。

## 验收标准

1. `node scripts/generate-site.mjs` 成功生成所有页面
2. 每节页面 ~1,200-1,800 字
3. 章首页显示节链接目录
4. Sidebar 显示展开的章节子项
5. prev/next 链路连续
6. `/book` 大文档不受影响
7. 本地 `pnpm dev` 可正常浏览

## 不做清单

- 不砍内容
- 不做自定义组件
- 不做 AI 总结
- 不做自适应难度
- 不做旧 URL redirect
- 不改 manuscript 源文件
