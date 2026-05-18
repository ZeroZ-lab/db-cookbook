# Learning Path Simulator — Design

**status**: final
**created**: 2026-05-18
**artifact_type**: interactive-vue-component (software + UI)
**user-selection**: M1-M2 水平流水线 + M3-M6 中心扩散，分段切换

---

## Design References

### Best-Practice Scan

| 来源层 | 来源 | 模式 | 结论 |
|--------|------|------|------|
| Local Project | Mermaid.vue | 懒加载 + dark mode 感知 | **Adopt** — DataFlowSimulator 用同样模式 |
| Local Project | GlossaryTerm.vue | `<Transition>` + hover tooltip | **Adopt** — 节点详情用同样动画模式 |
| Enterprise Product | Airflow DAG UI | 左到右流程图 + 颜色编码状态 | **Pattern** — 数据流方向可视化 |
| Enterprise Product | dbt docs | 可点击节点展开 SQL | **Pattern** — 点击节点显示详情 |
| Official System | VitePress `<ClientOnly>` | SSR 防护 | **Adopt** — 必须包裹组件 |
| Method | Cognitive Load Theory | 4-7 chunks，渐进披露 | **Adopt** — 每步只新增 1-2 个元素 |
| Method | prefers-reduced-motion | 无障碍要求 | **Adopt** — CSS media query 暂停动画 |
| Anti-pattern | Canvas-based rendering | 不可访问、不可打印 | **Reject** |
| Anti-pattern | D3/Cytoscape/React Flow | 包体积膨胀 | **Reject** |
| Anti-pattern | GSAP/anime.js/Lottie | CSS 能覆盖所有需求 | **Reject** |
| Anti-pattern | 自动播放长动画 | 学习者无法暂停思考 | **Reject** — 用"下一步"按钮控制 |

### Pattern Synthesis

1. **SVG + CSS 动画**足够：`stroke-dasharray` 做流动箭头，`offset-path` 做粒子效果，`<Transition>` 做面板动画
2. **渐进披露三档**：全览图 → 点击节点看说明 → 点击"下一步"看数据流动画
3. **用户控制节奏**：不自动播放，每步需要用户点击"下一步"
4. **复用现有模式**：懒加载、dark mode、ClientOnly 与 Mermaid.vue 一致

### Adopt / Reject Summary

| 决策 | 理由 |
|------|------|
| SVG 内联渲染 | 可访问、可打印、CSS 可动画、无依赖 |
| CSS `stroke-dasharray` + `offset-distance` | 纯 CSS 流动动画，~10 行代码 |
| Vue `<TransitionGroup>` | 节点/边逐步出现，与 GlossaryTerm.vue 一致 |
| `<ClientOnly>` 包裹 | VitePress SSR 防护，官方推荐 |
| `prefers-reduced-motion` | 无障碍必须 |
| 拒绝外部动画库 | CSS + Vue 内建能力完全够用 |
| 拒绝自动播放 | 学习者需要控制节奏 |

---

## Design Alternatives

### Alternative A: 水平流水线（Left-to-Right Pipeline）

```
┌─────────────────────────────────────────────────────────────────┐
│  M1: 一张表的故事                                                │
│                                                                 │
│  ┌──────────┐   ─ ─ ▶   ┌──────────┐   ─ ─ ▶   ┌──────────┐  │
│  │PostgreSQL│            │  查询引擎  │            │  结果集   │  │
│  │ orders   │            │  扫描/过滤 │            │  返回     │  │
│  └──────────┘            └──────────┘            └──────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 步骤 2/5: 全表扫描                                       │   │
│  │                                                          │   │
│  │ 没有 INDEX 时，数据库逐行检查 100 万行。                  │   │
│  │ 这就是 O(n) 的全表扫描。                                  │   │
│  │                                                          │   │
│  │ 💡 机制焦点：为什么索引把 O(n) 变成 O(log n)？           │   │
│  │                                      [◀ 上一步] [下一步 ▶]│   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ● ○ ○ ○ ○  步骤进度                                           │
└─────────────────────────────────────────────────────────────────┘
```

**特点**：
- 节点从左到右排列，模拟数据流方向
- 每步从左侧"推入"新节点
- 解释面板在画布下方

**优点**：直觉性强，数据流方向明确，与 Airflow/dbt 等工具一致
**缺点**：M3+ 有 6+ 节点时水平空间不足，移动端需要缩小或横滚
**适用**：M1-M2（节点少，流向简单）

---

### Alternative B: 分层架构（Top-Down Layered）

