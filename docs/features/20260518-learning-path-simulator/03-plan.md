# Learning Path Simulator — Plan

**status**: final
**created**: 2026-05-18
**artifact_type**: interactive-vue-component
**plan_topology**: gated-parallel
**estimated_size**: S

---

## Assumptions

1. VitePress 1.6.4 + Vue 3.5.33 环境不变，无需升级
2. 不引入新依赖（纯 CSS 动画 + Vue 内建能力）
3. JSON 配置中的节点坐标是手工设定的（不做自动布局算法）
4. 移动端测试通过浏览器 DevTools 模拟，不需要真机
5. 暗色模式继承 VitePress 现有 CSS 变量

---

## File Structure Map

| 操作 | 文件路径 | 说明 |
|------|---------|------|
| CREATE | `site/.vitepress/theme/components/DataFlowSimulator.vue` | 主组件 |
| CREATE | `site/.vitepress/theme/data/milestones/m1-postgresql.json` | M1 配置 |
| CREATE | `site/.vitepress/theme/data/milestones/m2-warehouse.json` | M2 配置 |
| CREATE | `site/.vitepress/theme/data/milestones/m3-batch-stream.json` | M3 配置 |
| CREATE | `site/.vitepress/theme/data/milestones/m4-ai-databases.json` | M4 配置 |
| CREATE | `site/.vitepress/theme/data/milestones/m5-lakehouse.json` | M5 配置 |
| CREATE | `site/.vitepress/theme/data/milestones/m6-full-platform.json` | M6 配置 |
| CREATE | `site/learning-path.md` | 学习路径页面 |
| MODIFY | `site/.vitepress/theme/index.ts` | 注册 DataFlowSimulator 组件 |
| MODIFY | `site/.vitepress/theme/custom.css` | 添加模拟器样式 |

---

## Gate 1: Core Component + M1 MVP

> 交付物：一个可交互的 M1 里程碑，用户可以逐步点击 5 个步骤，看到 PostgreSQL 节点、查询动画和机制解释。

### T1: 组件骨架 — SVG 画布 + Props + 状态机 + 类型定义

**依赖**: 无
**文件**: `site/.vitepress/theme/components/DataFlowSimulator.vue`
**parallel_safe**: false

**步骤**:
1. 创建 `DataFlowSimulator.vue`，定义 props 接口：
   ```typescript
   const props = defineProps<{ milestone: 1|2|3|4|5|6 }>()
   ```
2. 定义内部响应式状态：
   - `currentStep: Ref<number>` — 初始 0
   - `selectedNode: Ref<string|null>` — 初始 null
3. 加载 milestone 配置——使用 Vite 原生 `import.meta.glob`：
   ```typescript
   const configs = import.meta.glob<{ default: MilestoneConfig }>(
     '../data/milestones/*.json', { eager: true }
   )
   const config = computed(() => {
     const key = Object.keys(configs).find(k => k.includes(`m${props.milestone}-`))
     return key ? configs[key].default : null
   })
   ```
   此模式兼容 VitePress SSG 静态构建。
4. 定义计算属性：
   - `visibleNodes` — 累积 `steps[0..currentStep].showNodes` 对应的节点
   - `visibleEdges` — 累积 `steps[0..currentStep].showEdges` 对应的边
   - `currentStepConfig` — `steps[currentStep]`
   - `isComplete` — `currentStep === steps.length - 1`
5. 添加 SVG 画布 `<svg viewBox="0 0 800 400" preserveAspectRatio="xMidYMid meet">`
6. 状态机方法：`nextStep()`、`prevStep()`、`goToStep(n)`

**验收**: `pnpm docs:dev` 启动后，组件渲染空 SVG 画布（无节点），控制台无报错。
**验证**: `curl -s http://localhost:5173/learning-path | grep -c "dfs-container"` 返回 ≥ 1。

### T2: M1 JSON 配置

