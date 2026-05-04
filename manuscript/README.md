# 数据库全书：从 PostgreSQL 到智能数据系统

这是一套正文书稿目录。`docs/` 负责写作规范、课程大纲和来源笔记；`manuscript/` 负责最终可阅读内容。

## 当前边界

- 书稿已形成完整路线。
- 自动验证已通过。
- 项目实战大多仍是可检查骨架，不是端到端可运行工程。
- 事实核查为初核，不是出版最终关闭。

正式正文与中间素材的边界见 [FRAGMENTS.md](FRAGMENTS.md)。

## 当前正文

- [正文覆盖清单](COVERAGE.md)
- [0. 核心定位](chapter-00-positioning.md)
- [第一部分：用 PostgreSQL 建立数据库直觉](part-01-postgresql-foundations/README.md)
- [第 1 章：数据库基础：用 PostgreSQL 建立数据系统直觉](part-01-postgresql-foundations/chapter-01.md)
- [第 2 章：SQL 分析能力：大数据方向第一硬技能](chapter-02-sql-analysis.md)
- [第 3 章：PostgreSQL 大表能力：理解单机数据库边界](chapter-03-postgresql-large-tables.md)
- [第 4 章：OLTP vs OLAP：大数据系统的第一分水岭](chapter-04-oltp-olap.md)
- [第 5 章：数据仓库建模：从表设计到分析建模](chapter-05-data-warehouse-modeling.md)
- [第 6 章：ETL / ELT：数据如何进入大数据系统](chapter-06-etl-elt.md)
- [第 7 章：批处理系统：Hive / Spark / Trino](chapter-07-batch-processing.md)
- [第 8 章：实时数据处理：Kafka / Flink](chapter-08-stream-processing.md)
- [第 9 章：OLAP 数据库：ClickHouse / Doris / DuckDB](chapter-09-olap-databases.md)
- [第 10 章：向量数据库：面向 AI / RAG / 语义检索的数据系统](chapter-10-vector-databases.md)
- [第 11 章：图数据库：面向关系网络 / 知识图谱 / 路径分析的数据系统](chapter-11-graph-databases.md)
- [第 12 章：数据湖与湖仓架构](chapter-12-lakehouse.md)
- [第 13 章：数据治理与工程化](chapter-13-data-governance.md)
- [第 14 章：大数据方向项目实战](chapter-14-projects.md)
- [第 15 章：推荐学习顺序](chapter-15-learning-order.md)
- [第 16 章：能力地图](chapter-16-capability-map.md)
- [第 17 章：最终学习目标](chapter-17-final-goals.md)

## 写作约定

每章继续遵循：

```text
问题切入 -> 核心判断 -> 机制解释 -> 系统位置 -> 场景案例 -> 常见误区 -> 实战任务 -> 小结引出下一章
```

正文不是 SQL 手册，也不是工具清单。它要把读者从“会查数据”带到“能理解并构建大数据与 AI 数据基础设施”。
