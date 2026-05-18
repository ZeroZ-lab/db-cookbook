# Learning Path Simulator — Spec

**artifact_type**: interactive-vue-component
**status**: final
**created**: 2026-05-18
**phasing**: design all 6 milestones, implement in batches (M1 → M1+M2 → M3-M6)

---

## 1. Overview

在 db-cookbook VitePress 网站中新增一个交互式数据流可视化模拟器组件 `DataFlowSimulator.vue`，用"一表到底"叙事线引导用户从 PostgreSQL 单表逐步理解数据系统演化。

用户点击系统组件，看到数据流动画 + 机制解释。每步只新增一个机制，前步可复用。

### 目标用户

会写 SQL（SELECT/JOIN/GROUP BY），但不理解索引、事务、执行计划、数仓、批流等机制的人。

### 核心价值

不是装饰性动画——每个可视化步骤必须教一个具体机制（"为什么 B-tree 页分裂导致写放大"、"为什么 OLAP 用列存比行存快 100 倍"），而不是只展示"数据从 A 流到 B"。

---

## 2. 5W1H

| 维度 | 回答 |
|------|------|
| **Who** | 会写 SQL 但不理解数据库机制的读者 |
| **What** | 数据流可视化模拟器 Vue 3 组件，嵌入 VitePress 页面 |
| **Where** | site/.vitepress/theme/components/DataFlowSimulator.vue + site/learning-path.md 新页面 |
| **When** | 设计全部 6 个里程碑，实现分批：Phase 1 = M1，Phase 2 = M1+M2，Phase 3 = M3-M6 |
| **Why** | 静态 Mermaid 图只能展示拓扑，交互式可视化能建立"数据系统演化"的体感 |
| **How** | 单组件 + JSON 配置，CSS 动画（TransitionGroup + SVG stroke-dashoffset），无外部动画库 |

---

## 3. Architecture

### 3.1 组件架构

```
site/.vitepress/theme/
├── components/
│   ├── Mermaid.vue                 # 已有
│   ├── GlossaryTerm.vue            # 已有
│   └── DataFlowSimulator.vue       # 新增 — 主组件
├── data/
│   └── milestones/
│       ├── m1-postgresql.json       # M1 配置
│       ├── m2-warehouse.json        # M2 配置
│       ├── m3-batch-stream.json     # M3 配置
│       ├── m4-ai-databases.json     # M4 配置
│       ├── m5-lakehouse.json        # M5 配置
│       └── m6-full-platform.json    # M6 配置
└── index.ts                         # 注册 DataFlowSimulator
```

### 3.2 渲染模型

- **节点（Nodes）**：SVG 圆角矩形，代表系统组件（PostgreSQL、ClickHouse、Kafka 等）
- **边（Edges）**：SVG `<path>` 或 `<line>`，带 `stroke-dashoffset` CSS 动画模拟数据流动
- **步骤面板（Step Panel）**：节点下方的文字面板，显示当前步骤的机制解释
- **进度条（Progress）**：底部显示当前里程碑的步骤进度

### 3.3 交互流程

1. 用户看到当前里程碑的系统拓扑图
2. 点击"下一步"按钮，新增一个节点或边，触发动画
3. 动画播放时，步骤面板同步显示机制解释
4. 点击任意节点，弹出该节点的详细说明（tooltip 或侧边面板）
5. 完成所有步骤后，显示"验收问题"和"下一步"入口

### 3.4 SSR 防护

组件涉及 DOM 操作和动画，必须：
- 在 Markdown 中使用 `<ClientOnly><DataFlowSimulator milestone="1" /></ClientOnly>`，或
- 组件内部用 `onMounted` 守护所有 DOM 访问（与 Mermaid.vue 模式一致）

### 3.5 移动端策略

使用 SVG `viewBox` + `preserveAspectRatio="xMidYMid meet"`，让画布自适应宽度。节点详情面板在移动端改为底部弹出（bottom sheet）。不做水平滚动。

---

## 4. Component API

### Props

```typescript
interface Props {
  milestone: 1 | 2 | 3 | 4 | 5 | 6  // 里程碑编号
}
```

### Milestone JSON Schema

