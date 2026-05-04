# 项目 2 架构链路图

## 系统架构

```text
PostgreSQL (OLTP 源库)
  |
  |-- users, products, orders, order_items, payments
  |
  v
同步任务层
  |
  |-- 初始同步：全量 COPY 导出 -> Parquet -> ClickHouse INSERT
  |-- 增量同步：按 updated_at 增量拉取 -> ReplacingMergeTree 去重
  |-- 失败重跑：幂等写入，支持断点续传
  |
  v
ClickHouse (OLAP 目标库)
  |
  |-- orders_wide (明细表, MergeTree)
  |     PARTITION BY toYYYYMM(created_at)
  |     ORDER BY (created_at, category, user_id, order_id)
  |
  |-- daily_gmv (汇总表, ReplacingMergeTree)
  |     PARTITION BY toYYYYMM(dt)
  |     ORDER BY (dt, category)
  |
  v
BI / 查询层
  |
  |-- 明细查询：按时间、品类、用户维度筛选
  |-- 汇总查询：GMV、订单数、客单价、复购率
  |-- 对账：行数对账 + 指标对账
```

## 同步方式

- 初始同步：批量全量导入
- 增量同步：按时间戳增量拉取
- 非 CDC：不依赖 WAL，不解决跨系统强一致事务

## 失败重跑和迟到数据

- 失败重跑：ReplacingMergeTree 保证幂等
- 迟到数据：通过 version 字段保留最新版本
- 不承担订单状态约束：状态变更以 PostgreSQL 为准
