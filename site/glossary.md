# 术语表

## PostgreSQL 基础

- **PostgreSQL**：本书建立数据库直觉的主入口，承担业务数据组织、事务一致性、SQL 查询和中小规模分析的基础训练。
- **Database**：一个相对独立的数据世界。
- **Schema**：数据库内部的命名空间。
- **Table**：业务对象、事件或关系的数据化表达。
- **Row**：一条事实记录。
- **Column**：事实的属性。
- **Primary Key**：解决记录身份问题。
- **Foreign Key**：解决表之间关系问题。
- **Transaction**：让多步修改表现得像一个可靠动作。
- **Index**：用写入成本换读取路径，加速特定查询访问。
- **Partition**：为持续增长的大表建立可管理、可裁剪的物理边界。
- **Materialized View**：把重复查询结果提前算好并存下来，需要刷新。
- **WAL**：Write-Ahead Log，PostgreSQL 的预写日志，是逻辑复制和 CDC 的基础。

## 数据建模

- **Fact Table**：记录业务事实的表，一行代表一笔交易、一次事件或一个度量。
- **Dimension Table**：描述业务对象属性的表，如用户、商品、地区。
- **Star Schema**：以事实表为中心、维度表围绕的星型建模方式。
- **ODS / DWD / DWS / ADS**：数仓分层，从原始数据到明细、汇总和应用层。
- **Metric**：可量化的业务度量，如 GMV、DAU、转化率。
- **Granularity**：表中一行代表的业务粒度。

## 数据平台

- **OLTP**：面向业务交易，高频小事务、低延迟和强一致优先。
- **OLAP**：面向数据分析，大范围扫描、聚合和吞吐优先。
- **ETL / ELT**：数据抽取、转换、装载的链路模式。
- **CDC**：捕获数据库变更并形成持续数据流。
- **Data Lineage**：数据从源到目标的流转路径和依赖关系。

## 批处理与流处理

- **Spark**：大规模分布式批处理和数据转换引擎。
- **Flink**：有状态流计算引擎，支持事件时间、窗口和 Exactly Once 语义。
- **Kafka**：分布式事件流平台，用 Topic 和 Partition 承接持续数据流。
- **Watermark**：Flink 中判断事件时间推进到哪里的机制，决定窗口何时输出。
- **Exactly Once**：端到端处理语义，需要 Source、Checkpoint 和 Sink 共同配合。

## OLAP 引擎

- **ClickHouse**：列式高性能 OLAP 数据库，核心引擎为 MergeTree。
- **MergeTree**：ClickHouse 的核心表引擎，通过排序键和稀疏索引优化分析查询。
- **Doris**：面向实时数仓和 BI 的 MPP 分析数据库。
- **DuckDB**：本地嵌入式 OLAP 数据库，可直接查询 Parquet 文件。

## 湖仓

- **Lakehouse**：用表格式把对象存储中的文件组织成可管理的分析表。
- **Iceberg**：湖仓表格式，支持快照、schema 演化、分区演化和时间旅行。
- **Delta Lake**：湖仓表格式，提供 ACID 事务和版本管理。
- **Hudi**：湖仓表格式，支持增量处理和近实时数据入湖。
- **Parquet**：列式存储格式，适合分析查询和跨引擎共享。
- **Catalog**：管理湖仓表元数据、快照和 schema 的目录服务。
- **Snapshot**：湖仓表在某一时刻的完整数据版本。

## 向量数据库

- **Embedding**：把文本、图片、代码等对象转换成向量。
- **Vector Search**：基于向量相似度检索内容。
- **HNSW**：分层可导航小世界图索引，适合高召回低延迟场景。
- **IVF**：倒排文件索引，通过聚类加速大规模向量检索。
- **Chunk**：文档切分后的语义片段，是 RAG 检索的基本单位。
- **Rerank**：对召回结果重新排序，提升最终答案质量。
- **pgvector**：PostgreSQL 的向量扩展，适合中小规模 RAG 场景。
- **Milvus**：专门向量数据库，适合大规模向量检索。

## 图数据库

- **Node / Vertex**：图中的实体节点。
- **Edge / Relationship**：实体之间的关系。
- **Property Graph**：节点和边都可以带属性的图模型。
- **Cypher**：Neo4j 的图查询语言，用模式匹配表达路径查询。
- **GraphRAG**：结合图关系和检索增强生成的 AI 应用模式。
- **Neo4j**：生态成熟的图数据库，适合知识图谱和路径查询。

## 数据治理

- **Data Governance**：质量、元数据、血缘、权限、指标和知识治理的综合体系。
- **Metadata**：描述数据的数据，包括技术元数据和业务元数据。
- **Data Quality**：数据的完整性、准确性、一致性、唯一性和及时性。
- **Metric Governance**：统一指标定义、口径、血缘和版本管理。