**依赖**: 无
**文件**: `site/.vitepress/theme/data/milestones/m1-postgresql.json`
**parallel_safe**: true（与 T1 并行）

**步骤**:
1. 按 spec 中 M1 定义创建 JSON 文件
2. 定义 5 个步骤，每步包含 `showNodes`、`showEdges`、`explanation`、`mechanismFocus`
3. `layout: "horizontal"`
4. 节点：PostgreSQL（含 orders 表子标签）、查询引擎、结果集、B-tree 索引、分区表
5. 边：扫描→过滤→返回、索引查找、分区路由
6. 坐标使用 SVG viewBox 绝对值（x: 0-800, y: 0-400）

**验收**: JSON 文件符合 MilestoneConfig schema，所有节点 ID 唯一，步骤引用的节点/边 ID 都存在。
**验证**: `node -e "const j=require('./site/.vitepress/theme/data/milestones/m1-postgresql.json'); console.assert(j.steps.length===5); console.assert(j.layout==='horizontal'); console.log('M1 JSON OK')"`

### T3: 水平布局 + 节点渲染

**依赖**: T1, T2
**文件**: `DataFlowSimulator.vue`（修改）
**parallel_safe**: false

**步骤**:
1. 在 SVG 内用 `<TransitionGroup>` 渲染 `visibleNodes`
2. 每个节点渲染为 `<g>` 包含 `<rect>` + `<text>`（图标 + 标签 + 副标题）
3. 节点样式：8px 圆角，2px 边框，颜色取自 node.color CSS 变量
4. 选中态：边框加粗至 3px + 阴影
5. 节点添加 `@click` 事件设置 `selectedNode`
6. `<TransitionGroup>` enter/leave 动画（fade + scale，300ms）

**验收**: M1 的节点能正确渲染在 SVG 中，点击节点能高亮，过渡动画流畅。
**验证**: 浏览器中看到 PostgreSQL、查询引擎、结果集 3 个节点（步骤 0 的 showNodes）。

### T4: 边渲染 + 流动动画

**依赖**: T3
**文件**: `DataFlowSimulator.vue`（修改）
**parallel_safe**: false

**步骤**:
1. 在 SVG 内用 `<TransitionGroup>` 渲染 `visibleEdges`
2. 每条边渲染为 `<path>`（from 节点右侧 → to 节点左侧，带曲线路径）
3. 边标签渲染为 `<text>` 居中于路径中点
4. 普通态：`stroke: var(--dfs-edge-default)`，虚线
5. 激活态（`highlightEdges` 包含时）：`stroke: var(--dfs-edge-active)` + `stroke-dasharray: 8 4` + flow 动画
6. 在组件 `<style>` 中定义 `@keyframes flow`：`stroke-dashoffset` 从 0 到 -24，2s 循环（放在 T4 而非 T7，确保边渲染自包含可验证）

**验收**: M1 的边能正确连接节点，激活边有流动动画，标签清晰可读。
**验证**: 浏览器中点击"下一步"到步骤 2，观察边是否出现流动动画。

### T5: 步骤面板 + 进度条

**依赖**: T4（边渲染完成后步骤面板才有完整的视觉上下文）
**文件**: `DataFlowSimulator.vue`（修改）
**parallel_safe**: false

**步骤**:
1. 在 SVG 下方添加步骤面板 `<div class="dfs-step-panel">`
2. 显示：步骤标题、机制解释（纯文本渲染，不用 v-html）、机制焦点（💡 品牌色高亮）
   - JSON 中的 explanation 存储纯文本，用 `white-space: pre-line` 保留换行
   - 如需富文本支持，在构建时预编译为安全 HTML（添加 Vite 插件或脚本）
3. 导航按钮："◀ 上一步" / "下一步 ▶"（最后一步改为"查看验收"）
4. 进度条：圆点 `● ○ ○ ○ ○`，已完成步骤可点击跳转
5. 验收问题：`isComplete` 时显示 `validationQuestion` + 下一里程碑入口
6. 面板过渡：`<Transition name="slide">` 200ms

