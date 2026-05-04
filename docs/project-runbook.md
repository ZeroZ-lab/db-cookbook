# 项目实战执行总表

本文档由 `node scripts/generate-project-runbook.mjs` 从 `project-workbench/project-manifest.json` 生成，用来把第 14 章七个项目的运行状态、必需产物、阻塞项和验收证据放到一个可检查入口。

它不是端到端运行成功声明。`runtimeStatus` 只能使用 manifest 中允许的状态，所有阻塞项必须显式保留，直到对应项目真正跑通并留下运行记录。

## 状态约束

| 类型 | 值 |
| --- | --- |
| 允许状态 | `static-artifacts-verified`, `runtime-entry-present`, `not-end-to-end-run` |
| 禁止状态 | `completed`, `green`, `passed`, `production-ready`, `end-to-end-verified` |

## 项目总览

| 项目 | 阶段 | 当前状态 | 阻塞数量 | 交付物数量 |
| --- | --- | --- | --- | --- |
| [PostgreSQL 电商数据分析库](../project-workbench/projects/01-postgresql-analytics/README.md) | PostgreSQL 基础与 SQL 分析 | `runtime-entry-present` | 2 | 14 |
| [PostgreSQL 到 ClickHouse 分析链路](../project-workbench/projects/02-postgres-to-clickhouse/README.md) | OLTP 到 OLAP 分化 | `static-artifacts-verified` | 3 | 14 |
| [CDC 实时数仓 Demo](../project-workbench/projects/03-cdc-realtime-warehouse/README.md) | CDC 与实时计算 | `static-artifacts-verified` | 4 | 13 |
| [Mini Lakehouse](../project-workbench/projects/04-mini-lakehouse/README.md) | Lakehouse 架构 | `static-artifacts-verified` | 4 | 13 |
| [RAG 向量知识库](../project-workbench/projects/05-rag-vector-kb/README.md) | AI 时代数据基础设施 | `static-artifacts-verified` | 3 | 13 |
| [知识图谱与 GraphRAG](../project-workbench/projects/06-knowledge-graph-graphrag/README.md) | 图数据库与 GraphRAG | `static-artifacts-verified` | 3 | 13 |
| [数据治理 Mini Platform](../project-workbench/projects/07-governance-mini-platform/README.md) | 治理、血缘、质量与信任 | `static-artifacts-verified` | 3 | 13 |

## 逐项目执行卡

### 01-postgresql-analytics PostgreSQL 电商数据分析库

- 阶段：PostgreSQL 基础与 SQL 分析
- 当前状态：`runtime-entry-present`
- 项目说明：[README.md](../project-workbench/projects/01-postgresql-analytics/README.md)
- 交付清单：[DELIVERABLES.md](../project-workbench/projects/01-postgresql-analytics/DELIVERABLES.md)

阻塞项：

- current environment has no psql or createdb client
- current environment has no docker runtime

必需产物：

- [README.md](../project-workbench/projects/01-postgresql-analytics/README.md)
- [DELIVERABLES.md](../project-workbench/projects/01-postgresql-analytics/DELIVERABLES.md)
- [run.sh](../project-workbench/projects/01-postgresql-analytics/run.sh)
- [docker-compose.yml](../project-workbench/projects/01-postgresql-analytics/docker-compose.yml)
- [reports/run-record-template.md](../project-workbench/projects/01-postgresql-analytics/reports/run-record-template.md)
- [docs/architecture.md](../project-workbench/projects/01-postgresql-analytics/docs/architecture.md)
- [docs/business-fact-relationship.md](../project-workbench/projects/01-postgresql-analytics/docs/business-fact-relationship.md)
- [docs/metric-definitions.md](../project-workbench/projects/01-postgresql-analytics/docs/metric-definitions.md)
- [docs/query-categories.md](../project-workbench/projects/01-postgresql-analytics/docs/query-categories.md)
- [docs/ddl-source.md](../project-workbench/projects/01-postgresql-analytics/docs/ddl-source.md)
- [docs/index-optimization.md](../project-workbench/projects/01-postgresql-analytics/docs/index-optimization.md)
- [docs/partition-materialized-views.md](../project-workbench/projects/01-postgresql-analytics/docs/partition-materialized-views.md)
- [queries/analysis-queries.sql](../project-workbench/projects/01-postgresql-analytics/queries/analysis-queries.sql)
- [queries/explain-records.sql](../project-workbench/projects/01-postgresql-analytics/queries/explain-records.sql)

