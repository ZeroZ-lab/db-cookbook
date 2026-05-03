# 事实核查矩阵

本文档列出出版级精修前必须逐条核查的高风险技术判断。当前状态是“矩阵已建立，`docs/fact-check-register.json` 已记录结构化来源和章节映射，部分条目有官方来源链接，但仍需逐章留存可复核证据和文字处理记录”。

## 核查规则

每个条目需要完成三步：

1. 打开官方文档或项目文档确认事实。
2. 将章节表述改成官方事实或明确降级为作者经验判断。
3. 在本矩阵中记录核查日期、来源链接和处理结果。

## 核查条目

| ID | 章节 | 主题 | 需要核查的问题 | 优先来源 | 当前状态 |
| --- | --- | --- | --- | --- | --- |
| FC-001 | 第 1、3 章 | PostgreSQL 分区 | Range / List / Hash 分区、分区裁剪、分区适用边界是否表述准确 | https://www.postgresql.org/docs/17/ddl-partitioning.html | 已初核，需逐章留存处理记录 |
| FC-002 | 第 1、3 章 | PostgreSQL 物化视图 | 普通视图与物化视图、刷新、数据滞后和适用场景是否准确 | https://www.postgresql.org/docs/17/sql-creatematerializedview.html | 已初核，需逐章留存处理记录 |
| FC-003 | 第 1、3 章 | PostgreSQL 索引 | B-tree、BRIN、GIN、GiST、联合索引的适用边界是否准确 | https://www.postgresql.org/docs/17/indexes-types.html | 已初核，需逐章留存处理记录 |
| FC-004 | 第 1、6、8 章 | PostgreSQL WAL / Logical Decoding | WAL、Logical Replication、Logical Decoding、Replication Slot 与 CDC 的关系是否准确 | https://www.postgresql.org/docs/17/logical-replication-architecture.html | 已初核，需逐章留存处理记录 |
| FC-005 | 第 6、8 章 | Kafka | Topic、Partition、Offset、Consumer Group、Retention、Replication、ISR、Connect 的描述是否准确 | https://kafka.apache.org/documentation/ | 已初核，需逐章留存处理记录 |
| FC-006 | 第 8 章 | Flink 时间语义 | Event Time、Processing Time、Watermark、Late Data、Window 的描述是否准确 | https://nightlies.apache.org/flink/flink-docs-release-1.19/ | 已初核，需逐章留存处理记录 |
| FC-007 | 第 6、8 章 | Flink Checkpoint / Exactly Once | Exactly Once 的”端到端语义”表述是否准确，Source / Checkpoint / Sink 边界是否清楚 | https://nightlies.apache.org/flink/flink-docs-release-1.19/api/java/org/apache/flink/streaming/api/CheckpointingMode.html | 已初核，需逐章留存处理记录 |
| FC-008 | 第 9 章 | ClickHouse MergeTree | MergeTree、Partition、ORDER BY、稀疏索引、物化视图、Replacing / Summing / Aggregating MergeTree 表述是否准确 | https://clickhouse.com/docs/engines/table-engines/mergetree-family/mergetree | 已初核，需逐章留存处理记录 |
| FC-009 | 第 9 章 | Apache Doris 表模型 | Duplicate Key、Aggregate Key、Unique Key、FE / BE、MPP、实时数仓定位是否准确 | https://doris.apache.org/docs/ | 已初核，需逐章留存处理记录 |
| FC-010 | 第 9、12 章 | DuckDB | 本地 OLAP、Parquet 查询、嵌入式分析定位是否准确 | https://duckdb.org/docs/ | 已初核，需逐章留存处理记录 |
| FC-011 | 第 12 章 | Apache Iceberg | 快照、schema 演化、分区演化、时间旅行、增量读取、Catalog 表述是否准确 | https://iceberg.apache.org/docs/latest/evolution/ / https://iceberg.apache.org/spec/ | 已初核，需逐章留存处理记录 |
| FC-012 | 第 12 章 | Delta / Hudi | 表格式定位、事务、文件管理和湖仓边界是否准确 | 官方项目文档 | 已初核，需逐章留存处理记录 |
| FC-013 | 第 10 章 | pgvector | PostgreSQL 向量类型、索引、相似度检索和适用边界是否准确 | https://github.com/pgvector/pgvector | 已初核，需逐章留存处理记录 |
| FC-014 | 第 10 章 | Milvus / Qdrant | 专门向量数据库定位、索引、过滤、检索边界是否准确 | https://milvus.io/docs / https://qdrant.tech/documentation/ | 已初核，需逐章留存处理记录 |
| FC-015 | 第 10 章 | 向量索引 | HNSW、IVF、IVF_FLAT、IVF_PQ、DiskANN、Quantization 的名称和取舍是否准确 | https://github.com/pgvector/pgvector 及各向量数据库官方文档 | 已初核，需逐章留存处理记录 |
| FC-016 | 第 11 章 | Neo4j / Cypher | 节点、边、属性、路径查询、Cypher 示例和图数据库定位是否准确 | https://neo4j.com/docs/ | 已初核，需逐章留存处理记录 |
| FC-017 | 第 11 章 | NebulaGraph / 分布式图 | 大规模分布式图定位是否准确 | https://docs.nebula-graph.io/ | 已初核，需逐章留存处理记录 |
| FC-018 | 第 13 章 | 权限与 RAG / GraphRAG | SQL、对象存储、向量检索、图关系扩展的端到端权限边界是否需要更精确表述 | 具体实现文档和安全设计资料 | 已初核，需逐章留存处理记录 |

## 当前结论

截至 2026-05-03，矩阵已覆盖 18 个高风险主题，`docs/fact-check-register.json` 已把每个条目的章节文件、来源 URL 和状态转成机器可检查结构。FC-001 至 FC-018 均已有官方来源或安全资料初核记录；所有条目仍保留“需逐章留存处理记录”状态，出版级收口前还需要按具体产品版本、部署方式和章节新增内容继续复核。