```
┌─────────────────────────────────────────────────────────────────┐
│  M3: 一台机器装不下                                              │
│                                                                 │
│  ┌─── 源系统层 ──────────────────────────────────────────────┐  │
│  │  ┌──────────┐                                             │  │
│  │  │PostgreSQL│                                             │  │
│  │  └──────────┘                                             │  │
│  └───────────────────────────────────────────────────────────┘  │
│       │                                                         │
│       ▼ CDC                                                     │
│  ┌─── 传输层 ────────────────────────────────────────────────┐  │
│  │  ┌──────────┐                                             │  │
│  │  │  Kafka   │                                             │  │
│  │  └──────────┘                                             │  │
│  └───────────────────────────────────────────────────────────┘  │
│       │                                                         │
│       ▼                                                         │
│  ┌─── 计算层 ────────────────────────────────────────────────┐  │
│  │  ┌──────┐    ┌──────┐    ┌──────┐                         │  │
│  │  │Flink │    │Spark │    │Trino │                         │  │
│  │  └──────┘    └──────┘    └──────┘                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│       │                                                         │
│       ▼                                                         │
│  ┌─── 服务层 ────────────────────────────────────────────────┐  │
│  │  ┌────────────┐                                           │  │
│  │  │ ClickHouse │                                           │  │
│  │  └────────────┘                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 步骤 2/5: 事件流                                          │   │
│  │ 数据不是"拉"的，而是"推"的...                    [下一步 ▶]│   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**特点**：
- 节点按系统层级从上到下排列（源系统→传输→计算→服务）
- 每步在对应层级中添加新节点
- 解释面板在画布下方

**优点**：层级清晰，展示架构分层，纵向扩展性好，移动端友好
**缺点**：不直观展示数据"流向"，层间关系需要额外标注
**适用**：M3-M6（节点多，分层明显）

---

### Alternative C: 中心扩散（Center-Out Radial）

```
┌─────────────────────────────────────────────────────────────────┐
│  M4: 表之外还有世界                                              │
│                                                                 │
│              ┌──────────┐                                       │
│              │ Embedding │                                      │
│              │  服务     │                                      │
│              └──────────┘                                       │
│                   │                                              │
│                   ▼                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                  │
│  │ 图数据库  │◀──│PostgreSQL│──▶│向量数据库 │                  │
│  │ Neo4j    │    │ orders   │    │ Milvus   │                  │
│  └──────────┘    └──────────┘    └──────────┘                   │
│                      │                                           │
│                      ▼                                           │
│              ┌──────────┐                                       │
│              │  RAG 检索 │                                      │
│              │  服务     │                                      │
│              └──────────┘                                       │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 步骤 3/5: RAG 链路                                       │   │
│  │ 查询 → 召回 → 重排 → 生成...                   [下一步 ▶]│   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**特点**：
- PostgreSQL 始终在中心，新系统围绕它出现
- 每步从中心向外辐射新节点
- 视觉叙事："一张表如何扩展成整个数据平台"

**优点**：叙事性最强，完美匹配"一表到底"主题，M6 自然形成全景图
**缺点**：节点多时布局复杂，自动定位算法需要处理重叠
**适用**：全部里程碑（叙事一致性最好）

---

## 步骤状态机

```
                    ┌──────────────────────────────────────────┐
                    │                                          │
  ┌─────┐   click   │  ┌─────┐    click    ┌─────┐   click    │  ┌──────────┐
  │  0  │ ────────▶ │  │  1  │ ─────────▶ │  2  │ ────────▶  │  │ complete │
  │init │  next     │  │     │   next      │     │   next     │  │          │
  └─────┘          │  └──┬──┘             └──┬──┘            │  └────┬─────┘
                    │     │                   │                │       │
                    │  ◀──┘               ◀──┘                │  验收问题
                    │  click prev         click prev           │  + 下一里程碑
                    └──────────────────────────────────────────┘
```

**状态定义：**

| 状态 | 可见节点 | 可见边 | 说明 |
|------|---------|--------|------|
| `init` (步骤 0) | `steps[0].showNodes` | `steps[0].showEdges` | 初始状态：显示第一步的节点和边 |
| `step-n` (步骤 1..N-2) | 累积所有 `steps[0..n].showNodes` | 累积所有 `steps[0..n].showEdges` | 每步新增节点/边，不隐藏已有的 |
| `complete` (步骤 N-1) | 全部节点 | 全部边 | 显示验收问题 + 下一里程碑入口 |

**规则：**
- 每步只新增 1-2 个节点和 1-2 条边（Cognitive Load Theory 约束）
- 节点/边一旦出现就不会隐藏（渐进可组合原则）
- 高亮（`highlightNodes` / `highlightEdges`）只作用于当前步骤关注的元素
- 用户可点击"上一步"回到之前的状态（高亮变化，但已出现的节点不消失）
- 初始状态不是空画布，而是显示第一步的节点（避免空白冷启动）

