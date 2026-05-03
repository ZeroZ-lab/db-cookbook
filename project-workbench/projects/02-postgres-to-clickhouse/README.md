# 项目 2：PostgreSQL 到 ClickHouse 分析链路

## 目标

理解 OLTP 与 OLAP 为什么分离，并设计从 PostgreSQL 明细数据到 ClickHouse 分析表的最小链路。

## 系统位置

```text
PostgreSQL
  -> 批量同步或增量同步
  -> ClickHouse 明细表
  -> ClickHouse 汇总表
  -> BI 查询
```

## 数据模型

- PostgreSQL 保留订单、支付、用户等业务事实。
- ClickHouse 明细表承载订单分析宽表。
- ClickHouse 汇总表承载每日 GMV、订单数、支付成功率。
- 字段映射见 `mappings/orders-wide-mapping.md`。
- ClickHouse DDL 见 `clickhouse/schema.sql`。
- 日 GMV 查询见 `queries/daily-gmv.sql`。
- 表设计说明见 `docs/table-design-notes.md`。
- 同步策略说明见 `docs/sync-strategy.md`。

## 核心链路

- 定义哪些查询留在 PostgreSQL。
- 定义哪些查询迁移到 ClickHouse。
- 设计 MergeTree 表的 `PARTITION BY` 和 `ORDER BY`。
- 设计每日汇总物化视图或汇总任务。
- 记录初始同步、增量同步、失败重跑和迟到数据处理边界。

## 验收指标

- [ ] 有 PostgreSQL 到 ClickHouse 的字段映射表。
- [ ] 有 ClickHouse 明细表 DDL。
- [ ] 有每日 GMV 汇总表 DDL 或 SQL。
- [x] 能解释排序键和分区键选择。
- [x] 有初始同步、增量同步和失败重跑说明。
- [x] 有运行记录模板区分静态检查与真实 ClickHouse 执行。
- [ ] 能说明 ClickHouse 不替代业务事务库。

## 运行命令

```bash
project-workbench/projects/02-postgres-to-clickhouse/run.sh
pnpm projects:verify
```

如果本机有 ClickHouse 客户端，可在创建 ClickHouse 服务后执行：

```bash
clickhouse client --queries-file project-workbench/projects/02-postgres-to-clickhouse/clickhouse/schema.sql
clickhouse client --queries-file project-workbench/projects/02-postgres-to-clickhouse/queries/daily-gmv.sql
```

## 质量检查

- 明细表字段必须能追溯回 PostgreSQL 源字段。
- 汇总表必须写明刷新周期、迟到数据处理和口径版本。
- 对账记录模板见 `reports/reconciliation-template.md`。
- 运行记录模板见 `reports/run-record-template.md`。

## 复盘问题

- 查询性能提升来自列式存储、排序键还是预聚合？
- 哪些业务约束不能迁移给 ClickHouse 承担？