**验收**: 用户能通过按钮逐步推进 M1 的 5 步，面板内容正确切换，进度条同步更新。
**验证**: 依次点击"下一步"5 次，确认进度条从 ● ○ ○ ○ ○ 变为 ● ● ● ● ●。

### T6: 节点详情面板

**依赖**: T5（步骤面板完成后添加节点交互）
**文件**: `DataFlowSimulator.vue`（修改）
**parallel_safe**: false

**步骤**:
1. 添加节点详情区块，使用 `<Transition name="slide-right">`
2. 桌面端：右侧滑入（`transform: translateX`）
3. 显示：节点名称、solves、notSolves、keyParams、relatedChapter
4. 关闭按钮 + 点击空白区域关闭
5. 点击其他节点时切换内容
6. 过渡 300ms

**验收**: 点击节点弹出详情面板，内容正确，关闭/切换正常。
**验证**: 点击 PostgreSQL 节点，确认显示"解决：结构化数据的存储、查询和事务"。

### T7: 注册组件 + 创建页面 + CSS

**依赖**: T6（节点详情面板完成后，组件功能完整）
**文件**: `site/.vitepress/theme/index.ts`（修改）, `site/learning-path.md`（创建）, `site/.vitepress/theme/custom.css`（修改）
**parallel_safe**: false

**步骤**:
1. 在 `theme/index.ts` 的 `enhanceApp` 中注册 `DataFlowSimulator`
2. 创建 `site/learning-path.md`：
   - frontmatter: `title: 渐进式学习路径`
   - 简介文字（兰迪·波许入口问题）
   - `<ClientOnly><DataFlowSimulator :milestone="1" /></ClientOnly>`（SSR 防护）
3. 在 `custom.css` 中添加：
   - `.dfs-*` 命名空间的组件样式
   - SVG 节点/边的 CSS 变量和动画（`@keyframes flow`）
   - 进度条样式
   - `prefers-reduced-motion: reduce` 媒体查询
   - 暗色模式变量（`html.dark` 选择器）
   - 6 类系统颜色 token：
     - `--dfs-node-source: #3b82f6`（源系统 PostgreSQL）
     - `--dfs-node-transport: #8b5cf6`（传输层 Kafka）
     - `--dfs-node-compute: #f59e0b`（计算层 Spark/Flink）
     - `--dfs-node-storage: #10b981`（存储层 ClickHouse）
     - `--dfs-node-ai: #ec4899`（AI 层 向量/图）
     - `--dfs-node-governance: #6366f1`（治理层）

**验收**: `pnpm docs:dev` 启动后访问 `/learning-path` 能看到 M1 模拟器完整工作。`pnpm docs:build` 不报错。
**验证**: `pnpm docs:build 2>&1 | grep -i error` 返回空。浏览器访问 `/learning-path` 显示 SVG 画布 + 步骤面板。

---

## Gate 1 Checkpoint

> **验证命令**: `pnpm docs:build && pnpm docs:dev`
> **验证标准**:
> - M1 的 5 个步骤可完整交互
> - 节点点击弹出详情
> - 边有流动动画
> - 步骤面板内容正确
> - 暗色/亮色切换正常
> - VitePress build 无报错

---

## Gate 2: M2 + Radial Layout Engine

### T8: M2 JSON 配置

**依赖**: T7（需要组件可渲染）
**文件**: `site/.vitepress/theme/data/milestones/m2-warehouse.json`
**parallel_safe**: false

**步骤**:
1. 按 spec 中 M2 定义创建 JSON
2. `layout: "horizontal"`
3. 节点：PostgreSQL、ETL、数仓（ClickHouse/Doris）、事实表、维度表
4. 5 个步骤：OLTP/OLAP 分化、ETL 同步、星型模型、分层模型、列式存储对比
5. 复用 M1 的 PostgreSQL 节点 ID（`pg-orders`），保持叙事连续

