# 项目 1 交付物：PostgreSQL 电商数据分析库

## 架构产物

- [x] 画出 `users -> orders -> order_items -> products` 的业务事实关系：`docs/architecture.md`。
- [x] 标出 `payments` 和 `events` 分别支撑哪些分析问题：`docs/business-fact-relationship.md`。
- [x] 说明哪些查询是业务查询，哪些查询是分析查询：`docs/query-categories.md`。

## 数据模型产物

- [x] 保存 PostgreSQL DDL：`site/public/examples/ecommerce-postgres.sql`。
- [x] 保存样例数据来源和生成方式：`docs/ddl-source.md`。
- [x] 为 GMV、订单数、客单价、复购率、转化率写出口径卡片：`docs/metric-definitions.md`。

## 核心任务产物

- [x] 至少 20 条分析 SQL：`queries/analysis-queries.sql`（24 条）。
- [x] 至少 3 条 `EXPLAIN` 记录：`queries/explain-records.sql`（3 条）。
- [x] 至少 1 个索引优化前后对比：`docs/index-optimization.md`。
- [x] 至少 1 个分区或物化视图设计说明：`docs/partition-materialized-views.md`。

## 验证证据

- [x] `pnpm sql:verify` 输出。
- [x] `bash project-workbench/projects/01-postgresql-analytics/run.sh` 输出。
- [ ] 如使用容器，保存 `docker compose -f project-workbench/projects/01-postgresql-analytics/docker-compose.yml up -d` 输出和健康检查结果。
- [ ] 查询结果截图或文本记录。
- [ ] 慢查询分析记录。

## 复盘记录

- PostgreSQL 能解决的分析问题：
- PostgreSQL 不能长期承担的问题：
- 下一步迁移到 OLAP 的理由：
