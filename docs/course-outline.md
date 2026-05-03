# 以 PostgreSQL 为入口的大数据学习大纲

## 0. 核心定位

### PostgreSQL 的角色

PostgreSQL 不是普通业务库学习的终点，而是理解现代数据系统的训练场。

它在这条学习路线中承担四个角色：

- **数据库直觉训练场**：用它理解数据如何被组织、约束、查询和保持一致。
- **OLTP 到 OLAP 的桥梁**：先看到单机业务库的能力，再理解为什么分析系统会分化出来。
- **大数据链路的数据源**：在真实平台中，PostgreSQL 经常是业务事实、订单、用户、权限和元数据的源头。
- **AI 数据系统的基础组件**：它可以保存元数据、权限、任务状态，也可以通过 `pgvector` 承担中小规模语义检索。

### 总学习路线

1. PostgreSQL 基础。
2. SQL 分析能力。
3. 大表与查询优化。
4. OLTP vs OLAP。
5. 数仓建模。
6. ETL / ELT。
7. 批处理。
8. 实时数据处理。
9. OLAP 数据库。
10. 向量数据库。
11. 图数据库。
12. 数据湖 / 湖仓。
13. 数据治理。

### 最小闭环

最小可运行的数据系统闭环是：

```text
PostgreSQL 业务数据
  -> SQL 分析
  -> 数仓建模
  -> ETL / CDC
  -> ClickHouse / Spark / Flink
  -> 向量检索 / 图关系分析
  -> 指标、BI、RAG、GraphRAG 和数据应用
```

这个闭环的重点不是把所有工具都学一遍，而是理解数据如何从业务系统流向分析系统，再流向 AI 应用。

## 1. 数据库基础：用 PostgreSQL 建立数据系统直觉

### 学习目标

- 理解数据如何被组织。
- 理解查询如何被执行。
- 理解事务如何保证一致性。
- 理解单机数据库在大数据场景中的边界。

### PostgreSQL 核心结构

- PostgreSQL Server。
- Database。
- Schema。
- Table。
- Row。
- Column。

### 必学概念

- Database。
- Schema。
- Table。
- Row / Column。
- Primary Key。
- Foreign Key。
- Constraint。
- Transaction。
- Index。
- View。
- Materialized View。
- Partition。

### 关键问题

- 数据如何从业务对象变成表结构？
- 查询为什么会快或慢？
- 数据量变大后单机数据库为什么吃力？
- 为什么不能把所有分析任务压在业务库上？

## 2. SQL 分析能力：大数据方向第一硬技能

### 核心判断

SQL 是大数据系统的共同语言。PostgreSQL、Hive、Spark SQL、Trino、ClickHouse、Doris 都以 SQL 作为重要入口。大数据学习应先强化分析 SQL，而不是先背工具名。

### 2.1 基础查询

- `SELECT`。
- `WHERE`。
- `ORDER BY`。
- `LIMIT`。
- `DISTINCT`。
- `LIKE` / `ILIKE`。
- `IN`。
- `BETWEEN`。
- `NULL` 判断。

### 2.2 聚合分析

- `COUNT`。
- `SUM`。
- `AVG`。
- `MAX`。
- `MIN`。
- `GROUP BY`。
- `HAVING`。

### 2.3 多表关联

- `INNER JOIN`。
- `LEFT JOIN`。
- `RIGHT JOIN`。
- `FULL JOIN`。
- `CROSS JOIN`。
- `SELF JOIN`。

### 2.4 复杂分析 SQL

- Subquery。
- CTE。
- `CASE WHEN`。
- `UNION` / `UNION ALL`。
- `EXISTS` / `NOT EXISTS`。
- 临时表 / 中间结果。

### 2.5 窗口函数

- `ROW_NUMBER`。
- `RANK`。
- `DENSE_RANK`。
- `LAG`。
- `LEAD`。
- `FIRST_VALUE`。
- `LAST_VALUE`。
- `SUM() OVER`。
- `COUNT() OVER`。
- `AVG() OVER`。
- `PARTITION BY`。
- Window 内部 `ORDER BY`。

### 2.6 常见指标 SQL

- DAU / WAU / MAU。
- GMV。
- 客单价。
- 留存率。
- 转化率。
- 复购率。
- 漏斗分析。
- 路径分析。
- 排行榜。
- 同比。
- 环比。

