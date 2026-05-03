# 第 14 章：大数据方向项目实战

前面的章节建立了系统理解。

这一章把它们压成可执行项目。

## 问题切入

项目不是为了堆技术栈，而是验证一条完整路径：

```text
PostgreSQL 业务数据
  -> SQL 分析
  -> 数仓建模
  -> ETL / CDC
  -> OLAP / 批处理 / 实时处理
  -> 湖仓
  -> 向量检索 / 图关系分析
  -> 数据治理
```

如果只读概念，读者很容易产生错觉：知道 PostgreSQL、ClickHouse、Kafka、Flink、Iceberg、Milvus、Neo4j 的名字，就等于理解了数据系统。真正的能力要通过项目验证：

```text
能不能设计表结构？
能不能写出可解释 SQL？
能不能把数据从业务库同步到分析系统？
能不能处理失败、重跑、延迟和质量检查？
能不能说明每个组件为什么出现，以及不解决什么问题？
能不能把结构化分析、语义检索、关系网络和治理串起来？
```

## 核心判断

本章要建立的判断是：项目实战不是安装工具，而是验证数据从业务事实到分析资产、再到 AI 数据应用的完整迁移能力。

每个项目都必须交付可检查产物：架构图、数据模型、核心 SQL、数据链路、验收指标、运行说明和复盘记录。没有这些产物，项目只是 Demo，不是能力证明。

## 机制解释

七个项目按系统演化顺序排列：

```text
PostgreSQL 分析库
  -> PostgreSQL 到 OLAP
  -> CDC 实时数仓
  -> Mini Lakehouse
  -> RAG 向量知识库
  -> 知识图谱与 GraphRAG
  -> 数据治理 Mini Platform
```

它们分别验证不同能力：

| 项目 | 验证能力 |
| --- | --- |
| 项目 1 | PostgreSQL、SQL、指标口径、大表直觉 |
| 项目 2 | OLTP/OLAP 分离、列式分析、宽表和汇总 |
| 项目 3 | CDC、Kafka、Flink、实时窗口和状态 |
| 项目 4 | 对象存储、Parquet、Iceberg、Catalog、多引擎 |
| 项目 5 | 文档、chunk、embedding、向量检索、RAG 评测 |
| 项目 6 | 实体、关系、路径、图算法、GraphRAG |
| 项目 7 | 元数据、血缘、质量、权限、指标和知识治理 |

### 项目 1：PostgreSQL 电商数据分析库

目标：用 PostgreSQL 练 SQL 分析和数据库直觉。

数据表：

```text
users
products
orders
order_items
payments
events
```

核心指标：

- GMV。
- 订单数。
- 客单价。
- 复购率。
- 留存。
- 转化。

技术点：

- JOIN。
- GROUP BY。
- 窗口函数。
- 分区。
- 物化视图。
- EXPLAIN。

验收标准：

- 能设计表结构和主外键。
- 能写 20 条以上分析 SQL。
- 能解释每个指标口径。
- 能用 `EXPLAIN` 判断至少 3 条慢查询。
- 能为大表设计一个分区方案。

### 项目 2：PostgreSQL -> ClickHouse 分析链路

目标：理解 OLTP / OLAP 分离。

架构：

```text
PostgreSQL
  -> 数据同步
  -> ClickHouse
  -> BI
```

技术点：

- 列式存储。
- MergeTree。
- 分区。
- 排序键。
- 物化视图。
- 大宽表建模。

验收标准：

- 能说明哪些查询留在 PostgreSQL。
- 能说明哪些查询进入 ClickHouse。
- 能设计 ClickHouse 明细表。
- 能设计每日 GMV 汇总表。
- 能解释排序键和分区键选择。

### 项目 3：PostgreSQL CDC 实时数仓 Demo

目标：理解 CDC / Kafka / Flink。

架构：

```text
PostgreSQL
  -> Debezium
  -> Kafka
  -> Flink
  -> ClickHouse / Doris
```

技术点：

- WAL。
- Kafka Topic。
- Flink Window。
- State。
- Checkpoint。
- Event Time。
- Watermark。

验收标准：

- 能捕获订单状态变更。
- 能把变更写入 Kafka。
- 能用 Flink 计算实时订单数和 GMV。
- 能解释迟到数据处理方式。
- 能说明 Exactly Once 的边界。

### 项目 4：Mini Lakehouse

目标：理解对象存储 / Parquet / Iceberg。

架构：

```text
PostgreSQL
  -> Airbyte
  -> MinIO
  -> Parquet
  -> Iceberg
  -> Trino / Spark
```

技术点：

- Object Storage。
- File Format。
- Table Format。
- Catalog。
- 分区。
- 多引擎查询。

验收标准：

- 能把 PostgreSQL 表同步到对象存储。
- 能以 Parquet 保存数据。
- 能注册 Iceberg 表。
- 能用 Trino 查询。
- 能用 Spark 做批处理转换。
- 能解释文件格式和表格式的区别。

### 项目 5：RAG 向量知识库

目标：理解向量数据库在 AI 数据系统中的作用。

架构：

```text
PostgreSQL 元数据
  -> 文档解析
  -> Chunk
  -> Embedding
  -> Milvus / pgvector
  -> Rerank
  -> LLM
```

数据表：