### 02-postgres-to-clickhouse PostgreSQL 到 ClickHouse 分析链路

- 阶段：OLTP 到 OLAP 分化
- 当前状态：`static-artifacts-verified`
- 项目说明：[README.md](../project-workbench/projects/02-postgres-to-clickhouse/README.md)
- 交付清单：[DELIVERABLES.md](../project-workbench/projects/02-postgres-to-clickhouse/DELIVERABLES.md)

阻塞项：

- requires running PostgreSQL source database
- requires running ClickHouse engine
- requires reconciliation run data

必需产物：

- [README.md](../project-workbench/projects/02-postgres-to-clickhouse/README.md)
- [DELIVERABLES.md](../project-workbench/projects/02-postgres-to-clickhouse/DELIVERABLES.md)
- [run.sh](../project-workbench/projects/02-postgres-to-clickhouse/run.sh)
- [mappings/orders-wide-mapping.md](../project-workbench/projects/02-postgres-to-clickhouse/mappings/orders-wide-mapping.md)
- [clickhouse/schema.sql](../project-workbench/projects/02-postgres-to-clickhouse/clickhouse/schema.sql)
- [queries/daily-gmv.sql](../project-workbench/projects/02-postgres-to-clickhouse/queries/daily-gmv.sql)
- [queries/detail-queries.md](../project-workbench/projects/02-postgres-to-clickhouse/queries/detail-queries.md)
- [docs/table-design-notes.md](../project-workbench/projects/02-postgres-to-clickhouse/docs/table-design-notes.md)
- [docs/sync-strategy.md](../project-workbench/projects/02-postgres-to-clickhouse/docs/sync-strategy.md)
- [docs/architecture.md](../project-workbench/projects/02-postgres-to-clickhouse/docs/architecture.md)
- [docs/reconciliation-notes.md](../project-workbench/projects/02-postgres-to-clickhouse/docs/reconciliation-notes.md)
- [docs/performance-comparison.md](../project-workbench/projects/02-postgres-to-clickhouse/docs/performance-comparison.md)
- [reports/reconciliation-template.md](../project-workbench/projects/02-postgres-to-clickhouse/reports/reconciliation-template.md)
- [reports/run-record-template.md](../project-workbench/projects/02-postgres-to-clickhouse/reports/run-record-template.md)

### 03-cdc-realtime-warehouse CDC 实时数仓 Demo

- 阶段：CDC 与实时计算
- 当前状态：`static-artifacts-verified`
- 项目说明：[README.md](../project-workbench/projects/03-cdc-realtime-warehouse/README.md)
- 交付清单：[DELIVERABLES.md](../project-workbench/projects/03-cdc-realtime-warehouse/DELIVERABLES.md)

阻塞项：

- requires Debezium or equivalent CDC connector
- requires Kafka runtime
- requires Flink runtime
- requires ClickHouse sink runtime

必需产物：

- [README.md](../project-workbench/projects/03-cdc-realtime-warehouse/README.md)
- [DELIVERABLES.md](../project-workbench/projects/03-cdc-realtime-warehouse/DELIVERABLES.md)
- [run.sh](../project-workbench/projects/03-cdc-realtime-warehouse/run.sh)
- [events/order-status-changed.json](../project-workbench/projects/03-cdc-realtime-warehouse/events/order-status-changed.json)
- [kafka/topics.md](../project-workbench/projects/03-cdc-realtime-warehouse/kafka/topics.md)
- [flink/realtime-gmv.sql](../project-workbench/projects/03-cdc-realtime-warehouse/flink/realtime-gmv.sql)
- [sinks/clickhouse-realtime.sql](../project-workbench/projects/03-cdc-realtime-warehouse/sinks/clickhouse-realtime.sql)
- [docs/exactly-once-boundary.md](../project-workbench/projects/03-cdc-realtime-warehouse/docs/exactly-once-boundary.md)
- [docs/architecture.md](../project-workbench/projects/03-cdc-realtime-warehouse/docs/architecture.md)
- [docs/cdc-pseudo-flow.md](../project-workbench/projects/03-cdc-realtime-warehouse/docs/cdc-pseudo-flow.md)
- [docs/kafka-consumer-example.md](../project-workbench/projects/03-cdc-realtime-warehouse/docs/kafka-consumer-example.md)
- [docs/topic-verification.md](../project-workbench/projects/03-cdc-realtime-warehouse/docs/topic-verification.md)
- [reports/run-record-template.md](../project-workbench/projects/03-cdc-realtime-warehouse/reports/run-record-template.md)

