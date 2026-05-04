# 指标口径卡片

## GMV (Gross Merchandise Volume)

| 字段 | 说明 |
| --- | --- |
| 指标名 | GMV（成交总额） |
| 口径 | `SUM(total_amount)` WHERE `order_status = 'paid'` |
| 数据源 | `orders` 表 |
| 粒度 | 可按日、周、月、品类、渠道聚合 |
| 业务含义 | 已支付订单的总金额，不含未支付和已取消订单 |
| 口径风险 | 如果 `total_amount` 含退款订单，需要额外过滤；当前样例数据不区分退款 |

```sql
SELECT
  date(created_at) AS dt,
  SUM(total_amount) AS gmv
FROM orders
WHERE order_status = 'paid'
GROUP BY date(created_at)
ORDER BY dt;
```

## 订单数

| 字段 | 说明 |
| --- | --- |
| 指标名 | 订单数 |
| 口径 | `COUNT(DISTINCT order_id)` WHERE `order_status = 'paid'` |
| 数据源 | `orders` 表 |
| 粒度 | 可按日、周、月聚合 |
| 业务含义 | 已支付的独立订单数量 |
| 口径风险 | 同一订单多次支付不会重复计数（因为是 DISTINCT） |

```sql
SELECT
  date(created_at) AS dt,
  COUNT(DISTINCT order_id) AS order_count
FROM orders
WHERE order_status = 'paid'
GROUP BY date(created_at)
ORDER BY dt;
```

## 客单价

| 字段 | 说明 |
| --- | --- |
| 指标名 | 客单价（ARPU / Average Revenue Per User） |
| 口径 | `GMV / COUNT(DISTINCT user_id)` WHERE `order_status = 'paid'` |
| 数据源 | `orders` 表 |
| 粒度 | 可按日、周、月聚合 |
| 业务含义 | 平均每个付费用户贡献的 GMV |
| 口径风险 | 如果用户在同一天有多笔订单，分母不会重复计数 |

```sql
SELECT
  date(created_at) AS dt,
  SUM(total_amount) / COUNT(DISTINCT user_id) AS arpu
FROM orders
WHERE order_status = 'paid'
GROUP BY date(created_at)
ORDER BY dt;
```

## 复购率

| 字段 | 说明 |
| --- | --- |
| 指标名 | 复购率 |
| 口径 | 二次及以上购买用户数 / 付费用户数 |
| 数据源 | `orders` 表 |
| 粒度 | 通常按月或全量计算 |
| 业务含义 | 衡量用户忠诚度和产品粘性 |
| 口径风险 | 时间窗口选择影响结果：30 天、90 天、全量 |

```sql
WITH user_order_count AS (
  SELECT
    user_id,
    COUNT(DISTINCT order_id) AS order_count
  FROM orders
  WHERE order_status = 'paid'
  GROUP BY user_id
)
SELECT
  COUNT(*) AS total_users,
  COUNT(*) FILTER (WHERE order_count >= 2) AS repeat_users,
  ROUND(
    COUNT(*) FILTER (WHERE order_count >= 2)::numeric / COUNT(*),
    4
  ) AS repeat_rate
FROM user_order_count;
```

## 转化率

| 字段 | 说明 |
| --- | --- |
| 指标名 | 转化率（浏览 -> 下单） |
| 口径 | 下单用户数 / 活跃用户数 |
| 数据源 | `events` 表 |
| 粒度 | 可按日、渠道聚合 |
| 业务含义 | 衡量从浏览到下单的转化效率 |
| 口径风险 | 活跃用户定义需明确：`app_open` 还是 `view_product` |

```sql
WITH daily_active AS (
  SELECT
    date(event_time) AS dt,
    COUNT(DISTINCT user_id) AS active_users
  FROM events
  WHERE event_name = 'app_open'
  GROUP BY date(event_time)
),
daily_purchase AS (
  SELECT
    date(event_time) AS dt,
    COUNT(DISTINCT user_id) AS purchase_users
  FROM events
  WHERE event_name = 'purchase'
  GROUP BY date(event_time)
)
SELECT
  a.dt,
  a.active_users,
  COALESCE(p.purchase_users, 0) AS purchase_users,
  ROUND(
    COALESCE(p.purchase_users, 0)::numeric / a.active_users,
    4
  ) AS conversion_rate
FROM daily_active a
LEFT JOIN daily_purchase p ON a.dt = p.dt
ORDER BY a.dt;
```
