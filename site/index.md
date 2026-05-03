---
layout: home
hero:
  name: "数据库全书"
  text: "从 PostgreSQL 到智能数据系统"
  tagline: "一条从会查数据到会构建大数据与 AI 数据基础设施的系统化学习路径。"
  actions:
    - theme: brand
      text: 开始阅读
      link: /chapters/00-positioning
    - theme: alt
      text: 查看路线图
      link: /roadmap
features:
  - title: PostgreSQL 作为入口
    details: 先建立数据组织、约束、事务、查询和单机边界的直觉。
  - title: 大数据系统演化
    details: 从 SQL、数仓、ETL/CDC、批处理、实时、OLAP 到湖仓。
  - title: AI 数据基础设施
    details: 把向量数据库、图数据库、RAG、GraphRAG 和治理纳入统一架构。
---

## 阅读路径

- [0. 核心定位](/chapters/00-positioning)：说明本书为什么以 PostgreSQL 为入口，如何把数据库学习连接到大数据与 AI 数据基础设施。
- [1. 数据库基础：用 PostgreSQL 建立数据系统直觉](/chapters/01-postgresql-foundations)：用 PostgreSQL 建立数据如何被组织、约束、查询和保持一致的基础直觉。
- [2. SQL 分析能力：大数据方向第一硬技能](/chapters/02-sql-analysis)：把 SQL 从查询语法提升为分析表达能力，训练取数、聚合、关联、窗口和指标口径。
- [3. PostgreSQL 大表能力：理解单机数据库边界](/chapters/03-postgresql-large-tables)：从分区、索引、物化视图和执行计划理解 PostgreSQL 如何支撑大表，以及边界在哪里。
- [4. OLTP vs OLAP：大数据系统的第一分水岭](/chapters/04-oltp-olap)：解释业务交易和分析计算为什么会分化，以及 PostgreSQL 与 OLAP 系统如何分工。
- [5. 数据仓库建模：从表设计到分析建模](/chapters/05-data-warehouse-modeling)：把业务表重构成事实表、维度表、分层模型和稳定指标体系。
- [6. ETL / ELT：数据如何进入大数据系统](/chapters/06-etl-elt)：说明 PostgreSQL 数据如何通过批量同步、CDC、转换和调度进入数据平台。
- [7. 批处理系统：Hive / Spark / Trino](/chapters/07-batch-processing)：理解 Hive、Spark、Trino 在历史数据加工、分布式计算和跨源分析中的定位。
- [8. 实时数据处理：Kafka / Flink](/chapters/08-stream-processing)：围绕事件流、状态、窗口、水位线和一致性理解实时数据系统。
- [9. OLAP 数据库：ClickHouse / Doris / DuckDB](/chapters/09-olap-databases)：理解列式存储、MPP、本地 OLAP 和 PostgreSQL 到分析库的链路。
- [10. 向量数据库：面向 AI / RAG / 语义检索的数据系统](/chapters/10-vector-databases)：把非结构化数据转成可检索语义空间，理解 RAG、混合检索和向量治理。
- [11. 图数据库：面向关系网络 / 知识图谱 / 路径分析的数据系统](/chapters/11-graph-databases)：理解节点、边、路径、多跳查询、知识图谱和 GraphRAG 在数据平台中的位置。
- [12. 数据湖与湖仓架构](/chapters/12-lakehouse)：用对象存储、文件格式、表格式、Catalog 和多引擎查询构建开放分析底座。
- [13. 数据治理与工程化](/chapters/13-data-governance)：覆盖质量、元数据、血缘、权限、指标和 AI 知识治理，让数据平台长期可信。
- [14. 大数据方向项目实战](/chapters/14-projects)：用 7 个项目把 PostgreSQL、OLAP、实时、湖仓、RAG、图和治理串成可执行闭环。
- [15. 推荐学习顺序](/chapters/15-learning-order)：给出从 PostgreSQL 到数据治理的阶段化学习路径，避免直接跳工具。
- [16. 能力地图](/chapters/16-capability-map)：把全书能力沉淀为 SQL、建模、链路、选型和治理五类能力。
- [17. 最终学习目标](/chapters/17-final-goals)：定义从会查数据到会构建智能数据系统的最终能力标准。