### 阶段成果

- 能写复杂查询。
- 能写统计报表 SQL。
- 能写窗口函数分析。
- 能理解指标计算口径。
- 能迁移到 Spark SQL / Hive SQL / ClickHouse SQL。

## 3. PostgreSQL 大表能力：理解单机数据库边界

### 核心判断

大数据不是一开始就分布式。很多大数据系统问题，最早都能在 PostgreSQL 大表上看到影子：表变大、查询变慢、写入变重、历史分析干扰在线业务。先理解 PostgreSQL 大表，再理解 OLAP 和分布式计算会更自然。

### 3.1 分区表 Partitioning

- Range Partition：按时间、日期范围分区，适合日志、订单、事件表。
- List Partition：按地区、状态、业务类型分区。
- Hash Partition：按 `user_id`、`tenant_id` 哈希，用于均匀分散数据。
- 分区键选择。
- 分区裁剪 Partition Pruning。
- 分区维护。
- 分区局限。

### 3.2 物化视图 Materialized View

- 普通视图 vs 物化视图。
- 预计算。
- 报表加速。
- 聚合缓存。
- 刷新机制。
- 与 OLAP 聚合表的关系。

### 3.3 索引体系

- B-tree。
- BRIN。
- GIN。
- GiST。
- 联合索引。

### 3.4 执行计划 EXPLAIN

- `EXPLAIN`。
- `EXPLAIN ANALYZE`。
- Seq Scan。
- Index Scan。
- Bitmap Index Scan。
- Parallel Seq Scan。
- Nested Loop。
- Hash Join。
- Merge Join。
- Sort。
- Aggregate。

### 3.5 批量导入与导出

- `COPY`。
- CSV 导入。
- 批量 `INSERT`。
- 外部文件加载。
- 与 ETL 工具衔接。

### 3.6 并行查询

- Parallel Seq Scan。
- Parallel Hash Join。
- Gather。
- Gather Merge。
- 单机并行的边界。

### 阶段成果

- 能理解大表为什么慢。
- 能选择分区策略。
- 能使用物化视图做预聚合。
- 能使用 `EXPLAIN` 分析查询。
- 能判断 PostgreSQL 的分析边界。
- 能理解为什么需要 OLAP 系统。

## 4. OLTP vs OLAP：大数据系统的第一分水岭

### OLTP

- 面向业务交易。
- 高频小事务。
- 点查和短查询。
- 强一致性。
- 高范式建模。
- 代表系统：PostgreSQL / MySQL / Oracle。

### OLAP

- 面向数据分析。
- 大范围扫描。
- 聚合计算。
- 批量写入。
- 列式存储。
- 宽表 / 星型模型。
- 代表系统：ClickHouse / Doris / Hive / Spark SQL / Trino。

### 核心差异

| 维度 | OLTP | OLAP |
| --- | --- | --- |
| 主要任务 | 业务交易 | 数据分析 |
| 典型查询 | 点查、短查询 | 大范围扫描、聚合 |
| 存储倾向 | 行存 | 列存 |
| 写入方式 | 高频小事务 | 批量写入、流式写入 |
| 一致性目标 | 强一致优先 | 吞吐和分析效率优先 |
| 建模方式 | 规范化模型 | 星型模型、宽表、分层模型 |

### 阶段成果

- 能解释为什么业务库不能直接做大分析。
- 能区分业务查询和分析查询。
- 能理解 OLAP 系统出现的必要性。
- 能判断何时从 PostgreSQL 迁移到 ClickHouse / Doris / Spark。

## 5. 数据仓库建模：从表设计到分析建模

### 核心判断

业务库设计关注业务正确，数仓设计关注分析效率和指标一致。数仓不是复制业务库，而是重构分析语义。

### 5.1 数仓基础概念

- Data Warehouse。
- Data Mart。
- Fact Table。
- Dimension Table。
- Metric。
- Dimension。
- Granularity。
- Data Lineage。
- Data Quality。

### 5.2 数仓分层

- ODS：原始数据层。
- DWD：明细数据层。
- DWS：汇总数据层。
- ADS：应用数据层。

### 5.3 建模方法

- 星型模型。
- 雪花模型。
- 宽表模型。
- 维度建模。
- Data Vault。
- One Big Table。

### 5.4 事实表

- 事务事实表。
- 周期快照事实表。
- 累积快照事实表。
- 粒度定义。
- 度量字段。
- 外键维度。