**验收**: M2 JSON 符合 schema，M1 的 PostgreSQL 节点被复用。
**验证**: `node -e "const j=require('./site/.vitepress/theme/data/milestones/m2-warehouse.json'); console.assert(j.layout==='horizontal'); console.assert(j.nodes.some(n=>n.id==='pg-orders')); console.log('M2 JSON OK')"`

### T9: 径向布局引擎

**依赖**: T7
**文件**: `DataFlowSimulator.vue`（修改）
**parallel_safe**: false

**步骤**:
1. 根据 `config.layout` 选择定位策略
2. `horizontal` 模式：使用 JSON 中的 x/y 坐标（已定义在 T2）
3. `radial` 模式：算法化计算坐标（忽略 JSON 中的 x/y）：
   - `isCenter` 节点定位在 viewBox 中心（400, 200）
   - 其余节点按节点数等分角度（0°~360°），半径 160
   - 避碰：最小角度间隔 30°，超出 10 个节点时减小半径并分层
   - 边路径改为曲线（贝塞尔控制点从中心向外）
4. T14 的 M6 验证命令增加碰撞检测：检查任意两节点 bbox 不重叠

**验收**: 切换到 `layout: "radial"` 时，节点正确围绕中心分布，无重叠。
**验证**: 用测试 JSON `{"layout":"radial","nodes":[{"id":"center","isCenter":true,...},{"id":"a","x":500,"y":200,...}]}` 验证渲染。

### T10: 里程碑导航

**依赖**: T8, T9
**文件**: `DataFlowSimulator.vue`（修改）, `site/learning-path.md`（修改）
**parallel_safe**: false

**步骤**:
1. 在页面中添加里程碑选择器（6 个标签页或步骤条）
2. 当前里程碑高亮
3. 完成验证问题后解锁下一里程碑（可点击）
4. `learning-path.md` 中为每个里程碑添加 `<DataFlowSimulator :milestone="N" />` 或使用动态切换
5. 每个里程碑之间添加过渡文字

**验收**: 能在 M1 和 M2 之间切换，M1 完成后 M2 可解锁。
**验证**: 浏览器中切换到 M2 标签，确认 M2 节点正确渲染。

---

## Gate 2 Checkpoint

> **验证命令**: `pnpm docs:build`
> **验证标准**:
> - M1+M2 都可交互
> - 水平和径向布局切换正常
> - 里程碑导航可用
> - Build 无报错

---

## Gate 3: M3-M6 Configs

### T11: M3 JSON 配置 — 批处理 + 流处理 + OLAP

**依赖**: T9
**文件**: `site/.vitepress/theme/data/milestones/m3-batch-stream.json`
**parallel_safe**: true

**步骤**:
1. `layout: "radial"`，PG 居中
2. 节点：PostgreSQL、Kafka、Flink、Spark、Trino、ClickHouse
3. 5 步：事件流、流处理、批处理、联邦查询、全链路
4. 边：PG→Kafka(CDC)、Kafka→Flink、Flink→CH、Spark→CH、Trino 查询

**验收**: JSON 符合 schema，节点不重叠。
**验证**: `node -e "const j=require('./site/.vitepress/theme/data/milestones/m3-batch-stream.json'); console.assert(j.layout==='radial'); console.assert(j.nodes.length>=5); console.log('M3 JSON OK')"`

**依赖**: T9
**文件**: `site/.vitepress/theme/data/milestones/m4-ai-databases.json`
**parallel_safe**: true

**步骤**:
1. `layout: "radial"`
2. 节点：PostgreSQL、Embedding 服务、向量数据库(Milvus)、图数据库(Neo4j)、RAG 服务
3. 5 步：Embedding、向量检索、RAG 链路、图模型、GraphRAG