```typescript
interface MilestoneConfig {
  id: string                        // "m1-postgresql"
  title: string                     // 里程碑标题
  subtitle: string                  // 兰迪·波许入口问题
  nodes: NodeConfig[]               // 所有节点（含初始隐藏的）
  edges: EdgeConfig[]               // 所有边（含初始隐藏的）
  steps: StepConfig[]               // 3-5 个步骤
  validationQuestion: string        // 验收问题
  nextMilestone: string             // "m2-warehouse" 或空
}

interface NodeConfig {
  id: string                        // "pg-orders"
  label: string                     // "PostgreSQL\norders 表"
  icon: string                      // 内置图标名或空
  x: number                         // SVG 坐标（viewBox 相对）
  y: number
  width: number
  height: number
  detail: string                    // 点击节点时的详细说明（支持 Markdown）
  color: string                     // 主题色
}

interface EdgeConfig {
  id: string
  from: string                      // 源节点 ID
  to: string                        // 目标节点 ID
  label: string                     // 边标签（如 "ETL"、"CDC"）
  color: string
  animated: boolean                 // 是否有流动动画
}

interface StepConfig {
  title: string                     // 步骤标题
  showNodes: string[]               // 本步显示的节点 ID
  showEdges: string[]               // 本步显示的边 ID
  highlightNodes: string[]          // 本步高亮的节点 ID
  highlightEdges: string[]          // 本步高亮的边 ID
  explanation: string               // 机制解释（支持 Markdown）
  mechanismFocus: string            // 核心机制一句话（如 "B-tree 索引如何加速查询"）
}
```

---

## 5. Milestone Definitions

### M1: 一张表的故事 — PostgreSQL + SQL

**入口问题**: "你的 orders 表里有 100 万条订单。一条 SELECT * FROM orders WHERE user_id = 42 要多久？为什么？"

**节点**: PostgreSQL（含 orders 表图标）

| 步骤 | 新增 | 机制焦点 | 解释 |
|------|------|---------|------|
| 1 | 显示 PostgreSQL + orders 表 | 表结构设计 | 一行代表什么？主键和外键解决什么问题？为什么不能在应用层检查？ |
| 2 | 查询动画（扫描 → 过滤 → 返回） | 全表扫描 | 没有索引时，数据库如何找到 user_id=42？逐行检查 100 万行。 |
| 3 | B-tree 索引节点出现 | 索引加速 | 索引把 O(n) 变成 O(log n)。但索引不是免费的——写入时要维护。 |
| 4 | 窗口函数动画（排序 → 分区 → 计算） | 窗口函数 | "每个用户的消费排名"不用 GROUP BY，而用窗口函数。为什么？ |
| 5 | 分区动画（按时间拆分大表） | 表分区 | 1000 万行时，分区让查询只扫描相关分区。但分区键选错了比不分区更慢。 |

**验收**: 能解释"为什么索引加速查询但有写入代价"、"什么时候应该分区"。

### M2: 表不够用了 — OLTP/OLAP 分化 + 数仓建模

**入口问题**: "老板要在 10 秒内看到全国门店的实时 GMV，但你的 PostgreSQL 正在处理下单——SELECT 把业务库锁死了。"

**节点**: PostgreSQL → ETL → 数仓（ClickHouse/Doris）

| 步骤 | 新增 | 机制焦点 | 解释 |
|------|------|---------|------|
| 1 | 显示 PostgreSQL + 数仓两个节点 | OLTP/OLAP 分化 | 为什么不能在业务库上跑分析？锁、资源争抢、查询模式完全不同。 |
| 2 | ETL 边出现（PG → 数仓） | ETL 同步 | 数据如何从业务库进入分析库？批量同步 vs 实时同步。 |
| 3 | 星型模型节点（事实表 + 维度表） | 数仓建模 | 把 orders 拆成事实表和维度表。为什么？因为分析查询的模式和业务查询不同。 |
| 4 | 分层模型（ODS → DWD → DWS → ADS） | 数据分层 | 明细层、汇总层、应用层分工。每一层解决什么问题？跳层会怎样？ |
| 5 | ClickHouse 对比查询动画 | 列式存储 | 同一条 SQL，PG 行存 vs CH 列存。为什么列存对聚合快 100 倍？ |

**验收**: 能画出星型模型，能解释"为什么不能直接在业务库上跑分析"。

### M3: 一台机器装不下 — 批处理 + 流处理 + OLAP

**入口问题**: "数据量从 1000 万变成了 100 亿。你的 ClickHouse 单机开始频繁 OOM。同时，老板要求'5 分钟内的异常订单立刻报警'。"

**节点**: PostgreSQL → Kafka → Flink → ClickHouse + Spark/Trino