### 5.5 维度表

- 用户维度。
- 商品维度。
- 时间维度。
- 地域维度。
- 渠道维度。
- 设备维度。
- 缓慢变化维 SCD。

### 5.6 指标体系

- 原子指标。
- 派生指标。
- 复合指标。
- 指标口径。
- 指标字典。
- 指标命名规范。
- 指标血缘。

### 阶段成果

- 能从 PostgreSQL 业务表抽象数仓模型。
- 能设计事实表和维度表。
- 能定义指标口径。
- 能设计 ODS / DWD / DWS / ADS 分层。
- 能解释业务库建模和数仓建模的差异。

## 6. ETL / ELT：数据如何进入大数据系统

### 核心判断

数据不是天然在数仓里。大数据平台的核心不是某一个计算引擎，而是持续、可信、可追踪的数据链路。PostgreSQL 在这条链路中经常是源系统。

### 6.1 基础概念

- ETL。
- ELT。
- Batch。
- Streaming。
- CDC。
- Data Pipeline。
- Data Quality。
- Data Observability。

### 6.2 PostgreSQL 数据抽取方式

- JDBC 抽取。
- `pg_dump`。
- `COPY`。
- Logical Replication。
- WAL。
- CDC。
- Foreign Data Wrapper。

### 6.3 CDC 技术栈

- PostgreSQL WAL。
- Logical Decoding。
- Replication Slot。
- Debezium。
- Kafka Connect。
- Kafka Topic。
- Schema Registry。

### 6.4 批量同步工具

- Airbyte。
- Fivetran。
- Meltano。
- DataX。
- Sqoop。
- 自研同步脚本。

### 6.5 转换工具

- dbt。
- Spark SQL。
- Flink SQL。
- SQLMesh。
- 自研 SQL 任务。

### 6.6 调度工具

- Airflow。
- Dagster。
- DolphinScheduler。
- Azkaban。
- Cron。

### 6.7 典型链路

| 链路 | 路径 | 适用场景 |
| --- | --- | --- |
| 批量同步链路 | PostgreSQL -> Airbyte / DataX -> Data Warehouse -> dbt -> BI Dashboard | T+1 报表、经营分析 |
| 实时 CDC 链路 | PostgreSQL -> Debezium -> Kafka -> Flink -> ClickHouse / Doris / Iceberg -> 实时看板 | 实时指标、订单监控、风控 |
| 湖仓链路 | PostgreSQL -> Airbyte -> Object Storage -> Parquet -> Iceberg -> Trino / Spark -> BI / AI 应用 | 开放存储、跨引擎分析、长期数据管理 |

### 阶段成果

- 能解释 ETL 和 ELT 的区别。
- 能设计 PostgreSQL 到数仓的数据链路。
- 能理解 CDC 的作用。
- 能理解 Kafka 在数据链路中的位置。
- 能理解批处理与流处理的区别。

## 7. 批处理系统：Hive / Spark / Trino

### 核心判断

批处理解决历史数据的大规模计算。SQL 是批处理系统的重要入口，但分布式批处理的真正难点在于数据切分、Shuffle、任务调度、文件格式和资源成本。

### 7.1 Hive

- Hive SQL。
- Hive Metastore。
- 内部表 / 外部表。
- 分区表 / 桶表。
- Parquet / ORC。
- HDFS / Object Storage。
- 离线数仓。

### 7.2 Spark

- Spark Core。
- Spark SQL。
- DataFrame / Dataset。
- RDD 基础认知。
- Driver / Executor。
- Partition。
- Job / Stage / Task。
- Shuffle。
- Cache。
- Broadcast Join。
- Sort Merge Join。
- AQE。
- 复杂 ETL。

### 7.3 Trino / Presto

- SQL Engine。
- Coordinator / Worker。
- Catalog / Schema / Connector。
- 联邦查询。
- 跨源查询。
- Iceberg 查询。
- Hive 查询。
- PostgreSQL 查询。
- 交互式分析。

### 阶段成果

- 能理解 Hive / Spark / Trino 的定位差异。
- 能写 Spark SQL / Hive SQL。
- 能理解 Shuffle 为什么昂贵。
- 能理解 Parquet / ORC 的价值。
- 能理解批处理系统与 PostgreSQL 的差异。

## 8. 实时数据处理：Kafka / Flink