**节点详情面板内容模型：**

```typescript
interface NodeDetail {
  title: string            // "PostgreSQL"
  solves: string           // "解决：结构化数据的存储、查询和事务"
  notSolves: string        // "不解决：海量数据的分布式分析"
  keyParams: string[]      // ["WAL、MVCC、B-tree、分区"]
  relatedChapter: string   // "第 1 章"
}
```

### 1. 布局方向（已确认）

**分段切换策略：**
- **M1-M2**: 水平流水线（Alternative A）— 节点少，数据流方向直觉明确
- **M3-M6**: 中心扩散（Alternative C）— PostgreSQL 居中，新系统向外辐射，叙事一致

**布局选择证据**：
- 线性数据流（M1-M2 只有 2-4 个节点）→ 水平流水线是行业标准（Airflow、dbt docs、Kafka UI）
- Hub-and-spoke 拓扑（M3-M6 有 5+ 节点，PG 为公共源）→ 中心扩散对应 hub-and-spoke 模式（D3/Vega 文献）
- 切换点在 M2→M3 恰好对应"单机→分布式"的系统分化边界，布局变化强化叙事转折

切换逻辑：JSON 配置中的 `layout` 字段控制布局引擎：
```typescript
layout: "horizontal" | "radial"
```

组件内部根据 `layout` 选择不同的 SVG 定位算法。

### 2. 节点视觉样式

两种布局共享统一的节点样式（视觉锚点），确保切换时不像两个不同组件：

```
┌────────────────────┐
│ 🐘  PostgreSQL     │  ← 图标 + 系统名（统一字号 14px）
│ orders 表          │  ← 副标题（统一字号 12px）
└────────────────────┘
```

共享视觉锚点：
- **节点尺寸**：统一 `width: 120, height: 56`（JSON 可覆盖）
- **圆角**：统一 `border-radius: 8px`
- **边框**：2px solid，颜色取自 CSS 变量
- **填充**：对应颜色的 10% 透明度
- **字体**：与 VitePress 正文一致
- **选中态**：边框加粗至 3px + `box-shadow: 0 0 0 3px {color}33`
- **图例**：每个里程碑底部显示颜色图例（源系统=蓝、计算=琥珀 等）

### 3. 边动画样式

```css
/* 数据流动画 — stroke-dasharray */
.flow-edge {
  stroke-dasharray: 8 4;
  animation: flow 2s linear infinite;
}
@keyframes flow {
  to { stroke-dashoffset: -24; }
}

/* 高亮边 — 步骤激活 */
.flow-edge.active {
  stroke-width: 3;
  stroke: var(--vp-c-brand-1);
}
```

- 普通边：灰色虚线
- 激活边：品牌色 + 流动动画
- 边标签：ETL / CDC / Sync 等文字

### 4. 步骤面板

- 固定在画布下方
- 包含：步骤标题 + 机制解释 + 机制焦点提示 + 导航按钮
- 机制焦点用品牌色高亮（如 💡 标记）
- Markdown 支持的格式（加粗、代码块）
- 步骤按钮文案："◀ 上一步" / "下一步 ▶"，最后一步改为"查看验收"

### 5. 进度指示

```
● ● ○ ○ ○   2/5
```
- 圆点进度条
- 当前步骤高亮
- 可点击已完成步骤跳转

### 6. 节点详情面板

点击节点时展开：
- 右侧滑入面板（桌面端）或底部弹出面板（移动端）
- 包含：系统名称、解决什么问题、不解决什么问题、关键参数
- 与 GlossaryTerm tooltip 模式一致但更大

### 7. 颜色 Token

```css
:root {
  /* 节点颜色 — 按系统类型 */
  --dfs-node-source: #3b82f6;      /* 蓝色 — 源系统 (PostgreSQL) */
  --dfs-node-transport: #8b5cf6;   /* 紫色 — 传输层 (Kafka) */
  --dfs-node-compute: #f59e0b;     /* 琥珀色 — 计算层 (Spark/Flink) */
  --dfs-node-storage: #10b981;     /* 绿色 — 存储层 (ClickHouse) */
  --dfs-node-ai: #ec4899;          /* 粉色 — AI 层 (向量/图) */
  --dfs-node-governance: #6366f1;  /* 靛蓝 — 治理层 */

  /* 边颜色 */
  --dfs-edge-default: #94a3b8;     /* 灰色 — 默认边 */
  --dfs-edge-active: var(--vp-c-brand-1);  /* 品牌色 — 激活边 */

  /* 面板 */
  --dfs-panel-bg: var(--vp-c-bg-soft);
  --dfs-panel-border: var(--vp-c-divider);
}

/* 暗色模式自动跟随 VitePress */
```