**验收**: JSON 符合 schema。
**验证**: `node -e "const j=require('./site/.vitepress/theme/data/milestones/m4-ai-databases.json'); console.assert(j.layout==='radial'); console.log('M4 JSON OK')"`

**依赖**: T9
**文件**: `site/.vitepress/theme/data/milestones/m5-lakehouse.json`
**parallel_safe**: true

**步骤**:
1. `layout: "radial"`
2. 节点：对象存储(MinIO)、Iceberg、Catalog、元数据、血缘、质量
3. 5 步：对象存储、表格式、Catalog、血缘、治理

**验收**: JSON 符合 schema。
**验证**: `node -e "const j=require('./site/.vitepress/theme/data/milestones/m5-lakehouse.json'); console.assert(j.layout==='radial'); console.log('M5 JSON OK')"`

**依赖**: T11, T12, T13（需要所有前序里程碑的节点定义）
**文件**: `site/.vitepress/theme/data/milestones/m6-full-platform.json`
**parallel_safe**: false

**步骤**:
1. `layout: "radial"`，PG 居中
2. 复用 M1-M5 的所有节点 ID（`pg-orders`, `kafka`, `flink` 等）
3. 新增边：连接所有前序里程碑的节点
4. 5 步：系统全景、业务数据链路、AI 数据链路、迁移场景、能力闭环
5. 验收问题 + 最终能力总结

**验收**: M6 JSON 复用所有前序节点 ID，步骤覆盖全链路。
**验证**: `node -e "const m6=require('./site/.vitepress/theme/data/milestones/m6-full-platform.json'); const ids=new Set(m6.nodes.map(n=>n.id)); console.assert(ids.has('pg-orders'), 'missing pg-orders'); console.log('M6 JSON OK, nodes:', ids.size)"`

---

## Gate 3 Checkpoint

> **验证命令**: `pnpm docs:build`
> **验证标准**:
> - M1-M6 全部可交互
> - 所有里程碑导航正常
> - 节点详情面板内容正确
> - Build 无报错

---

## Gate 4: Polish

### T15: 响应式适配

**依赖**: T14
**文件**: `DataFlowSimulator.vue`, `custom.css`
**parallel_safe**: false

**步骤**:
1. 添加 CSS media query 断点：960px、640px
2. 桌面端（≥960px）：节点详情右侧滑入
3. 平板端（640-959px）：节点详情底部弹出
4. 手机端（<640px）：节点紧凑模式（字号 14→12，间距缩小），详情面板全屏弹出
5. SVG `viewBox` 保持 `preserveAspectRatio="xMidYMid meet"`
6. 测试：Chrome DevTools 模拟 375px、768px、1440px 宽度

**验收**: 三种断点下布局正确，无溢出、无重叠。

### T16: 无障碍 + prefers-reduced-motion

**依赖**: T15（响应式完成后在同一文件上追加无障碍）
**文件**: `DataFlowSimulator.vue`, `custom.css`
**parallel_safe**: false

**步骤**:
1. 节点 `<g>` 添加 `role="button"` + `aria-label="PostgreSQL 节点，点击查看详情"`
2. 步骤按钮添加 `aria-label="下一步"` / `aria-label="上一步"`
3. 详情面板添加 `role="dialog"` + `aria-modal="true"`
4. CSS `@media (prefers-reduced-motion: reduce)` 禁用所有 `animation` 和 `transition`
5. 颜色对比度检查：所有文本 ≥ 4.5:1（WCAG AA）
6. 键盘导航：Tab 可到达节点和按钮，Enter 可激活

**验收**: `prefers-reduced-motion` 开启时无动画，Tab 导航完整，对比度达标。
**验证**: Chrome DevTools → Rendering → 勾选 "Emulate CSS media: prefers-reduced-motion: reduce"，确认动画消失。

### T17: 构建验证 + 性能检查