### 核心判断

批处理回答过去发生了什么，流处理回答正在发生什么。实时数据系统围绕事件流构建，核心问题是顺序、延迟、状态、容错和语义一致性。

### 8.1 Kafka

- Producer。
- Consumer。
- Broker。
- Topic。
- Partition。
- Offset。
- Consumer Group。
- Retention。
- Replication。
- ISR。
- Exactly Once 语义。
- Kafka Connect。
- Schema Registry。

### 8.2 Kafka 在大数据链路中的角色

- 数据总线。
- 日志收集。
- CDC 通道。
- 事件流。
- 削峰填谷。
- 系统解耦。

### 8.3 Flink

- Stream Processing。
- Flink SQL。
- DataStream API。
- Event Time。
- Processing Time。
- Watermark。
- Window。
- State。
- Checkpoint。
- Savepoint。
- Exactly Once。
- Late Data。
- Backpressure。

### 8.4 典型实时链路

```text
PostgreSQL CDC
  -> Debezium
  -> Kafka
  -> Flink SQL
  -> ClickHouse / Doris / Iceberg
  -> 实时 Dashboard
```

### 阶段成果

- 能理解 Kafka 的事件流模型。
- 能理解 Flink 的状态计算。
- 能解释 Event Time 和 Watermark。
- 能设计 PostgreSQL CDC 到实时数仓链路。
- 能理解 Exactly Once 的价值与成本。

## 9. OLAP 数据库：ClickHouse / Doris / DuckDB

### 核心判断

OLAP 数据库面向高性能分析。列式存储、压缩、向量化执行、预聚合和分布式执行，都是为了让大范围扫描和聚合计算更高效。

### 9.1 ClickHouse

- 列式存储。
- MergeTree。
- 分区 Partition。
- 排序键 `ORDER BY`。
- 主键 Primary Key。
- 稀疏索引。
- 数据压缩。
- 物化视图。
- 聚合函数。
- ReplacingMergeTree。
- SummingMergeTree。
- AggregatingMergeTree。
- 分布式表。
- 大宽表建模。

### 9.2 Apache Doris

- MPP 架构。
- FE / BE。
- 明细模型。
- 聚合模型。
- 主键模型。
- Unique Key。
- Aggregate Key。
- Duplicate Key。
- 物化视图。
- 数据导入。
- 冷热分层。
- 实时数仓。

### 9.3 DuckDB

- 本地 OLAP。
- 嵌入式分析。
- Parquet 查询。
- Python 集成。
- 单机高性能。
- 数据科学。
- AI 数据预处理。

### 阶段成果

- 能解释列式存储为什么适合分析。
- 能理解 ClickHouse MergeTree。
- 能理解 Doris 的表模型。
- 能判断 PostgreSQL 与 OLAP 数据库的边界。
- 能设计 PostgreSQL -> ClickHouse 的分析链路。

## 10. 向量数据库：面向 AI / RAG / 语义检索的数据系统

### 核心判断

向量数据库不是传统数据库替代品。它解决的是语义相似性检索问题：把文本、图片、音频、代码等非结构化数据转成向量后进行搜索。在 AI 时代，它是 RAG、知识库、推荐召回和 Agent Memory 的关键组件。

### 10.1 基础概念

- Embedding。
- Vector。
- Dimension。
- Similarity Search。
- Approximate Nearest Neighbor。
- Top-K。
- Recall。
- Precision。
- Metadata Filter。
- Hybrid Search。

### 10.2 向量生成

- 文本 Embedding。
- 图片 Embedding。
- 多模态 Embedding。
- Embedding Model。
- Chunking。
- Normalization。
- 维度选择。
- 向量版本管理。

### 10.3 相似度计算

- Cosine Similarity。
- Dot Product。
- Euclidean Distance。
- Inner Product。
- 距离函数选择。

### 10.4 向量索引

- Flat Index。
- HNSW。
- IVF。
- IVF_FLAT。
- IVF_PQ。
- DiskANN。
- Quantization。
- Index Build。
- Index Search。
- Recall / Latency Trade-off。

### 10.5 向量数据库产品

- Milvus / Zilliz Cloud。
- Qdrant。
- Weaviate。
- Pinecone。
- Chroma。
- FAISS。
- pgvector。
- Elasticsearch Vector Search。
- OpenSearch Vector。

