# 计划：补齐全部章节交互组件

## 假设

1. 每个章节加一个交互组件，放在该章最相关的 section 末尾（原则：读完概念立刻动手体验）
2. 组件复用同一个电商场景（users / orders / products），保持全书一致性
3. 组件技术栈：Vue 3 + SVG 动画 + VitePress CSS 变量，不引入额外 npm 依赖（sql.js 已有）
4. Ch00 / Ch01 / Ch15 是单页章节或元章节，不强制加交互；Ch16 / Ch17 是收尾总结，可选加轻量交互
5. 嵌入位置通过 `generate-site.mjs` 的 `interactiveEmbeds` 映射注入

## 组件清单（11 个新组件）

| # | 组件名 | 章节 | 嵌入位置 | 交互形式 | 说明 |
|---|--------|------|----------|----------|------|
| 1 | `SchemaExplorer` | Ch1 数据库基础 | 单页末尾 | 点击式表结构浏览 | 展示 users / orders / products 表的列、类型、约束、关系，点击切换表，高亮 FK 关联 |
| 2 | `IndexVisualizer` | Ch3 大表能力 | 3.5 索引基础 | 动画 | B-Tree 搜索动画：输入搜索值，展示树节点逐层对比过程，对比有/无索引的扫描行数 |
| 3 | `WorkloadToggle` | Ch4 OLTP vs OLAP | 4.3 OLTP本质 | 切换对比 | 左右对比面板：同一张 orders 表，左边走 OLTP 路径（行存 + 索引查单行），右边走 OLAP 路径（列存 + 全表聚合），动画展示数据读取方式差异 |
| 4 | `StarSchemaBuilder` | Ch5 数仓建模 | 5.5 分层模型 | 拖拽/点击 | 点击选择事实表 + 维度表，自动生成星型模型关系图（SVG），展示事实/维度、粒度、分层 |
| 5 | `SparkStageViewer` | Ch7 批处理 | 7.3 批处理核心技术 | 动画 | Spark Job → Stage → Task 动画：展示一个 GROUP BY 查询如何被拆分成 Map/Shuffle/Reduce 阶段，数据在节点间流转 |
| 6 | `QueryBench` | Ch9 OLAP | 9.3 OLAP查询优化 | 对比模拟 | 输入同一查询，对比"行存扫描"vs"列存+索引"的模拟耗时和扫描行数，展示向量化执行和稀疏索引效果 |
| 7 | `GraphTraverse` | Ch11 图数据库 | 11.3 图查询语言 | 动画 | 力导向图展示用户-商品-分类关系，点击节点高亮 N 跳邻居，模拟 Cypher MATCH 路径查询 |
| 8 | `LakehouseLayers` | Ch12 湖仓 | 12.3 对象存储与 Parquet | 动画 | 分层架构动画：数据从 PG 流入对象存储 → Parquet 文件 → Iceberg 表格式 → 多引擎查询，点击切换引擎查看执行路径 |
| 9 | `LineageGraph` | Ch13 数据治理 | 13.3 数据标准与规范 | SVG 交互 | 数据血缘图：展示表级和字段级血缘关系，点击节点高亮上下游链路，展示"变更影响分析" |
| 10 | `ProjectRoadmap` | Ch14 项目实战 | 14.1 概述 | 点击式 | 7 个项目的依赖路线图，点击项目查看技术栈、输入/输出、涉及章节，展示项目串联关系 |
| 11 | `SkillRadar` | Ch16 能力地图 | 16.1 概述 | SVG | 五维能力雷达图（SQL / 建模 / 链路 / 选型 / 治理），用户自评打分后可视化能力画像 |

## 执行计划

### Task 1: SchemaExplorer.vue (Ch1)
- 创建 `site/.vitepress/theme/components/SchemaExplorer.vue`
- 3 张表（users / orders / products）的结构展示
- 点击切换表，高亮外键关联
- 验收：组件渲染，点击切换正常

