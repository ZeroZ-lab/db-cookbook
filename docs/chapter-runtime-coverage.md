# 章节可运行性覆盖表

本表不把“可阅读”误写成“可运行”。它只说明每章当前已经具备哪一层验证资产，以及还缺什么。

## 状态说明

| 状态 | 含义 |
| --- | --- |
| `reading-only` | 当前主要依赖正文、图表、案例和人工判断阅读 |
| `static-sql` | 已有 SQL 或结构样例，可做静态一致性校验 |
| `real-sql-optional` | 已给出真实数据库运行路径，但当前环境未证明已跑通 |
| `project-backed` | 有 `project-workbench` 对应项目骨架和交付清单支撑 |
| `external-runtime-needed` | 要进入真实运行验证，必须补数据库、中间件或计算引擎环境 |

## 覆盖表

| 章节 | 当前层级 | 主要证据 | 当前边界 |
| --- | --- | --- | --- |
| 第 0 章 核心定位 | `reading-only` | 正文、站点入口、路线图 | 负责定位，不承担可运行任务 |
| 第 1 章 PostgreSQL 基础 | `reading-only` | 正文、电商模型、SQL Lab 共用样例 schema | 依赖第 2 章和项目 1 进入更强验证 |
| 第 2 章 SQL 分析能力 | `static-sql`, `real-sql-optional` | `site/public/examples/*.sql`、`pnpm sql:verify`、`pnpm sql:run` | 当前环境未证明 PostgreSQL 实库已跑通 |
| 第 3 章 PostgreSQL 大表能力 | `reading-only`, `real-sql-optional` | 正文、执行计划讨论、项目 1 运行入口 | 缺真实 `EXPLAIN ANALYZE` 运行记录 |
| 第 4 章 OLTP vs OLAP | `reading-only`, `project-backed` | 正文、项目 2 | 属于架构判断章节，不直接等于引擎运行验证 |
| 第 5 章 数据仓库建模 | `reading-only`, `project-backed` | 正文、项目 2-4 建模骨架 | 仍缺可运行数仓任务和对账记录 |
| 第 6 章 ETL / ELT | `project-backed`, `external-runtime-needed` | 项目 2-4、项目 3 CDC 资产 | 缺 Kafka / Flink / 实际同步运行记录 |
| 第 7 章 批处理系统 | `project-backed`, `external-runtime-needed` | 项目 4 | 缺 Spark / Trino 实跑证据 |
| 第 8 章 实时数据处理 | `project-backed`, `external-runtime-needed` | 项目 3 | 缺 Kafka / Flink / Sink 运行记录 |
| 第 9 章 OLAP 数据库 | `project-backed`, `external-runtime-needed` | 项目 2、项目 4 | 缺 ClickHouse / Doris / DuckDB 实际查询证据 |
| 第 10 章 向量数据库 | `project-backed`, `external-runtime-needed` | 项目 5、事实核查资产 | 缺 embedding 生成和检索评测运行记录 |
| 第 11 章 图数据库 | `project-backed`, `external-runtime-needed` | 项目 6、事实核查资产 | 缺图加载和 GraphRAG 执行记录 |
| 第 12 章 湖仓 | `project-backed`, `external-runtime-needed` | 项目 4、事实核查资产 | 缺 Iceberg / Spark / Trino 联合运行记录 |
| 第 13 章 数据治理 | `project-backed` | 项目 7、事实核查资产 | 当前更偏治理设计与审计骨架 |
| 第 14 章 项目实战 | `project-backed`, `external-runtime-needed` | `project-workbench/project-manifest.json`、`docs/project-runbook.md` | 当前主要证明骨架与交付状态，不证明端到端跑通 |
| 第 15 章 推荐学习顺序 | `reading-only` | 正文、路线图 | 不承担运行验证 |
| 第 16 章 能力地图 | `reading-only` | 正文、站点导航 | 不承担运行验证 |
| 第 17 章 最终学习目标 | `reading-only` | 正文、站点导航 | 不承担运行验证 |

## 第 2-6 章优先可运行入口

| 章节 | 建议入口 | 当前状态 |
| --- | --- | --- |
| 第 2 章 | [site/sql-lab.md](../site/sql-lab.md) | 已有静态校验和 PostgreSQL 运行路径 |
| 第 3 章 | 项目 1 `run.sh` + 后续补 `EXPLAIN` 记录 | 当前只有入口，没有实库运行记录 |
| 第 4 章 | 项目 2 对比 PostgreSQL 与 ClickHouse | 当前为静态产物和架构说明 |
| 第 5 章 | 项目 2 宽表映射、项目 4 湖仓建模 | 当前为静态设计资产 |
| 第 6 章 | 项目 3 CDC / Kafka / Flink | 当前为关键 SQL / JSON / 文档骨架 |
