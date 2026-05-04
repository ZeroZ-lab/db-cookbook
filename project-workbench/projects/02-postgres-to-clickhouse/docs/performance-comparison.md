# 查询性能对比记录模板

## 测试环境

| 维度 | PostgreSQL | ClickHouse |
| --- | --- | --- |
| 版本 | [待填写] | [待填写] |
| 数据量 | [待填写] | [待填写] |
| 硬件 | [待填写] | [待填写] |

## 对比查询

### 查询 1：每日 GMV

```sql
-- PostgreSQL
SELECT date(created_at) AS dt, SUM(total_amount)
FROM orders WHERE order_status = 'paid'
GROUP BY date(created_at);

-- ClickHouse
SELECT toDate(created_at) AS dt, sumIf(item_amount, order_status = 'paid')
FROM analytics.orders_wide
GROUP BY toDate(created_at);
```

| 指标 | PostgreSQL | ClickHouse |
| --- | --- | --- |
| 执行时间 | [待填写] | [待填写] |
| 扫描行数 | [待填写] | [待填写] |
| 内存使用 | [待填写] | [待填写] |

### 查询 2：品类 GMV 排名

```sql
-- PostgreSQL
SELECT p.category, SUM(oi.item_amount)
FROM order_items oi JOIN products p ON oi.product_id = p.product_id
JOIN orders o ON oi.order_id = o.order_id
WHERE o.order_status = 'paid'
GROUP BY p.category ORDER BY SUM(oi.item_amount) DESC;

-- ClickHouse
SELECT category, sumIf(item_amount, order_status = 'paid')
FROM analytics.orders_wide
GROUP BY category
ORDER BY sumIf(item_amount, order_status = 'paid') DESC;
```

| 指标 | PostgreSQL | ClickHouse |
| --- | --- | --- |
| 执行时间 | [待填写] | [待填写] |
| 扫描行数 | [待填写] | [待填写] |
| 内存使用 | [待填写] | [待填写] |

### 查询 3：用户 GMV 分布

```sql
-- PostgreSQL
SELECT user_id, SUM(total_amount)
FROM orders WHERE order_status = 'paid'
GROUP BY user_id;

-- ClickHouse
SELECT user_id, sumIf(item_amount, order_status = 'paid')
FROM analytics.orders_wide
GROUP BY user_id;
```

| 指标 | PostgreSQL | ClickHouse |
| --- | --- | --- |
| 执行时间 | [待填写] | [待填写] |
| 扫描行数 | [待填写] | [待填写] |
| 内存使用 | [待填写] | [待填写] |

## 结论

- ClickHouse 在聚合查询上的优势：[待填写]
- PostgreSQL 在点查上的优势：[待填写]
- 迁移收益最明显的查询类型：[待填写]