### 10.6 PostgreSQL 与向量数据库

- `pgvector` 适合中小规模 RAG。
- PostgreSQL 适合元数据与向量共存。
- PostgreSQL 适合权限过滤 + 向量检索的早期系统。
- Milvus / Qdrant 更适合更大规模、更专门的向量检索。
- PostgreSQL 经常作为向量系统的元数据库。

### 10.7 RAG 数据链路

```text
文档采集
  -> 文档解析
  -> Chunking
  -> Embedding
  -> 向量入库
  -> Query Embedding
  -> Vector Search
  -> Metadata Filter
  -> Rerank
  -> Context Assembly
  -> LLM Generation
  -> Evaluation
```

### 10.8 混合检索

- Keyword Search。
- Full-text Search。
- BM25。
- Vector Search。
- Metadata Filter。
- Sparse Vector。
- Dense Vector。
- Reranking。
- Score Fusion。

### 10.9 向量数据库在大数据体系中的位置

- 接收来自数据湖、文档系统、日志系统的数据。
- 与 PostgreSQL 一起保存元数据和权限。
- 与对象存储一起保存原始文件。
- 与 Kafka / Flink 处理实时向量更新。
- 与 Spark 处理大规模离线 Embedding。
- 与 LLM / Agent 形成检索增强链路。

### 10.10 典型场景

- RAG 知识库。
- 语义搜索。
- 相似图片搜索。
- 推荐系统召回。
- 代码搜索。
- 多模态检索。
- Agent Memory。
- 企业知识中台。
- 异常检测。

### 阶段成果

- 能解释向量数据库解决什么问题。
- 能理解 Embedding 到检索的完整链路。
- 能区分 pgvector、Milvus、Qdrant、FAISS 的定位。
- 能设计一个 RAG 知识库数据模型。
- 能理解向量检索和关键词检索的差异。
- 能把向量数据库纳入大数据平台架构。

## 11. 图数据库：面向关系网络 / 知识图谱 / 路径分析的数据系统

### 核心判断

图数据库不是为了替代关系型数据库。它解决的是复杂关系、多跳查询和网络结构分析问题。当问题重点从记录本身转向记录之间的关系时，图数据库更自然。

### 11.1 基础概念

- Node / Vertex。
- Edge / Relationship。
- Property。
- Label。
- Path。
- Graph。
- Subgraph。
- Directed Graph。
- Undirected Graph。
- Weighted Graph。

### 11.2 图数据模型

- Property Graph。
- RDF Graph。
- Triple。
- Entity。
- Relation。
- Attribute。
- Ontology。
- Schema。
- Knowledge Graph。

### 11.3 查询语言

- Cypher。
- Gremlin。
- SPARQL。
- GQL。
- openCypher。
- SQL 与图查询的差异。

### 11.4 图数据库产品

- Neo4j。
- NebulaGraph。
- JanusGraph。
- TigerGraph。
- ArangoDB。
- Amazon Neptune。
- HugeGraph。
- Memgraph。
- PostgreSQL + Apache AGE。

### 11.5 图算法

- BFS。
- DFS。
- Shortest Path。
- PageRank。
- Community Detection。
- Connected Components。
- Centrality。
- Similarity。
- Graph Embedding。

### 11.6 知识图谱

- 实体抽取。
- 关系抽取。
- 实体消歧。
- 实体对齐。
- 本体设计。
- 三元组构建。
- 图谱存储。
- 图谱推理。
- 图谱问答。
- GraphRAG。

### 11.7 图数据库在大数据体系中的位置

- 从 PostgreSQL / 数仓中抽取实体和关系。
- 从日志和事件中构建关系网络。
- 与 Spark GraphX / GraphFrames 做离线图计算。
- 与 Kafka / Flink 处理实时关系更新。
- 与向量数据库结合做 GraphRAG。
- 与 BI / 风控 / 推荐系统联动。

### 11.8 典型场景

- 知识图谱。
- 金融风控。
- 反欺诈。
- 社交网络分析。
- 推荐系统。
- 供应链关系分析。
- 企业组织关系。
- 资产依赖关系。
- 血缘分析。
- GraphRAG。

### 阶段成果

- 能解释图数据库解决什么问题。
- 能区分关系型表关联和图遍历。
- 能设计基本实体-关系图模型。
- 能理解 Cypher / Gremlin / SPARQL 的定位。
- 能理解知识图谱和图数据库的关系。
- 能把图数据库纳入大数据与 AI 架构。

