-- 2.1 基础查询：最近已支付订单
SELECT
  order_id,
  user_id,
  total_amount,
  order_status,
  created_at
FROM orders
WHERE order_status = 'paid'
ORDER BY created_at DESC
LIMIT 20;

-- 2.2 聚合分析：每日 GMV 和订单数
SELECT
  date(created_at) AS order_date,
  COUNT(*) AS order_count,
  SUM(total_amount) AS gmv
FROM orders
WHERE order_status = 'paid'
GROUP BY date(created_at)
ORDER BY order_date;

-- 2.3 多表关联：订单、用户、商品明细
SELECT
  o.order_id,
  u.name AS user_name,
  p.product_name,
  oi.quantity,
  oi.item_amount
FROM orders o
JOIN users u ON o.user_id = u.user_id
JOIN order_items oi ON o.order_id = oi.order_id
JOIN products p ON oi.product_id = p.product_id
ORDER BY o.order_id, oi.order_item_id;

-- 2.4 CTE：用户 GMV
WITH paid_orders AS (
  SELECT *
  FROM orders
  WHERE order_status = 'paid'
),
user_gmv AS (
  SELECT
    user_id,
    SUM(total_amount) AS gmv
  FROM paid_orders
  GROUP BY user_id
)
SELECT
  u.user_id,
  u.name,
  COALESCE(g.gmv, 0) AS gmv
FROM users u
LEFT JOIN user_gmv g ON u.user_id = g.user_id
ORDER BY gmv DESC;

-- 2.5 窗口函数：每个用户的订单序号
SELECT
  order_id,
  user_id,
  total_amount,
  created_at,
  ROW_NUMBER() OVER (
    PARTITION BY user_id
    ORDER BY created_at
  ) AS order_seq
FROM orders
ORDER BY user_id, order_seq;

-- 2.6 指标 SQL：DAU
SELECT
  date(event_time) AS dt,
  COUNT(DISTINCT user_id) AS dau
FROM events
WHERE event_name = 'app_open'
GROUP BY date(event_time)
ORDER BY dt;
