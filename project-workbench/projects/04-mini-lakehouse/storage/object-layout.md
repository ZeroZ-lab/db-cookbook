# 对象存储与 Parquet 布局

对象存储根路径：

```text
s3://db-cookbook-lakehouse/
  raw/postgres/orders/dt=2026-05-03/*.parquet
  raw/postgres/order_items/dt=2026-05-03/*.parquet
  raw/postgres/payments/dt=2026-05-03/*.parquet
  warehouse/iceberg/orders/
  warehouse/iceberg/order_items/
  marts/order_items_wide/dt=2026-05-03/*.parquet
```

## 分区规则

| 数据集 | 分区字段 | 原因 | 风险 |
| --- | --- | --- | --- |
| `raw.postgres.orders` | `dt = to_date(created_at)` | 按下单日期回放和补数 | 迟到支付需要修正 |
| `raw.postgres.order_items` | `dt = orders.created_at` | 与订单主表对齐 | 需要订单时间冗余 |
| `raw.postgres.payments` | `dt = to_date(paid_at)` | 支付口径按支付时间分析 | 未支付记录要单独处理 |
| `marts.order_items_wide` | `dt = to_date(created_at)` | 支撑日级分析和重跑 | 小文件需要合并 |

## 边界

- Parquet 只解决列式文件存储和压缩，不解决快照、事务、schema 演化或多引擎一致性。
- 对象存储只保存文件，不理解表、分区演化、提交版本和回滚。
- Iceberg 负责把文件组织成可演化、可回溯、可被多个引擎理解的表。