**依赖**: T15, T16
**文件**: 无新文件
**parallel_safe**: false

**步骤**:
1. 运行 `pnpm docs:build` — 无错误
2. 检查组件 bundle size — 目标 < 10KB（gzip）
3. 检查 JSON 总大小 — 6 个文件 < 20KB
4. 暗色/亮色切换无闪烁
5. 页面首次加载 Lighthouse Performance ≥ 90
6. 检查 `pnpm verify` — 现有验证脚本不被破坏

**验收**: Build 成功，bundle size 达标，Lighthouse 达标。

---

## Gate 4 Checkpoint

> **验证命令**: `pnpm docs:build && pnpm verify`
> **验证标准**:
> - 全部 6 个里程碑可交互
> - 响应式三种断点正常
> - 无障碍通过
> - Build + verify 无报错
> - Bundle size < 10KB

---

## Dependency Graph

```
T1 ─┬─→ T3 ─→ T4 ─→ T5 ─→ T6 ─→ T7 ─→ T8 ──→ T10 ─→ T14 ─→ T15 ─→ T16 ─→ T17
    │                                    │                    T9 ─┘
T2 ─┘                                    └─→ T9 ───────────────┘
                                                              T11 ─┐
                                                              T12 ─┼─→ T14
                                                              T13 ─┘
```

## Parallel Safety

| 并行组 | 任务 | 说明 |
|--------|------|------|
| Group A | T1 ∥ T2 | 组件骨架(.vue) 与 JSON 配置(.json) 无文件冲突 |
| Group C | T11 ∥ T12 ∥ T13 | 三个不同 JSON 文件无依赖 |

> **注意**: T4→T5→T6 串行执行（同一 .vue 文件的 template 不同区块，顺序写入避免冲突）。
> T15→T16 串行执行（同一 .vue + .css 文件，先响应式再无障碍）。

---

## Spec Coverage Check

| Spec 需求 | 对应任务 | 说明 |
|-----------|---------|------|
| DataFlowSimulator.vue 组件 | T1, T3, T4, T5, T6, T9 | T1 定义骨架，T3-T6 实现各区块 |
| 6 个 JSON 配置 | T2, T8, T11, T12, T13, T14 | 每个 JSON 一个任务 |
| layout: horizontal/radial | T3(horizontal), T9(radial) | T3 实现水平，T9 追加径向 |
| ClientOnly 包裹 | T7 | learning-path.md 中用 `<ClientOnly>` 包裹 |
| CSS stroke-dasharray 动画 | T4(动画), T7(CSS) | T4 实现 SVG 动画，T7 添加 CSS keyframes |
| `<TransitionGroup>` | T3(节点), T4(边) | 节点和边的 enter/leave 动画 |
| 步骤状态机 | T1(定义), T5(面板) | T1 定义 nextStep/prevStep，T5 实现面板交互 |
| visibleNodes/visibleEdges | T1(computed) | 累积步骤 0..currentStep 的节点和边 |
| milestone prop | T1 | defineProps<{ milestone: 1\|2\|3\|4\|5\|6 }> |
| 节点详情面板 | T6 | 右侧滑入，显示 solves/notSolves |
| 进度条 | T5 | 圆点进度 + 可点击跳转 |
| 里程碑导航 | T10 | 6 个标签页切换 |
| 响应式（3 断点） | T15 | 960px / 640px / <640px |
| prefers-reduced-motion | T16 | CSS media query 禁用动画 |
| 颜色 Token（6 类系统） | T7 | CSS 变量，6 种颜色 |
| 暗色模式 | T7(CSS), T16(验证) | html.dark 选择器 |
| 无障碍（WCAG AA） | T16 | role/aria-label/keyboard/contrast |
| VitePress build 无错 | T7, T17 | ClientOnly SSR 防护 |
| Bundle size < 10KB | T17 | gzip 后检查 |
| learning-path.md 页面 | T7(创建), T10(导航) | |