### Task 2: IndexVisualizer.vue (Ch3)
- 创建 `IndexVisualizer.vue`
- B-Tree 可视化：输入值 → 逐层节点高亮 → 找到/未找到
- 对比面板：索引扫描 vs 全表扫描的行数计数
- 验收：输入值后动画展示搜索路径

### Task 3: WorkloadToggle.vue (Ch4)
- 创建 `WorkloadToggle.vue`
- 左右对比：行存 vs 列存读取同一查询
- 动画展示行/列扫描差异
- 验收：切换 OLTP/OLAP 模式，动画展示数据读取差异

### Task 4: StarSchemaBuilder.vue (Ch5)
- 创建 `StarSchemaBuilder.vue`
- 点击选择事实表 + 维度表，自动连线生成星型图
- 展示粒度、分层标签
- 验收：选择表后自动生成 SVG 关系图

### Task 5: SparkStageViewer.vue (Ch7)
- 创建 `SparkStageViewer.vue`
- Job → Stage → Task 动画
- 展示 Shuffle 数据流转
- 验收：播放动画，展示 Map/Shuffle/Reduce 阶段

### Task 6: QueryBench.vue (Ch9)
- 创建 `QueryBench.vue`
- 模拟行存 vs 列存查询对比
- 展示扫描行数、耗时、内存占用差异
- 验收：选择查询后展示两种引擎对比结果

### Task 7: GraphTraverse.vue (Ch11)
- 创建 `GraphTraverse.vue`
- 力导向图（用户-商品-分类）
- 点击节点高亮 N 跳邻居
- 模拟 Cypher 查询结果
- 验收：节点可交互，路径高亮正常

### Task 8: LakehouseLayers.vue (Ch12)
- 创建 `LakehouseLayers.vue`
- 分层架构动画：PG → 对象存储 → Parquet → Iceberg → 多引擎
- 点击切换引擎（Spark / Trino / Flink）
- 验收：动画播放，引擎切换正常

### Task 9: LineageGraph.vue (Ch13)
- 创建 `LineageGraph.vue`
- 数据血缘 SVG 图
- 表级 + 字段级血缘
- 点击高亮上下游
- 验收：节点点击交互正常，上下游高亮

### Task 10: ProjectRoadmap.vue (Ch14)
- 创建 `ProjectRoadmap.vue`
- 7 个项目卡片 + 依赖连线
- 点击查看详情（技术栈、输入/输出）
- 验收：卡片可点击，依赖关系可视化

### Task 11: SkillRadar.vue (Ch16)
- 创建 `SkillRadar.vue`
- 五维雷达图（SVG）
- 滑块自评打分
- 验收：滑块调节后雷达图实时更新

### Task 12: 注册组件 + 更新嵌入映射
- 在 `theme/index.ts` 注册 11 个新组件
- 在 `generate-site.mjs` 的 `interactiveEmbeds` 添加映射
- 处理单页章节（Ch0、Ch1、Ch15）的嵌入方式（通过 `chapterIndexPage` 或单页模板）
- 验收：构建通过，所有组件出现在正确页面

### Task 13: 构建验证 + 交互测试
- `pnpm docs:build` 通过
- 逐一在 dev server 验证 15 个组件（4 已有 + 11 新建）渲染和交互
- 验收：构建无错误，所有组件可交互

## 依赖关系

```
Task 1~11: 可并行（组件互相独立）
Task 12: 依赖 Task 1~11 全部完成
Task 13: 依赖 Task 12
```

## 风险

1. **Ch0 / Ch1 / Ch15 是单页**：没有 section 拆分，嵌入方式需在 `chapterIndexPage` 或单页生成逻辑中处理
2. **组件体积**：11 个新组件会增加 bundle，但都是 SVG + CSS 动画，不引入额外依赖
3. **图遍历组件（Task 7）**：力导向布局较复杂，可能需要简化为固定位置布局
