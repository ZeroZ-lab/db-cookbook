# 事实核查与来源

这本书的技术判断分为三类：

- 官方事实：来自数据库、框架或项目官方文档。
- 编辑判断：基于系统设计经验的解释和取舍。
- 待核查内容：后续出版级精修时必须补证据或降级表述。

## 当前来源矩阵

| 主题 | 优先来源 | 用途 |
| --- | --- | --- |
| PostgreSQL | https://www.postgresql.org/docs/ | 分区、索引、物化视图、逻辑复制、事务 |
| VitePress | https://vitepress.dev/ | 在线阅读站点、导航、Markdown、构建 |
| Kafka | https://kafka.apache.org/documentation/ | Topic、Partition、Offset、Connect、语义 |
| Flink | https://nightlies.apache.org/flink/flink-docs-stable/ | Event Time、Watermark、State、Checkpoint |
| ClickHouse | https://clickhouse.com/docs/ | MergeTree、列式存储、物化视图 |
| Apache Doris | https://doris.apache.org/docs/ | FE/BE、表模型、实时数仓 |
| DuckDB | https://duckdb.org/docs/ | 本地 OLAP、Parquet 查询 |
| Apache Iceberg | https://iceberg.apache.org/docs/ | 表格式、快照、分区演化 |
| pgvector | https://github.com/pgvector/pgvector | PostgreSQL 向量扩展能力 |
| Milvus | https://milvus.io/docs | 向量数据库、索引、检索 |
| Qdrant | https://qdrant.tech/documentation/ | 向量数据库、过滤和检索 |
| Neo4j | https://neo4j.com/docs/ | 图数据库和 Cypher |

## 精修要求

- 强事实必须能落到官方文档或项目文档。
- 产品定位类表述优先写成“适合/常见用于”，避免绝对化。
- Exactly Once、事务、CDC、湖仓表格式等高误解概念必须单独核查。
- 每轮出版级精修都要更新本页。

## 待核查清单

完整待核查条目维护在仓库文档 `docs/fact-check-matrix.md`。

当前在线版本的来源矩阵表示“优先查证来源”，不表示所有章节事实已经逐条核查完成。出版级交付前，必须完成 PostgreSQL、Kafka、Flink、ClickHouse、Doris、DuckDB、Iceberg、pgvector、Milvus、Qdrant、Neo4j 等高风险技术判断的逐条核查。
