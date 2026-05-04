# 索引优化对比说明

## 现有索引

```sql
-- 订单表：用户 + 时间复合索引
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at DESC);

-- 事件表：时间索引
CREATE INDEX idx_events_time ON events(event_time);
```

## 索引优化前后对比

### 对比 1：用户订单查询

**查询**：查询某用户的最近订单

```sql
SELECT * FROM orders WHERE user_id = 1 ORDER BY created_at DESC LIMIT 10;
```

**优化前**（无 `idx_orders_user_created`）：
- 执行计划：Seq Scan on orders
- 代价：全表扫描，O(N)

**优化后**（有 `idx_orders_user_created`）：
- 执行计划：Index Scan using idx_orders_user_created on orders
- 代价：索引定位，O(log N)

### 对比 2：时间范围事件查询

**查询**：查询某天的行为事件

```sql
SELECT * FROM events WHERE event_time >= '2026-04-03' AND event_time < '2026-04-04';
```

**优化前**（无 `idx_events_time`）：
- 执行计划：Seq Scan on events
- 代价：全表扫描

**优化后**（有 `idx_events_time`）：
- 执行计划：Index Scan using idx_events_time on events
- 代价：索引范围扫描

### 对比 3：品类 GMV 查询（无品类索引）

**查询**：按品类统计 GMV

```sql
SELECT p.category, SUM(oi.item_amount)
FROM order_items oi
JOIN products p ON oi.product_id = p.product_id
GROUP BY p.category;
```

**当前状态**：
- order_items 无 product_id 索引
- products 无 category 索引
- 小数据量下差异不明显，大数据量下需要考虑

**建议优化**：
```sql
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_products_category ON products(category);
```

## EXPLAIN 记录模板

### 记录 1：用户订单查询

```sql
EXPLAIN ANALYZE
SELECT * FROM orders WHERE user_id = 1 ORDER BY created_at DESC LIMIT 10;
```

结果待运行时填写：

```
[待运行时环境验证]
```

### 记录 2：每日 GMV 查询

```sql
EXPLAIN ANALYZE
SELECT date(created_at) AS dt, SUM(total_amount) AS gmv
FROM orders WHERE order_status = 'paid'
GROUP BY date(created_at) ORDER BY dt;
```

结果待运行时填写：

```
[待运行时环境验证]
```

### 记录 3：转化漏斗查询

```sql
EXPLAIN ANALYZE
WITH daily_active AS (
  SELECT date(event_time) AS dt, COUNT(DISTINCT user_id) AS active_users
  FROM events WHERE event_name = 'app_open'
  GROUP BY date(event_time)
),
daily_purchase AS (
  SELECT date(event_time) AS dt, COUNT(DISTINCT user_id) AS purchase_users
  FROM events WHERE event_name = 'purchase'
  GROUP BY date(event_time)
)
SELECT a.dt, a.active_users, COALESCE(p.purchase_users, 0) AS purchase_users
FROM daily_active a LEFT JOIN daily_purchase p ON a.dt = p.dt
ORDER BY a.dt;
```

结果待运行时填写：

```
[待运行时环境验证]
```