| 步骤 | 新增 | 机制焦点 | 解释 |
|------|------|---------|------|
| 1 | Kafka 节点出现（PG → Kafka） | 事件流 | 数据不是"拉"的，而是"推"的。Kafka 的 topic、partition、consumer group。 |
| 2 | Flink 节点出现（Kafka → Flink） | 流处理 | 窗口、水位线、迟到数据。为什么流处理不是"更快的批处理"？ |
| 3 | Spark 节点出现 | 批处理 | 历史数据加工。Shuffle、Stage、RDD。Spark 和 Flink 的分工。 |
| 4 | Trino 节点出现 | 联邦查询 | 不搬数据也能查询。但联邦查询的代价是什么？ |
| 5 | 全链路数据流动画 | 链路整合 | 批处理负责"T+1 报表"，流处理负责"实时告警"，OLAP 负责"交互查询"。三者如何分工？ |

**验收**: 能解释 Spark 和 Flink 的分工，能说出"流处理和批处理不是速度差异而是语义差异"。

### M4: 表之外还有世界 — 向量数据库 + 图数据库

**入口问题**: "用户在客服聊天框问'退货后多久能收到退款'。你的 SQL 只能精确匹配关键词，找不到语义相似的文档。另外， fraud 团队需要找到'和已知欺诈账户有 3 跳以内关联的所有用户'。"

**节点**: PostgreSQL → Embedding → 向量数据库 + 图数据库

| 步骤 | 新增 | 机制焦点 | 解释 |
|------|------|---------|------|
| 1 | 文档节点 → Embedding 动画 | Embedding | 文本变成向量。"意思相近"变成"向量距离近"。但向量不等于理解。 |
| 2 | 向量数据库节点 + ANN 索引 | 向量检索 | ANN 索引用精度换速度。为什么不能用 B-tree？因为高维空间没有"顺序"。 |
| 3 | RAG 链路动画（查询 → 召回 → 生成） | RAG | 检索增强生成。但 RAG 不只是"找文档喂给 LLM"——还需要分块、权限、重排、评测。 |
| 4 | 图数据库节点 + 关系网络 | 图模型 | 节点 + 边 + 属性。为什么关系数据库做不了"3 跳关联查询"？ |
| 5 | GraphRAG 链路 | 知识图谱 + GraphRAG | 结构化知识 + 非结构化检索结合。什么时候用 RAG，什么时候用 GraphRAG？ |

**验收**: 能搭一个最小 RAG，能解释"向量检索不能替代 SQL"。

### M5: 把所有数据管起来 — 湖仓 + 数据治理

**入口问题**: "你有 5 个数据库、3 个文件系统、2 个向量库，但没人知道数据从哪来、到哪去、谁有权看、质量是否可靠。"

**节点**: 对象存储 → Iceberg → Catalog + 元数据 + 血缘 + 质量

| 步骤 | 新增 | 机制焦点 | 解释 |
|------|------|---------|------|
| 1 | 对象存储节点（MinIO/S3） | 对象存储 | 为什么湖仓要建在对象存储上？便宜、解耦、但不支持事务。 |
| 2 | Iceberg 表格式节点 | 表格式 | Parquet 是文件格式，Iceberg 是表格式。表格式解决了什么？ACID、演化、时间旅行。 |
| 3 | Catalog + 多引擎节点 | Catalog | Trino 读、Spark 写、Flink 流式写——同一个表，多个引擎。Catalog 做什么？ |
| 4 | 元数据 + 血缘节点 | 数据血缘 | 这列数据从哪来？经过了什么转换？血缘不是文档，是可追溯的记录。 |
| 5 | 数据质量 + 权限节点 | 数据治理 | 治理不是管控，是信任。质量规则、权限策略、指标口径管理。 |

**验收**: 能画出数据血缘图，能解释"数据治理不是管控而是信任"。

### M6: 组装成智能数据平台 — 全链路整合 + 迁移学习

**入口问题**: "现在把 M1-M5 学到的所有系统组装起来——从用户下单到 RAG 检索，数据经历了什么？"

**节点**: 全部 M1-M5 的节点组合，展示完整链路

| 步骤 | 新增 | 机制焦点 | 解释 |
|------|------|---------|------|
| 1 | 显示 M1-M5 的全部节点（回顾） | 系统全景 | 18 个节点，30+ 条边。每个节点解决什么问题？删掉它会怎样？ |
| 2 | 端到端数据流（下单 → 数仓 → 报表） | 业务数据链路 | 一笔订单从 PostgreSQL 到 BI 看板，经过了哪些系统？ |
| 3 | AI 数据流（文档 → Embedding → RAG） | AI 数据链路 | 一个知识查询从向量检索到生成回答，需要什么基础设施？ |
| 4 | 迁移场景对比 | 迁移学习 | 同样的机制如何用在 coding/agent/Dify/skills 场景？ |
| 5 | 能力闭环 | 最终验证 | 从"会查数据"到"能设计智能数据系统"。你还缺什么？ |

**验收**: 能把 M1-M5 的能力迁移到一个自己的项目里。

