# 项目 2 交付物：PostgreSQL 到 ClickHouse 分析链路

## 架构产物

- [ ] 画出 PostgreSQL、同步任务、ClickHouse 明细表、汇总表、BI 的链路。
- [ ] 标出同步方式是批量、增量还是 CDC。
- [ ] 标出失败重跑和迟到数据的位置。

## 数据模型产物

- [x] PostgreSQL 源表到 ClickHouse 明细表字段映射：`mappings/orders-wide-mapping.md`。
- [x] ClickHouse 明细表 DDL：`clickhouse/schema.sql`。
- [x] ClickHouse 每日汇总表 DDL：`clickhouse/schema.sql`。
- [x] 排序键、分区键和保留周期说明：`docs/table-design-notes.md`。

## 核心任务产物

- [x] 初始同步脚本或伪代码：`docs/sync-strategy.md`。
- [x] 增量同步策略说明：`docs/sync-strategy.md`。
- [ ] 明细查询 SQL。
- [x] 汇总查询 SQL：`queries/daily-gmv.sql`。

## 验证证据

- [x] 字段映射完整性检查：由 `pnpm projects:verify` 静态检查关键产物。
- [x] 本地静态运行入口：`run.sh`。
- [x] 运行记录模板：`reports/run-record-template.md`。
- [ ] 明细行数对账。
- [ ] 汇总指标对账。
- [ ] 查询性能对比记录。

## 复盘记录

- 哪些查询迁移后收益明显：
- 哪些数据仍应留在 PostgreSQL：
- ClickHouse 表设计中最重要的取舍：