### 04-mini-lakehouse Mini Lakehouse

- 阶段：Lakehouse 架构
- 当前状态：`static-artifacts-verified`
- 项目说明：[README.md](../project-workbench/projects/04-mini-lakehouse/README.md)
- 交付清单：[DELIVERABLES.md](../project-workbench/projects/04-mini-lakehouse/DELIVERABLES.md)

阻塞项：

- requires object storage or local warehouse runtime
- requires Iceberg catalog
- requires Spark runtime
- requires Trino runtime

必需产物：

- [README.md](../project-workbench/projects/04-mini-lakehouse/README.md)
- [DELIVERABLES.md](../project-workbench/projects/04-mini-lakehouse/DELIVERABLES.md)
- [run.sh](../project-workbench/projects/04-mini-lakehouse/run.sh)
- [storage/object-layout.md](../project-workbench/projects/04-mini-lakehouse/storage/object-layout.md)
- [iceberg/orders.sql](../project-workbench/projects/04-mini-lakehouse/iceberg/orders.sql)
- [trino/orders-analysis.sql](../project-workbench/projects/04-mini-lakehouse/trino/orders-analysis.sql)
- [spark/build-order-items-wide.sql](../project-workbench/projects/04-mini-lakehouse/spark/build-order-items-wide.sql)
- [docs/evolution-record.md](../project-workbench/projects/04-mini-lakehouse/docs/evolution-record.md)
- [docs/architecture.md](../project-workbench/projects/04-mini-lakehouse/docs/architecture.md)
- [docs/export-pseudo-code.md](../project-workbench/projects/04-mini-lakehouse/docs/export-pseudo-code.md)
- [reports/run-record-template.md](../project-workbench/projects/04-mini-lakehouse/reports/run-record-template.md)
- [reports/trino-result-template.md](../project-workbench/projects/04-mini-lakehouse/reports/trino-result-template.md)
- [reports/spark-result-template.md](../project-workbench/projects/04-mini-lakehouse/reports/spark-result-template.md)

### 05-rag-vector-kb RAG 向量知识库

- 阶段：AI 时代数据基础设施
- 当前状态：`static-artifacts-verified`
- 项目说明：[README.md](../project-workbench/projects/05-rag-vector-kb/README.md)
- 交付清单：[DELIVERABLES.md](../project-workbench/projects/05-rag-vector-kb/DELIVERABLES.md)

阻塞项：

- requires PostgreSQL with pgvector
- requires embedding generation pipeline
- requires retrieval evaluation execution

必需产物：

- [README.md](../project-workbench/projects/05-rag-vector-kb/README.md)
- [DELIVERABLES.md](../project-workbench/projects/05-rag-vector-kb/DELIVERABLES.md)
- [run.sh](../project-workbench/projects/05-rag-vector-kb/run.sh)
- [schema/pgvector.sql](../project-workbench/projects/05-rag-vector-kb/schema/pgvector.sql)
- [queries/retrieve-with-permission.sql](../project-workbench/projects/05-rag-vector-kb/queries/retrieve-with-permission.sql)
- [evals/rag-eval-sample.json](../project-workbench/projects/05-rag-vector-kb/evals/rag-eval-sample.json)
- [docs/chunking-and-versioning.md](../project-workbench/projects/05-rag-vector-kb/docs/chunking-and-versioning.md)
- [docs/permission-boundary.md](../project-workbench/projects/05-rag-vector-kb/docs/permission-boundary.md)
- [docs/architecture.md](../project-workbench/projects/05-rag-vector-kb/docs/architecture.md)
- [docs/document-parsing-rules.md](../project-workbench/projects/05-rag-vector-kb/docs/document-parsing-rules.md)
- [reports/retrieval-log-template.md](../project-workbench/projects/05-rag-vector-kb/reports/retrieval-log-template.md)
- [reports/run-record-template.md](../project-workbench/projects/05-rag-vector-kb/reports/run-record-template.md)
- [reports/rag-eval-result-template.md](../project-workbench/projects/05-rag-vector-kb/reports/rag-eval-result-template.md)

### 06-knowledge-graph-graphrag 知识图谱与 GraphRAG