## 12. 数据湖与湖仓架构

### 核心判断

数据湖解决低成本和灵活存储，数仓解决高质量建模和稳定分析，湖仓试图统一存储灵活性与分析治理。表格式是现代湖仓的关键。

### 12.1 数据湖基础

- Data Lake。
- Object Storage。
- S3 / OSS / MinIO。
- 原始数据区。
- 清洗数据区。
- 服务数据区。

### 12.2 文件格式

- CSV。
- JSON。
- Avro。
- Parquet。
- ORC。

### 12.3 表格式

- Apache Iceberg。
- Delta Lake。
- Apache Hudi。

### 12.4 查询引擎

- Spark。
- Flink。
- Trino。
- Presto。
- Hive。
- DuckDB。

### 12.5 Catalog

- Hive Metastore。
- AWS Glue Catalog。
- Nessie。
- Iceberg REST Catalog。
- Unity Catalog。

### 12.6 湖仓典型架构

```text
PostgreSQL / MySQL
  -> CDC / Batch Ingestion
  -> Object Storage
  -> Parquet
  -> Iceberg / Delta / Hudi
  -> Spark / Flink / Trino
  -> dbt
  -> BI / AI / ML
  -> 向量数据库 / 图数据库
```

### 阶段成果

- 能解释数据湖和数仓的区别。
- 能解释湖仓的价值。
- 能理解 Parquet 为什么重要。
- 能理解 Iceberg / Delta / Hudi 解决什么问题。
- 能设计 Mini Lakehouse 架构。

## 13. 数据治理与工程化

### 核心判断

大数据平台不是只会跑 SQL。可信、可追踪、可复用、可治理才是平台价值。没有治理的数据平台会变成数据沼泽。

### 13.1 数据质量

- 完整性。
- 准确性。
- 一致性。
- 唯一性。
- 及时性。
- 合法性。
- 空值检查。
- 范围检查。
- 异常检测。

### 13.2 元数据管理

- 技术元数据。
- 业务元数据。
- 操作元数据。
- 表说明。
- 字段说明。
- 指标说明。
- 数据负责人。

### 13.3 数据血缘

- 表级血缘。
- 字段级血缘。
- 任务血缘。
- 指标血缘。
- 向量数据血缘。
- 图谱关系血缘。
- 影响分析。
- 故障追踪。

### 13.4 权限与安全

- RBAC。
- ABAC。
- 行级权限。
- 列级权限。
- 文档级权限。
- 向量检索权限过滤。
- 图关系访问权限。
- 数据脱敏。
- 审计日志。
- 合规。

### 13.5 指标治理

- 指标字典。
- 指标口径。
- 指标负责人。
- 指标版本。
- 指标血缘。
- 指标服务。

### 13.6 知识治理

- 文档元数据。
- Chunk 版本。
- Embedding 版本。
- 向量索引版本。
- 图谱版本。
- 本体版本。
- 召回日志。
- RAG 评测。
- GraphRAG 评测。

### 阶段成果

- 能理解为什么报表口径会冲突。
- 能设计基础数据质量规则。
- 能理解数据血缘的价值。
- 能理解向量和图数据也需要治理。
- 能把数据工程从任务堆砌提升到平台治理。

## 14. 大数据方向项目实战

### 项目 1：PostgreSQL 电商数据分析库

- 目标：用 PostgreSQL 练 SQL 分析。
- 数据表：`users` / `products` / `orders` / `order_items` / `payments` / `events`。
- 指标：GMV / 订单数 / 客单价 / 复购率 / 留存 / 转化。
- 技术点：JOIN / GROUP BY / 窗口函数 / 分区 / 物化视图 / EXPLAIN。

### 项目 2：PostgreSQL -> ClickHouse 分析链路

- 目标：理解 OLTP / OLAP 分离。
- 架构：PostgreSQL -> 数据同步 -> ClickHouse -> BI。
- 技术点：列式存储 / MergeTree / 分区 / 排序键 / 物化视图。

### 项目 3：PostgreSQL CDC 实时数仓 Demo

- 目标：理解 CDC / Kafka / Flink。
- 架构：PostgreSQL -> Debezium -> Kafka -> Flink -> ClickHouse / Doris。
- 技术点：WAL / Kafka Topic / Flink Window / State / Checkpoint。

