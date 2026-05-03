# 项目实战工作台

这个目录把第 14 章的项目实战从“章节说明”落成可检查的工程清单。

它不是一次性提供七套完整线上系统，而是给每个项目固定交付边界：目标、系统位置、数据模型、核心链路、验收指标、运行命令、质量检查和复盘问题。每个项目还必须维护 `DELIVERABLES.md`，把架构、模型、任务、验证证据和复盘记录落成可检查清单。

`project-manifest.json` 是项目工作台的机器可读状态表。它记录七个项目的阶段、必需产物、当前运行状态和阻塞项，用来防止把“静态产物已验证”误写成“端到端已跑通”。读者可以按顺序逐个补齐实现，并用 `pnpm projects:verify` 防止项目边界和文档结构漂移。

## 项目顺序

1. [PostgreSQL 电商数据分析库](projects/01-postgresql-analytics/README.md)
2. [PostgreSQL 到 ClickHouse 分析链路](projects/02-postgres-to-clickhouse/README.md)
3. [CDC 实时数仓 Demo](projects/03-cdc-realtime-warehouse/README.md)
4. [Mini Lakehouse](projects/04-mini-lakehouse/README.md)
5. [RAG 向量知识库](projects/05-rag-vector-kb/README.md)
6. [知识图谱与 GraphRAG](projects/06-knowledge-graph-graphrag/README.md)
7. [数据治理 Mini Platform](projects/07-governance-mini-platform/README.md)

## 验证命令

```bash
pnpm projects:verify
```

这个命令验证 `project-manifest.json`、项目骨架、验收字段和关键产物是否完整，不代替各项目未来的真实运行验证。

当前已经额外检查：

- 项目 1：PostgreSQL 运行入口、运行记录模板、PostgreSQL 17 Docker Compose。
- 项目 2：ClickHouse 字段映射、MergeTree DDL、每日 GMV 查询、对账模板。
- 项目 3：CDC 事件、Kafka Topic、Flink SQL、ClickHouse Sink DDL、Exactly Once 边界说明。
- 项目 4：对象存储布局、Iceberg DDL、Trino 查询、Spark 转换、schema 与分区演化记录。
- 项目 5：pgvector schema、权限过滤检索 SQL、RAG 评测集、Chunk 与 Embedding 版本策略、检索日志模板。
- 项目 6：ontology、三元组样例、Neo4j / NebulaGraph 路径查询、GraphRAG 上下文模板、图查询日志模板。
- 项目 7：治理 schema、指标字典、血缘样例、质量规则、跨 SQL / 向量 / 图权限策略、治理审计模板。
