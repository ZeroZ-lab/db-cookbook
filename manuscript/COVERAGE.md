# 正文覆盖清单

本清单用于确认 `docs/course-outline.md` 中的 0-17 部分已经映射到 `manuscript/` 正文。

| 目录项 | 正文文件 | 状态 |
| --- | --- | --- |
| 0. 核心定位 | [chapter-00-positioning.md](chapter-00-positioning.md) | 已按八段结构扩写 |
| 1. 数据库基础：用 PostgreSQL 建立数据系统直觉 | [part-01-postgresql-foundations/chapter-01.md](part-01-postgresql-foundations/chapter-01.md) | 已按八段结构扩写 |
| 2. SQL 分析能力 | [chapter-02-sql-analysis.md](chapter-02-sql-analysis.md) | 已按八段结构扩写 |
| 3. PostgreSQL 大表能力 | [chapter-03-postgresql-large-tables.md](chapter-03-postgresql-large-tables.md) | 已按八段结构扩写 |
| 4. OLTP vs OLAP | [chapter-04-oltp-olap.md](chapter-04-oltp-olap.md) | 已按八段结构扩写 |
| 5. 数据仓库建模 | [chapter-05-data-warehouse-modeling.md](chapter-05-data-warehouse-modeling.md) | 已按八段结构扩写 |
| 6. ETL / ELT | [chapter-06-etl-elt.md](chapter-06-etl-elt.md) | 已按八段结构扩写 |
| 7. 批处理系统 | [chapter-07-batch-processing.md](chapter-07-batch-processing.md) | 已按八段结构扩写 |
| 8. 实时数据处理 | [chapter-08-stream-processing.md](chapter-08-stream-processing.md) | 已按八段结构扩写 |
| 9. OLAP 数据库 | [chapter-09-olap-databases.md](chapter-09-olap-databases.md) | 已按八段结构扩写 |
| 10. 向量数据库 | [chapter-10-vector-databases.md](chapter-10-vector-databases.md) | 已按八段结构扩写 |
| 11. 图数据库 | [chapter-11-graph-databases.md](chapter-11-graph-databases.md) | 已按八段结构扩写 |
| 12. 数据湖与湖仓架构 | [chapter-12-lakehouse.md](chapter-12-lakehouse.md) | 已按八段结构扩写 |
| 13. 数据治理与工程化 | [chapter-13-data-governance.md](chapter-13-data-governance.md) | 已按八段结构扩写 |
| 14. 大数据方向项目实战 | [chapter-14-projects.md](chapter-14-projects.md) | 已按八段结构扩写 |
| 15. 推荐学习顺序 | [chapter-15-learning-order.md](chapter-15-learning-order.md) | 已按八段结构扩写 |
| 16. 能力地图 | [chapter-16-capability-map.md](chapter-16-capability-map.md) | 已按八段结构扩写 |
| 17. 最终学习目标 | [chapter-17-final-goals.md](chapter-17-final-goals.md) | 已按八段结构扩写 |

## 完成口径

当前状态是“全目录正文初稿完成，出版级深度继续扩写”：

- 每个目录项都有独立正文文件。
- 每个正文文件包含机制解释、系统位置、常见误区或实战任务等可阅读内容。
- `README.md` 和 `manuscript/README.md` 已提供正文入口。
- 当前未发现空白章节或修复类标记。

但这不等于最终目标已经完成。`db-cookbook` 的最终目标是一本由浅入深、系统完整、细节充分的数据库学习书，因此后续仍要按 [书稿扩写与验收计划](../docs/book-expansion-plan.md) 继续做：

- 章节八段结构显式化。
- 机制、边界、代价和工程落地加深。
- SQL 与项目任务可运行化。
- 案例、术语、配图和事实校验统一。
