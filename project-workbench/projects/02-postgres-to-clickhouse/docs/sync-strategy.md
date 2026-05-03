# 同步策略说明

## 核心判断

PostgreSQL 到 ClickHouse 的链路不是“换一个数据库保存同一份业务表”，而是把业务事务数据加工成适合分析扫描的事实宽表。PostgreSQL 仍是订单事实的权威来源，ClickHouse 是分析副本。

## 初始同步

初始同步用于建立 ClickHouse 的历史基线：

1. 固定一个同步批次号，例如 `sync_version = initial-2026-05-03`。
2. 从 PostgreSQL 按 `orders.created_at` 分批读取订单、订单明细、用户、商品和支付表。
3. 在同步任务中展开成 `analytics.order_items_wide` 所需字段。
4. 写入 ClickHouse 明细表后，执行 `queries/daily-gmv.sql` 生成每日汇总。
5. 用 `reports/reconciliation-template.md` 记录 PostgreSQL 源行数、ClickHouse 明细行数和 GMV 口径差异。

## 增量同步

增量同步用于持续修正分析副本：

- 如果只做轻量练习，可以用 `updated_at` 水位线批量拉取最近变化。
- 如果要贴近生产链路，应使用 CDC 记录订单状态、支付状态和明细变化。
- 每批增量都必须带 `sync_version`，让汇总表能追溯当前指标来自哪一批数据。
- 对迟到支付、退款和订单取消，应回刷受影响的 `stat_date`、`category`、`channel` 分组，而不是只追加新行。

## 失败重跑

失败重跑的基本原则是让 ClickHouse 侧可重复写入：

- 明细表按批次记录 `sync_version`，方便定位某一批的写入范围。
- 汇总表使用 `ReplacingMergeTree(updated_at)`，同一统计键重复写入时以最新版本为准。
- 重跑前必须记录本次重算范围，避免把“部分重算”的结果误当成完整指标。

## 不解决的问题

这条链路不解决跨系统强一致事务。订单支付成功后，PostgreSQL 与 ClickHouse 之间天然存在同步延迟；BI 查询需要展示数据时间、批次号或同步水位，不能把 ClickHouse 指标当成业务事务确认依据。
