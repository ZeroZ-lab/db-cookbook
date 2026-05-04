# 业务事实关系说明

## 核心实体关系

```text
users (用户)
  |-- user_id (PK)
  |-- name, email, channel, user_level, registered_at
  |
  |-- (1:N) -> orders: 一个用户可以有多个订单
  |-- (1:N) -> events: 一个用户可以产生多个行为事件

products (商品)
  |-- product_id (PK)
  |-- product_name, category, list_price
  |
  |-- (1:N) -> order_items: 一个商品可以出现在多个订单明细中
  |-- (1:N) -> events: 一个商品可以被多个用户浏览/加购

orders (订单)
  |-- order_id (PK)
  |-- user_id (FK -> users)
  |-- order_status, total_amount, created_at, paid_at
  |
  |-- (1:N) -> order_items: 一个订单包含多个明细行
  |-- (1:N) -> payments: 一个订单可以有多次支付记录

order_items (订单明细)
  |-- order_item_id (PK)
  |-- order_id (FK -> orders)
  |-- product_id (FK -> products)
  |-- quantity, item_amount

payments (支付)
  |-- payment_id (PK)
  |-- order_id (FK -> orders)
  |-- payment_status, payment_method, paid_amount, paid_at

events (行为事件)
  |-- event_id (PK)
  |-- user_id (FK -> users)
  |-- product_id (FK -> products, nullable)
  |-- event_name, event_time
```

## payments 支撑的分析问题

| 分析问题 | SQL 路径 |
| --- | --- |
| 支付成功率 | `COUNT(CASE WHEN payment_status='success' THEN 1 END) / COUNT(*)` |
| 支付方式分布 | `GROUP BY payment_method` |
| 实付 vs 标价差异 | `JOIN orders ON ... WHERE paid_amount != total_amount` |
| 支付时间分布 | `GROUP BY EXTRACT(HOUR FROM paid_at)` |

## events 支撑的分析问题

| 分析问题 | SQL 路径 |
| --- | --- |
| DAU/MAU | `COUNT(DISTINCT user_id) WHERE event_name='app_open'` |
| 浏览热度 | `COUNT(*) WHERE event_name='view_product' GROUP BY product_id` |
| 转化漏斗 | `COUNT(DISTINCT user_id) WHERE event_name IN ('app_open','view_product','purchase')` |
| 渠道转化率 | `JOIN users ON ... GROUP BY channel` |

## 业务查询 vs 分析查询

### 业务查询（OLTP 特征）

- 点查：`WHERE user_id = ?` 或 `WHERE order_id = ?`
- 范围小：返回 1-100 行
- 频率高：每次用户操作触发
- 需要索引：`user_id`, `order_id` 上必须有索引

### 分析查询（OLAP 特征）

- 聚合：`GROUP BY date(created_at)`, `GROUP BY category`
- 范围大：扫描全表或大范围分区
- 频率低：每日/每周运行一次
- 可容忍延迟：秒级到分钟级