---

## 6. Validation Criteria

### 每个 Milestone 的验收标准

| 里程碑 | 通过标准 |
|--------|---------|
| M1 | 能解释"为什么索引加速查询但有写入代价"；能说出"什么时候应该分区" |
| M2 | 能画出星型模型；能解释"为什么不能直接在业务库上跑分析" |
| M3 | 能解释 Spark 和 Flink 的分工；能说出"流处理和批处理不是速度差异而是语义差异" |
| M4 | 能搭一个最小 RAG；能解释"向量检索不能替代 SQL" |
| M5 | 能画出数据血缘图；能解释"数据治理不是管控而是信任" |
| M6 | 能把 M1-M5 的能力迁移到自己的项目 |

### 实现验收标准

- [ ] 所有 6 个里程碑的 JSON 配置文件可被组件正确渲染
- [ ] 每个里程碑的 3-5 个步骤可以逐步点击播放
- [ ] 数据流动画流畅（60fps，无卡顿）
- [ ] 移动端布局正常（无溢出、无重叠）
- [ ] 暗色/亮色主题切换正常
- [ ] VitePress build 不报错（SSR 防护生效）
- [ ] 组件 bundle size < 10KB（不含 JSON 数据）

---

## 7. Constraints

1. **无外部动画库** — 只用 CSS transitions + Vue `<TransitionGroup>` + SVG `stroke-dashoffset`
2. **无真实数据库连接** — 所有数据都是模拟的，写在 JSON 配置中
3. **渐进可组合** — M6 的 JSON 复用 M1-M5 的节点 ID，新步骤只新增节点/边
4. **轻量可视化** — 每步 3-5 个交互步骤，不做自由探索式模拟
5. **与现有代码一致** — 注册模式与 Mermaid.vue / GlossaryTerm.vue 一致

---

## 8. Out of Scope（不做清单）

- 不做真实 SQL 执行环境（不是 SQL 编辑器）
- 不做用户账号 / 学习进度持久化
- 不做闯关/积分/游戏化机制
- 不做服务端渲染的动态内容（纯静态 JSON）
- 不做视频 / 音频嵌入
- 不做外部 LLM API 调用
- 不做 SEO 优化（模拟器内容在 ClientOnly 内，不参与 SSG）

---

## 9. Implementation Phasing

### Phase 1: M1 MVP

- 实现 `DataFlowSimulator.vue` 核心组件
- 实现 M1 JSON 配置
- 创建 `site/learning-path.md` 页面
- 在 theme/index.ts 中注册组件
- 验收：M1 的 5 个步骤可以完整交互

### Phase 2: M1+M2 扩展

- 实现 M2 JSON 配置
- 优化动画性能和移动端适配
- 验收：M1+M2 形成完整的"单机到分析系统"故事线

### Phase 3: M3-M6 全量

- 实现 M3-M6 JSON 配置
- 添加里程碑导航（上一个/下一个）
- 完善节点详情面板
- 验收：全部 6 个里程碑可交互

---

## 10. Risks and Mitigations

| 风险 | 级别 | 缓解 |
|------|------|------|
| 动画变成装饰，不教机制 | 高 | 每个 step 强制有 `mechanismFocus` 字段，review 时检查 |
| 内容创作成本被低估 | 中 | JSON schema 先行，内容可以用 AI 辅助生成初稿 |
| 移动端 SVG 布局溢出 | 中 | 使用 viewBox + preserveAspectRatio，提前测试 |
| VitePress SSR 构建失败 | 低 | ClientOnly 包裹 + onMounted 守护，与 Mermaid.vue 模式一致 |
| 组件 bundle 过大 | 低 | 无外部依赖，JSON 按需 import |

---

## 11. Scout Feedback Resolution

| 来源 | 级别 | 反馈 | 处理 |
|------|------|------|------|
| CEO | Important | Scope inflated, 6 milestones is too much | 采用"设计全部，实现分批"策略 |
| CEO | Important | ROI depends on M1 proving value | Phase 1 只做 M1，可独立部署验证 |
| CEO | Suggestion | Narrative coherence > animation | 每个 step 有 mechanismFocus，不纯粹展示流动 |
| Eng | Important | SSR needs ClientOnly guard | 已写入约束，与 Mermaid.vue 模式一致 |
| Eng | Important | Content authoring is hidden cost | JSON schema 先行，AI 辅助初稿 |
| Eng | Important | Single component + JSON configs | 已采纳为架构决策 |
| Eng | Suggestion | Use TransitionGroup + CSS | 已采纳为约束 |
| Eng | Suggestion | Mobile layout needs decision | 已决定用 viewBox 自适应 |
