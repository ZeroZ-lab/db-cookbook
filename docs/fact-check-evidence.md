# 事实核查证据台账

本文档用于承接 `docs/fact-check-matrix.md`、`docs/fact-check-register.json` 和 `docs/fact-check-records/`。矩阵记录人工可读状态，register 记录机器可检查的来源和章节映射，逐条记录文件承接章节处理记录，证据台账记录每个高风险判断的来源、章节位置、处理动作和剩余问题。

每个条目完成前必须保留四类信息：

- 官方来源：官方文档、项目文档或规格说明。
- 章节位置：涉及哪些章节和段落。
- 处理动作：保持原文、修正、删除、降级为作者判断。
- 剩余风险：版本差异、实现差异、环境限制或待复测项。

## FC-001 PostgreSQL 分区

- 官方来源：https://www.postgresql.org/docs/17/ddl-partitioning.html
- 章节位置：第 1、3 章。
- 当前状态：已初核，需逐章留存处理记录。
- 处理动作：待逐段记录。
- 剩余风险：版本差异、分区裁剪细节、适用边界表述。

## FC-002 PostgreSQL 物化视图

- 官方来源：https://www.postgresql.org/docs/17/sql-creatematerializedview.html
- 章节位置：第 1、3 章。
- 当前状态：已初核，需逐章留存处理记录。
- 处理动作：待逐段记录。
- 剩余风险：刷新方式、并发刷新前提、数据滞后表述。

## FC-003 PostgreSQL 索引

- 官方来源：https://www.postgresql.org/docs/17/indexes-types.html
- 章节位置：第 1、3 章。
- 当前状态：已初核，需逐章留存处理记录。
- 处理动作：已按 PostgreSQL 17 官方 Index Types 文档补充 Hash、SP-GiST 和 operator class 边界；第 1 章补充默认 B-tree 以及其他索引类型的选择方式；第 3 章修正索引类型列表和适用边界说明。
- 剩余风险：联合索引、表达式索引、部分索引、操作符类和统计信息细节仍需在出版级编辑时继续核查。

## FC-004 PostgreSQL WAL / Logical Decoding

- 官方来源：https://www.postgresql.org/docs/17/wal-intro.html、https://www.postgresql.org/docs/17/logical-replication-architecture.html、https://www.postgresql.org/docs/17/logicaldecoding.html、https://www.postgresql.org/docs/17/logicaldecoding-explanation.html
- 章节位置：第 1、6、8 章。
- 当前状态：已初核，需逐章留存处理记录。
- 处理动作：第 6、8 章已补充 WAL 的可靠性 / 恢复定位、Logical Decoding 的解码定位、Replication Slot 的消费位置和资源保留风险；第 1 章只作为后续演化提及，无需改动。
- 剩余风险：Debezium、Kafka Connect、Flink CDC 等具体 CDC 实现的端到端语义仍需各自官方文档复核。

## FC-005 Kafka

- 官方来源：https://kafka.apache.org/documentation/
- 章节位置：第 6、8 章。
- 当前状态：已初核，需逐章留存处理记录。
- 处理动作：待逐段记录。
- 剩余风险：Consumer Group、Offset、Retention、ISR、Connect 的版本差异。

## FC-006 Flink 时间语义

- 官方来源：https://nightlies.apache.org/flink/flink-docs-release-1.19/
- 章节位置：第 8 章。
- 当前状态：已初核，需逐章留存处理记录。
- 处理动作：已按 Flink 1.19 Timely Stream Processing 文档修正第 8 章 Watermark 表述，补充 Watermark 是事件时间进展声明，不是迟到事件不再发生的绝对保证；补充 Event Time、Processing Time 在业务口径、延迟和确定性之间的取舍。
- 剩余风险：Flink 1.19 文档页面已标记为旧版本；Window API、allowed lateness、side output 和 Table/SQL time attribute 细节仍需出版级核查。

## FC-007 Flink Checkpoint / Exactly Once

- 官方来源：https://nightlies.apache.org/flink/flink-docs-release-1.19/api/java/org/apache/flink/streaming/api/CheckpointingMode.html
- 章节位置：第 6、8 章。
- 当前状态：已初核，需逐章留存处理记录。
- 处理动作：待逐段记录。
- 剩余风险：端到端语义依赖 Source、Checkpoint、Sink 共同成立。

## FC-008 ClickHouse MergeTree

- 官方来源：https://clickhouse.com/docs/engines/table-engines/mergetree-family/mergetree
- 章节位置：第 9 章。
- 当前状态：已初核，需逐章留存处理记录。
- 处理动作：待逐段记录。
- 剩余风险：Partition、ORDER BY、稀疏索引、不同 MergeTree 家族表述。

## FC-009 Apache Doris 表模型

- 官方来源：https://doris.apache.org/docs/、https://doris.apache.org/docs/3.x/gettingStarted/what-is-apache-doris/、https://doris.apache.org/docs/3.x/table-design/data-model/overview/、https://doris.apache.org/docs/3.x/table-design/data-model/duplicate/、https://doris.apache.org/docs/3.x/table-design/data-model/unique/、https://doris.apache.org/docs/3.x/table-design/data-model/aggregate/
- 章节位置：第 9 章。
- 当前状态：已初核，需逐章留存处理记录。
- 处理动作：第 9 章已补充 Doris 三类表模型的保留语义、适合场景和主要边界，并补充 FE / BE、MPP 和实时数仓定位。
- 剩余风险：Merge-on-write、导入、物化视图、湖仓查询等细节仍需在后续扩写时按具体版本复核。

