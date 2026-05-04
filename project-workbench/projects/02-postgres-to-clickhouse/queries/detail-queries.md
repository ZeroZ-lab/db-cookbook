# 明细查询 SQL

## 订单明细查询

### 按时间范围查询订单明细

```sql
SELECT
  order_id,
  user_id,
  category,
  total_amount,
  order_status,
  created_at
FROM analytics.orders_wide
WHERE created_at >= '2026-04-01' AND created_at < '2026-05-01'
ORDER BY created_at DESC
LIMIT 100;
```

### 按品类查询订单明细

```sql
SELECT
  order_id,
  user_id,
  product_name,
  category,
  item_amount,
  created_at
FROM analytics.orders_wide
WHERE category = 'electronics'
  AND created_at >= '2026-04-01'
ORDER BY item_amount DESC
LIMIT 50;
```

### 按用户查询订单历史

```sql
SELECT
  order_id,
  product_name,
  category,
  quantity,
  item_amount,
  order_status,
  created_at
FROM analytics.orders_wide
WHERE user_id = 1
ORDER BY created_at DESC;
```

## 与 PostgreSQL 对比

| 维度 | PostgreSQL | ClickHouse |
| --- | --- | --- |
| 引擎特性 | 行存，适合点查 | 列存，适合聚合 |
| 明细查询 | 索引命中后快 | 全列扫描快，但点查不如 PG |
| 聚合查询 | 大表慢 | 向量化执行快 |
| 适用场景 | OLTP 点查 | OLAP 分析 |

明细查询在 ClickHouse 中的收益不如聚合查询明显，但当需要扫描大量明细行时，列存的 IO 优势仍然存在。
