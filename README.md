# db-cookbook

`db-cookbook` 是一份从 PostgreSQL 走向智能数据系统的系统化学习指南。

它不把数据库知识写成 SQL 语法手册，也不把大数据生态写成工具清单。它的目标是让读者先用 PostgreSQL 建立可靠的数据库直觉，再逐步理解单机数据库的边界、OLTP 与 OLAP 的分化、现代数据平台的工程结构，以及 AI 时代的数据基础设施。

## 核心定位

这份指南服务的读者不是只想背概念的人，而是已经会查一些数据、但还不清楚数据系统为什么会演化成今天这个样子的人。

读完之后，读者应该能回答：

- 为什么 PostgreSQL 可以承担大量业务系统的核心数据层？
- SQL 为什么既是查询语言，也是分析思维训练工具？
- 索引、分区、物化视图、执行计划分别解决什么问题，又不能解决什么问题？
- 为什么 OLTP 和 OLAP 会分化？
- 数仓、ETL、CDC、批处理、实时计算、OLAP 数据库、湖仓分别处在什么系统位置？
- 向量数据库、图数据库和数据治理为什么会成为 AI 数据基础设施的一部分？

## 写作路线

完整路线分为四段，具体学习大纲见 [章节路线](docs/course-outline.md)：

1. PostgreSQL 基础直觉：数据组织、约束、事务、查询、一致性。
2. SQL 与单机数据库边界：分析查询、大表、索引、分区、物化视图、执行计划。
3. 数据平台演化：OLTP/OLAP 分化、数仓建模、ETL/CDC、批处理、实时计算、OLAP 数据库、湖仓架构。
4. 智能数据系统：向量数据库、图数据库、元数据、血缘、质量、权限、治理与 AI 应用的数据底座。

最小闭环是：

```text
PostgreSQL 业务数据
  -> SQL 分析
  -> 数仓建模
  -> ETL / CDC
  -> ClickHouse / Spark / Flink
  -> 向量检索 / 图关系分析
  -> 指标与数据应用
```

## 项目文档

- [写作规范](docs/writing-guide.md)
- [章节路线](docs/course-outline.md)
- [章节模板](docs/chapter-template.md)
- [书稿扩写与验收计划](docs/book-expansion-plan.md)
- [完成审计](docs/completion-audit.md)
- [目标覆盖映射](docs/objective-coverage-map.md)
- [事实核查矩阵](docs/fact-check-matrix.md)
- [事实核查证据台账](docs/fact-check-evidence.md)
- [事实核查结构化 register](docs/fact-check-register.json)
- [事实核查逐条记录](docs/fact-check-records/FC-001.md)
- [来源笔记](docs/source-notes.md)
- [技术编辑审核记录](docs/editorial-review.md)
- [项目实战工作台](project-workbench/README.md)
- [项目实战状态 manifest](project-workbench/project-manifest.json)

## 正文书稿

- [数据库全书正文入口](manuscript/README.md)
- [正文覆盖清单](manuscript/COVERAGE.md)
- [0. 核心定位](manuscript/chapter-00-positioning.md)
- [第 1 章：数据库基础：用 PostgreSQL 建立数据系统直觉](manuscript/part-01-postgresql-foundations/chapter-01.md)
- [第 2 章：SQL 分析能力](manuscript/chapter-02-sql-analysis.md)
- [第 3 章：PostgreSQL 大表能力](manuscript/chapter-03-postgresql-large-tables.md)
- [第 4 章：OLTP vs OLAP](manuscript/chapter-04-oltp-olap.md)
- [第 5 章：数据仓库建模](manuscript/chapter-05-data-warehouse-modeling.md)
- [第 6 章：ETL / ELT](manuscript/chapter-06-etl-elt.md)
- [第 7 章：批处理系统](manuscript/chapter-07-batch-processing.md)
- [第 8 章：实时数据处理](manuscript/chapter-08-stream-processing.md)
- [第 9 章：OLAP 数据库](manuscript/chapter-09-olap-databases.md)
- [第 10 章：向量数据库](manuscript/chapter-10-vector-databases.md)
- [第 11 章：图数据库](manuscript/chapter-11-graph-databases.md)
- [第 12 章：数据湖与湖仓](manuscript/chapter-12-lakehouse.md)
- [第 13 章：数据治理](manuscript/chapter-13-data-governance.md)
- [第 14 章：项目实战](manuscript/chapter-14-projects.md)
- [第 15 章：推荐学习顺序](manuscript/chapter-15-learning-order.md)
- [第 16 章：能力地图](manuscript/chapter-16-capability-map.md)
- [第 17 章：最终学习目标](manuscript/chapter-17-final-goals.md)

## 在线阅读站点

- 源文件目录：`site/`
- 生成脚本：[scripts/generate-site.mjs](scripts/generate-site.mjs)
- 章节结构验证：`node scripts/verify-book-structure.mjs`
- 写作契约验证：`node scripts/verify-writing-contract.mjs`
- 正文深度验证：`node scripts/verify-manuscript-depth.mjs`
- 术语一致性验证：`node scripts/verify-terminology.mjs`
- 编辑质量残留验证：`node scripts/verify-editorial-quality.mjs`
- SQL 样例静态验证：`node scripts/verify-sql-examples.mjs`
- 项目实战 manifest 与骨架验证：`node scripts/verify-project-workbench.mjs`
- 事实核查矩阵验证：`node scripts/verify-fact-check-matrix.mjs`
- 事实核查记录生成：`pnpm facts:generate-records`
- 完成审计边界验证：`node scripts/verify-completion-audit.mjs`
- PostgreSQL 样例运行：`pnpm sql:run`
- 本地开发：`pnpm docs:dev`
- 构建验证：`pnpm docs:build`
- SQL 样例数据：`site/public/examples/ecommerce-postgres.sql`