- 阶段：图数据库与 GraphRAG
- 当前状态：`static-artifacts-verified`
- 项目说明：[README.md](../project-workbench/projects/06-knowledge-graph-graphrag/README.md)
- 交付清单：[DELIVERABLES.md](../project-workbench/projects/06-knowledge-graph-graphrag/DELIVERABLES.md)

阻塞项：

- requires Neo4j or NebulaGraph runtime
- requires graph loading job
- requires GraphRAG evaluation execution

必需产物：

- [README.md](../project-workbench/projects/06-knowledge-graph-graphrag/README.md)
- [DELIVERABLES.md](../project-workbench/projects/06-knowledge-graph-graphrag/DELIVERABLES.md)
- [run.sh](../project-workbench/projects/06-knowledge-graph-graphrag/run.sh)
- [ontology/entity-relation-types.md](../project-workbench/projects/06-knowledge-graph-graphrag/ontology/entity-relation-types.md)
- [data/triples-sample.jsonl](../project-workbench/projects/06-knowledge-graph-graphrag/data/triples-sample.jsonl)
- [queries/neo4j-paths.cypher](../project-workbench/projects/06-knowledge-graph-graphrag/queries/neo4j-paths.cypher)
- [queries/nebulagraph-paths.ngql](../project-workbench/projects/06-knowledge-graph-graphrag/queries/nebulagraph-paths.ngql)
- [graphrag/context-template.md](../project-workbench/projects/06-knowledge-graph-graphrag/graphrag/context-template.md)
- [docs/architecture.md](../project-workbench/projects/06-knowledge-graph-graphrag/docs/architecture.md)
- [docs/graphrag-evidence-checklist.md](../project-workbench/projects/06-knowledge-graph-graphrag/docs/graphrag-evidence-checklist.md)
- [reports/graph-query-log-template.md](../project-workbench/projects/06-knowledge-graph-graphrag/reports/graph-query-log-template.md)
- [reports/run-record-template.md](../project-workbench/projects/06-knowledge-graph-graphrag/reports/run-record-template.md)
- [reports/path-query-result-template.md](../project-workbench/projects/06-knowledge-graph-graphrag/reports/path-query-result-template.md)

### 07-governance-mini-platform 数据治理 Mini Platform

- 阶段：治理、血缘、质量与信任
- 当前状态：`static-artifacts-verified`
- 项目说明：[README.md](../project-workbench/projects/07-governance-mini-platform/README.md)
- 交付清单：[DELIVERABLES.md](../project-workbench/projects/07-governance-mini-platform/DELIVERABLES.md)

阻塞项：

- requires governance database runtime
- requires metadata ingestion job
- requires quality and policy checks execution

必需产物：

- [README.md](../project-workbench/projects/07-governance-mini-platform/README.md)
- [DELIVERABLES.md](../project-workbench/projects/07-governance-mini-platform/DELIVERABLES.md)
- [run.sh](../project-workbench/projects/07-governance-mini-platform/run.sh)
- [schema/governance.sql](../project-workbench/projects/07-governance-mini-platform/schema/governance.sql)
- [catalog/metric-dictionary.md](../project-workbench/projects/07-governance-mini-platform/catalog/metric-dictionary.md)
- [lineage/lineage-sample.json](../project-workbench/projects/07-governance-mini-platform/lineage/lineage-sample.json)
- [quality/rules.sql](../project-workbench/projects/07-governance-mini-platform/quality/rules.sql)
- [policies/access-policies.md](../project-workbench/projects/07-governance-mini-platform/policies/access-policies.md)
- [docs/architecture.md](../project-workbench/projects/07-governance-mini-platform/docs/architecture.md)
- [reports/governance-audit-template.md](../project-workbench/projects/07-governance-mini-platform/reports/governance-audit-template.md)
- [reports/run-record-template.md](../project-workbench/projects/07-governance-mini-platform/reports/run-record-template.md)
- [reports/quality-rule-result-template.md](../project-workbench/projects/07-governance-mini-platform/reports/quality-rule-result-template.md)
- [reports/policy-test-record-template.md](../project-workbench/projects/07-governance-mini-platform/reports/policy-test-record-template.md)

## 验证命令

```bash
pnpm projects:verify
pnpm verify
```

`pnpm projects:verify` 只证明项目目录、交付清单、关键 SQL / JSON / 文档和 manifest 状态一致；不证明数据库、消息队列、计算引擎或 AI 检索链路已经真实运行。