## FC-010 DuckDB

- 官方来源：https://duckdb.org/docs/
- 章节位置：第 9、12 章。
- 当前状态：已初核，需逐章留存处理记录。
- 处理动作：已按 DuckDB 官方文档和 Parquet 文档修正第 9、12 章：明确 DuckDB 是嵌入式、本地分析数据库；补充直接查询 Parquet、列裁剪和过滤下推；明确 DuckDB 不替代服务化 OLAP、湖仓 Catalog 或表格式治理能力。
- 剩余风险：DuckDB 并发、远程文件访问、扩展生态和具体部署边界仍需出版级核查。

## FC-011 Apache Iceberg

- 官方来源：https://iceberg.apache.org/docs/latest/evolution/ 和 https://iceberg.apache.org/spec/
- 章节位置：第 12 章。
- 当前状态：已初核，需逐章留存处理记录。
- 处理动作：待逐段记录。
- 剩余风险：快照、schema 演化、分区演化、时间旅行、增量读取、Catalog。

## FC-012 Delta / Hudi

- 官方来源：https://docs.delta.io/latest/index.html、https://docs.delta.io/latest/delta-batch.html、https://hudi.apache.org/docs/overview/、https://hudi.apache.org/docs/table_types/
- 章节位置：第 12 章。
- 当前状态：已初核，需逐章留存处理记录。
- 处理动作：第 12 章已新增 Iceberg / Delta Lake / Hudi 差异表，并补充表格式事务不等同业务数据库事务系统的边界。
- 剩余风险：Delta Lake 连接器、Change Data Feed、Hudi table services、CoW / MoR 和具体引擎支持范围仍需按版本复核。

## FC-013 pgvector

- 官方来源：https://github.com/pgvector/pgvector
- 章节位置：第 10 章。
- 当前状态：已初核，需逐章留存处理记录。
- 处理动作：待逐段记录。
- 剩余风险：向量类型、索引类型、相似度检索和元数据过滤边界。

## FC-014 Milvus / Qdrant

- 官方来源：https://milvus.io/docs、https://milvus.io/docs/overview.md、https://qdrant.tech/documentation/、https://qdrant.tech/documentation/search/filtering/、https://qdrant.tech/documentation/search/hybrid-queries/
- 章节位置：第 10 章。
- 当前状态：已初核，需逐章留存处理记录。
- 处理动作：第 10 章已收紧 Milvus / Qdrant 等专门向量数据库的定位，新增“过滤能力不等于端到端权限系统”和产品选择阶段表。
- 剩余风险：索引、过滤、混合检索和部署能力会随产品版本变化；章节后续增加产品细节时需要继续区分官方能力、部署配置和作者经验判断。

## FC-015 向量索引

- 官方来源：https://github.com/pgvector/pgvector、https://milvus.io/docs/index.md、https://milvus.io/docs/index-vector-fields.md、https://qdrant.tech/documentation/manage-data/indexing/、https://qdrant.tech/documentation/manage-data/quantization/
- 章节位置：第 10 章。
- 当前状态：已初核，需逐章留存处理记录。
- 处理动作：第 10 章已把向量索引从名称列表扩展为机制表，补充 pgvector、Qdrant、Milvus 支持范围和产品版本边界。
- 剩余风险：具体参数建议、DiskANN / on-disk index 实现、量化参数和不同数据库默认行为仍需按版本复核。

## FC-016 Neo4j / Cypher

- 官方来源：https://neo4j.com/docs/
- 章节位置：第 11 章。
- 当前状态：已初核，需逐章留存处理记录。
- 处理动作：已按 Neo4j 官方 Graph Database Concepts 和 Cypher Patterns 文档修正第 11 章：补充 Neo4j Property Graph 中节点 label、节点/关系 properties、relationship 起点/终点/方向/type；补充 Cypher 是声明式 graph pattern matching。
- 剩余风险：Neo4j 版本 5/25 差异、Cypher variable-length path 语法、Graph Data Science、索引/约束和权限治理仍需出版级核查。

## FC-017 NebulaGraph / 分布式图

- 官方来源：https://docs.nebula-graph.io/、https://docs.nebula-graph.io/3.8.0/1.introduction/1.what-is-nebula-graph/、https://docs.nebula-graph.io/3.8.0/1.introduction/3.nebula-graph-architecture/1.architecture-overview/
- 章节位置：第 11 章。
- 当前状态：已初核，需逐章留存处理记录。
- 处理动作：第 11 章已补充 NebulaGraph 的分布式原生图定位、shared-nothing、存算分离、Meta / Graph / Storage Service 职责和分布式图边界。
- 剩余风险：nGQL、部署、索引、权限和 5.x 企业特性不在本轮核查范围，后续扩写需单独确认。

## FC-018 权限与 RAG / GraphRAG

- 官方来源：https://www.postgresql.org/docs/17/ddl-rowsecurity.html、https://owasp.org/www-project-top-10-for-large-language-model-applications/、https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html、https://genai.owasp.org/llm-top-10/、https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-overview.html、https://qdrant.tech/documentation/search/filtering/、https://docs.nebula-graph.io/3.8.0/7.data-security/1.authentication/
- 章节位置：第 13 章。
- 当前状态：已初核，需逐章留存处理记录。
- 处理动作：第 13 章已新增“检索过滤不等于授权系统”、端到端权限环节表和 RAG / GraphRAG 多阶段权限校验流程。
- 剩余风险：具体云厂商 IAM、向量库 tenant/filter、图数据库权限、身份系统和审计实现需要在项目落地时继续复核。