### 项目 4：Mini Lakehouse

- 目标：理解对象存储 / Parquet / Iceberg。
- 架构：PostgreSQL -> Airbyte -> MinIO -> Parquet -> Iceberg -> Trino / Spark。
- 技术点：Object Storage / File Format / Table Format / Catalog。

### 项目 5：RAG 向量知识库

- 目标：理解向量数据库在 AI 数据系统中的作用。
- 架构：PostgreSQL 元数据 -> 文档解析 -> Chunk -> Embedding -> Milvus / pgvector -> Rerank -> LLM。
- 数据表：`documents` / `chunks` / `embeddings` / `collections` / `retrieval_logs` / `evaluations`。
- 技术点：Embedding / Vector Search / Metadata Filter / Hybrid Search / RAG Evaluation。

### 项目 6：知识图谱与 GraphRAG

- 目标：理解图数据库在关系分析和 AI 检索中的作用。
- 架构：PostgreSQL / 文档 -> 实体抽取 -> 关系抽取 -> Neo4j / NebulaGraph -> GraphRAG。
- 数据对象：`entities` / `relations` / `triples` / `ontology` / `graph_paths` / `graph_queries`。
- 技术点：Cypher / 实体关系建模 / 路径查询 / 图算法 / GraphRAG。

### 项目 7：数据治理 Mini Platform

- 目标：管理元数据、指标口径、血缘、质量。
- 模块：表目录 / 字段目录 / 指标字典 / 任务列表 / 血缘图 / 质量规则。
- 技术点：PostgreSQL 元数据存储 / dbt metadata / Great Expectations / Airflow DAG。

## 15. 推荐学习顺序

1. PostgreSQL 与 SQL 分析。
2. PostgreSQL 大表与边界。
3. 数仓建模。
4. ETL / CDC。
5. OLAP 与批处理。
6. 实时数据。
7. 向量数据库：Embedding、Chunking、Vector Search、pgvector、Milvus / Qdrant、Hybrid Search、RAG。
8. 图数据库：图模型、Cypher、Neo4j / NebulaGraph、知识图谱、图算法、GraphRAG。
9. 数据湖 / 湖仓。
10. 数据治理。

## 16. 能力地图

### SQL 能力

- 查询。
- 聚合。
- JOIN。
- CTE。
- 窗口函数。
- 指标计算。

### 建模能力

- 业务建模。
- 事实表。
- 维度表。
- 宽表。
- 分层模型。
- 向量数据模型。
- 图数据模型。

### 数据链路能力

- 批处理。
- 流处理。
- CDC。
- ETL。
- ELT。
- Embedding Pipeline。
- Graph Construction Pipeline。
- 调度。
- 质量校验。

### 系统选型能力

| 系统 | 主要定位 |
| --- | --- |
| PostgreSQL | 业务库 / 中小分析 / pgvector / 元数据 |
| ClickHouse | 高性能 OLAP |
| Doris | 实时数仓 / BI |
| Spark | 离线大规模计算 |
| Flink | 实时流计算 |
| Kafka | 事件流 / 数据总线 |
| Iceberg | 湖仓表格式 |
| Trino | 联邦查询 |
| DuckDB | 本地分析 |
| Milvus / Qdrant | 向量检索 |
| Neo4j / NebulaGraph | 图关系分析 |

### 治理能力

- 元数据管理。
- 数据质量。
- 数据血缘。
- 指标治理。
- 向量数据治理。
- 图谱治理。
- 权限安全。
- 调度运维。
- 成本优化。

## 17. 最终学习目标

完成这条路线后，读者应该具备以下能力：

- 能用 PostgreSQL 理解业务数据结构。
- 能写复杂 SQL 分析指标。
- 能判断 PostgreSQL 的分析边界。
- 能设计数仓分层和指标体系。
- 能理解 PostgreSQL 到大数据平台的数据链路。
- 能掌握 ClickHouse / Spark / Flink / Kafka / Iceberg 的基本定位。
- 能理解向量数据库在 RAG 和语义检索中的作用。
- 能理解图数据库在知识图谱和关系分析中的作用。
- 能设计批处理、实时处理、向量检索、图关系分析的综合架构。
- 能理解数据湖与湖仓架构。
- 能建立数据治理意识。
- 能从“会查数据”升级为“会构建智能数据系统”。