### 8. 响应式策略

| 断点 | 行为 |
|------|------|
| ≥ 960px (桌面) | 画布宽度 100%，解释面板在下方，节点详情右侧滑入 |
| 640-959px (平板) | 画布宽度 100%，SVG viewBox 自适应，节点详情底部弹出 |
| < 640px (手机) | 画布宽度 100%，节点更紧凑，解释面板可折叠，节点详情全屏弹出 |

> **注意**：SVG 使用 `preserveAspectRatio="xMidYMid meet"`。在窄屏下可能产生上下留白——这是可接受的，因为它保证了节点可读性。不使用 `xMidYMin` 因为垂直裁剪会隐藏底部节点。radial 模式下标签在小屏幕可能重叠——通过缩小字号（12px → 10px）和增加节点间距缓解。

### 9. 无障碍

- 所有节点有 `role="button"` + `aria-label`
- 步骤按钮有 `aria-label="下一步"` / `aria-label="上一步"`
- `prefers-reduced-motion: reduce` 时禁用所有流动动画
- 解释面板内容可通过键盘 Tab 导航
- 颜色对比度 ≥ 4.5:1（WCAG AA）

---

## 不做清单

- 不做拖拽节点/边的编辑功能
- 不做缩放/平移画布
- 不做实时数据（所有数据硬编码在 JSON）
- 不做用户登录/进度保存
- 不做视频/音频
- 不做暗色模式以外的主题切换
- 不做打印样式优化（模拟器本身不适合打印）

---

## Design Alternatives 对比

| 维度 | A: 水平流水线 | B: 分层架构 | C: 中心扩散 |
|------|:-:|:-:|:-:|
| 叙事一致性 | ★★★ | ★★★ | ★★★★★ |
| 数据流直觉 | ★★★★★ | ★★★ | ★★★★ |
| 扩展性（多节点）| ★★ | ★★★★★ | ★★★★ |
| 移动端友好 | ★★ | ★★★★ | ★★★ |
| 实现复杂度 | ★★★★★ (最简单) | ★★★★ | ★★★ |
| 与"一表到底"匹配 | ★★★ | ★★★ | ★★★★★ |

---

## Alternatives Considered

| 方向 | 结论 | 理由 |
|------|------|------|
| Alternative A: 水平流水线 | **M1-M2 采用** | 节点少时直觉最好，实现最简单 |
| Alternative B: 分层架构 | **未采用** | 用户未选择，但 JSON schema 支持未来扩展 |
| Alternative C: 中心扩散 | **M3-M6 采用** | 叙事性最强，多节点扩展性好 |
| 全程统一布局 | **未采用** | 用户选择分段切换 |

---

## JSON Schema 更新（布局字段）

```typescript
interface MilestoneConfig {
  id: string
  title: string
  subtitle: string
  layout: "horizontal" | "radial"          // 新增：布局引擎选择
  nodes: NodeConfig[]
  edges: EdgeConfig[]
  steps: StepConfig[]
  validationQuestion: string
  nextMilestone: string
}

// horizontal 模式：节点按 x 从左到右排列，x 坐标为绝对值
// radial 模式：节点按角度 + 距离排列，中心节点 x/y 为画布中心
interface NodeConfig {
  id: string
  label: string
  icon: string
  x: number                               // SVG viewBox 坐标
  y: number
  width: number
  height: number
  detail: string
  color: string
  isCenter?: boolean                       // radial 模式下标记中心节点
}
```

---

## Component 内部结构

```
DataFlowSimulator.vue
├── SVG Canvas (viewBox="0 0 800 400")
│   ├── <TransitionGroup> (edges)
│   │   └── <g class="flow-edge">
│   │       ├── <path> (边线 + stroke-dasharray 动画)
│   │       └── <text> (边标签)
│   └── <TransitionGroup> (nodes)
│       └── <g class="flow-node" @click="selectNode">
│           ├── <rect> (圆角矩形)
│           ├── <text> (图标 + 标签)
│           └── <text> (副标题)
├── Step Panel (div)
│   ├── 步骤标题
│   ├── 机制解释
│   ├── 机制焦点 (💡 品牌色高亮)
│   └── 导航按钮 (◀ 上一步 / 下一步 ▶)
├── Progress Bar (● ● ○ ○ ○)
└── Node Detail Panel (Transition)
    ├── 右侧滑入 (桌面端)
    └── 底部弹出 (移动端)
```