```text
documents
chunks
embeddings
collections
retrieval_logs
evaluations
```

技术点：

- Embedding。
- Vector Search。
- Metadata Filter。
- Hybrid Search。
- RAG Evaluation。

验收标准：

- 能保存文档、Chunk 和向量版本。
- 能按权限过滤检索范围。
- 能记录召回日志。
- 能设计评测集。
- 能解释 pgvector 和 Milvus / Qdrant 的边界。

### 项目 6：知识图谱与 GraphRAG

目标：理解图数据库在关系分析和 AI 检索中的作用。

架构：

```text
PostgreSQL / 文档
  -> 实体抽取
  -> 关系抽取
  -> Neo4j / NebulaGraph
  -> GraphRAG
```

数据对象：

```text
entities
relations
triples
ontology
graph_paths
graph_queries
```

技术点：

- Cypher。
- 实体关系建模。
- 路径查询。
- 图算法。
- GraphRAG。

验收标准：

- 能定义实体类型和关系类型。
- 能从业务表或文档构建图。
- 能写多跳查询。
- 能说明图和向量如何结合。
- 能记录图谱版本和查询日志。

### 项目 7：数据治理 Mini Platform

目标：管理元数据、指标口径、血缘、质量。

模块：

```text
表目录
字段目录
指标字典
任务列表
血缘图
质量规则
权限策略
RAG 评测
```

技术点：

- PostgreSQL 元数据存储。
- dbt metadata。
- Great Expectations。
- Airflow DAG。
- 血缘关系建模。
- 指标版本管理。

验收标准：

- 能记录表、字段、指标和负责人。
- 能表达任务依赖和表级血缘。
- 能运行基础质量规则。
- 能记录指标版本。
- 能把权限扩展到 SQL、向量和图数据。

## 系统位置

项目实战是从“知识理解”到“系统构建”的转换层。

它把前面章节串成闭环：

```text
第 1-3 章：PostgreSQL 与 SQL 基础
第 4-6 章：OLTP/OLAP、数仓、ETL
第 7-9 章：批处理、实时处理、OLAP 查询服务
第 10-13 章：向量、图、湖仓、治理
```

如果读者只完成项目 1-2，说明已经能从业务库走向分析库；完成项目 3-4，说明具备批流和湖仓基础；完成项目 5-7，说明能把 AI 数据系统和治理纳入统一平台。

## 场景案例

一个完整的毕业项目可以是“智能电商数据平台”：

```text
PostgreSQL 保存用户、商品、订单、支付和事件。
ClickHouse 承载经营看板和多维分析。
Kafka / Flink 生成实时订单监控。
MinIO / Iceberg 保存长期历史明细、日志和 AI 中间产物。
pgvector / Milvus 构建商品和客服文档 RAG。
Neo4j / NebulaGraph 构建用户、商品、类目、行为关系图。
治理平台统一管理表、字段、指标、血缘、权限和评测。
```

这个项目不是要求一口气做完全部工程，而是让每个阶段都有清晰产物。最终读者应该能解释：哪些数据留在 PostgreSQL，哪些进入 OLAP，哪些进入湖仓，哪些进入向量库，哪些进入图数据库，哪些规则由治理平台统一控制。

## 常见误区

**误区一：项目越大越能证明能力。**

初学阶段更重要的是闭环完整、边界清楚、验证明确。一个能跑通、能解释、能复盘的小项目，比一个堆满工具但无法验证的数据平台更有价值。

**误区二：只要工具启动成功，项目就完成了。**

工具启动只是环境准备。项目完成要看数据是否流动、模型是否清楚、指标是否可信、失败是否能恢复、结果是否能验证。

**误区三：AI 项目可以跳过数据平台基础。**

RAG、GraphRAG 和智能数据应用仍然依赖文档、元数据、权限、日志、评测和治理。跳过数据平台基础，AI 应用很难长期可信。

**误区四：项目不需要写复盘。**

复盘记录能说明每个组件解决什么、不解决什么、遇到什么故障、如何验证和如何扩展。它是从 Demo 走向工程能力的关键。

## 实战任务

选择一个项目作为当前阶段主项目，并为它写一份项目计划。

计划必须包含：

- 问题背景。
- 数据源。
- 架构图。
- 数据模型。
- 核心任务。
- 验收指标。
- 运行命令。
- 质量检查。
- 权限和治理边界。
- 复盘问题。

推荐顺序是：

```text
项目 1
  -> 项目 2
  -> 项目 3
  -> 项目 4
  -> 项目 5
  -> 项目 6
  -> 项目 7
```

这个顺序从单机数据库开始，到 OLAP，再到实时，再到湖仓，再到 AI 检索和治理。

不要一开始就追求全量平台。

每个项目都应该交付：

- 架构图。
- 数据模型。
- 核心 SQL。
- 数据链路。
- 验收指标。
- 常见问题记录。

不要一开始就追求全量平台。每个项目都应该先形成最小闭环，再逐步扩展。

## 小结引出下一章

项目实战的目标不是证明“我会装工具”，而是证明你能把数据从业务库带到分析系统，再带到 AI 应用，并且知道每一层的边界、代价和治理要求。

下一章进入推荐学习顺序。

因为项目可以并行延展，但学习不能乱跳。读者需要知道应该先补哪一层能力，再进入下一层系统。
