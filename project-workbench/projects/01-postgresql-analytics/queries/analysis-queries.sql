-- ============================================================
-- 项目 1：PostgreSQL 电商数据分析库 - 分析 SQL 集
-- 共 24 条分析查询，覆盖 GMV、订单、用户、转化、留存等维度
-- ============================================================

-- 口径说明见 docs/metric-definitions.md
-- 查询分类见 docs/query-categories.md

-- ============================================================
-- 一、GMV 与订单分析
-- ============================================================

-- Q01: 每日 GMV
SELECT
  date(created_at) AS dt,
  SUM(total_amount) AS gmv
FROM orders
WHERE order_status = 'paid'
GROUP BY date(created_at)
ORDER BY dt;

-- Q02: 每日订单数
SELECT
  date(created_at) AS dt,
  COUNT(DISTINCT order_id) AS order_count
FROM orders
WHERE order_status = 'paid'
GROUP BY date(created_at)
ORDER BY dt;

-- Q03: 每日 GMV 和订单数（合并）
SELECT
  date(created_at) AS dt,
  COUNT(DISTINCT order_id) AS order_count,
  SUM(total_amount) AS gmv,
  ROUND(SUM(total_amount) / COUNT(DISTINCT order_id), 2) AS avg_order_value
FROM orders
WHERE order_status = 'paid'
GROUP BY date(created_at)
ORDER BY dt;

-- Q04: 品类 GMV 排名
SELECT
  p.category,
  SUM(oi.item_amount) AS category_gmv,
  COUNT(DISTINCT oi.order_id) AS order_count
FROM order_items oi
JOIN products p ON oi.product_id = p.product_id
JOIN orders o ON oi.order_id = o.order_id
WHERE o.order_status = 'paid'
GROUP BY p.category
ORDER BY category_gmv DESC;

-- Q05: 商品 GMV 排名
SELECT
  p.product_name,
  p.category,
  SUM(oi.item_amount) AS product_gmv,
  SUM(oi.quantity) AS total_quantity
FROM order_items oi
JOIN products p ON oi.product_id = p.product_id
JOIN orders o ON oi.order_id = o.order_id
WHERE o.order_status = 'paid'
GROUP BY p.product_id, p.product_name, p.category
ORDER BY product_gmv DESC;

-- ============================================================
-- 二、用户分析
-- ============================================================

-- Q06: 用户 GMV 排名
SELECT
  u.user_id,
  u.name,
  u.channel,
  u.user_level,
  SUM(o.total_amount) AS user_gmv,
  COUNT(DISTINCT o.order_id) AS order_count
FROM orders o
JOIN users u ON o.user_id = u.user_id
WHERE o.order_status = 'paid'
GROUP BY u.user_id, u.name, u.channel, u.user_level
ORDER BY user_gmv DESC;

-- Q07: 客单价（ARPU）
SELECT
  date(created_at) AS dt,
  SUM(total_amount) / COUNT(DISTINCT user_id) AS arpu
FROM orders
WHERE order_status = 'paid'
GROUP BY date(created_at)
ORDER BY dt;

-- Q08: 复购率
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

-- Q09: 渠道用户分布
SELECT
  channel,
  COUNT(*) AS user_count,
  COUNT(*) FILTER (WHERE user_level = 'gold') AS gold_users,
  COUNT(*) FILTER (WHERE user_level = 'silver') AS silver_users,
  COUNT(*) FILTER (WHERE user_level = 'bronze') AS bronze_users
FROM users
GROUP BY channel
ORDER BY user_count DESC;

-- Q10: 用户订单序号（窗口函数）
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

-- ============================================================
-- 三、转化分析
-- ============================================================

-- Q11: DAU（日活跃用户数）
SELECT
  date(event_time) AS dt,
  COUNT(DISTINCT user_id) AS dau
FROM events
WHERE event_name = 'app_open'
GROUP BY date(event_time)
ORDER BY dt;

-- Q12: 转化漏斗（浏览 -> 下单）
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

-- Q13: 商品浏览热度
SELECT
  p.product_name,
  p.category,
  COUNT(*) AS view_count
FROM events e
JOIN products p ON e.product_id = p.product_id
WHERE e.event_name = 'view_product'
GROUP BY p.product_id, p.product_name, p.category
ORDER BY view_count DESC;

-- ============================================================
-- 四、支付分析
-- ============================================================

-- Q14: 支付方式分布
SELECT
  payment_method,
  COUNT(*) AS payment_count,
  SUM(paid_amount) AS total_paid,
  ROUND(AVG(paid_amount), 2) AS avg_paid
FROM payments
WHERE payment_status = 'success'
GROUP BY payment_method
ORDER BY total_paid DESC;

-- Q15: 支付成功率
SELECT
  COUNT(*) FILTER (WHERE payment_status = 'success') AS success_count,
  COUNT(*) FILTER (WHERE payment_status = 'failed') AS failed_count,
  COUNT(*) AS total_count,
  ROUND(
    COUNT(*) FILTER (WHERE payment_status = 'success')::numeric / COUNT(*),
    4
  ) AS success_rate
FROM payments;

-- ============================================================
-- 五、高级分析
-- ============================================================

-- Q16: 累计 GMV（窗口函数）
SELECT
  date(created_at) AS dt,
  SUM(total_amount) AS daily_gmv,
  SUM(SUM(total_amount)) OVER (ORDER BY date(created_at)) AS cumulative_gmv
FROM orders
WHERE order_status = 'paid'
GROUP BY date(created_at)
ORDER BY dt;

-- Q17: 用户 GMV 分位数（窗口函数）
WITH user_gmv AS (
  SELECT
    user_id,
    SUM(total_amount) AS gmv
  FROM orders
  WHERE order_status = 'paid'
  GROUP BY user_id
)
SELECT
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY gmv) AS p25,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY gmv) AS p50,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY gmv) AS p75,
  PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY gmv) AS p90,
  AVG(gmv) AS avg_gmv
FROM user_gmv;

-- Q18: 品类用户重叠分析
SELECT
  p1.category AS category_a,
  p2.category AS category_b,
  COUNT(DISTINCT o1.user_id) AS overlap_users
FROM order_items oi1
JOIN order_items oi2 ON oi1.order_id = oi2.order_id AND oi1.product_id < oi2.product_id
JOIN products p1 ON oi1.product_id = p1.product_id
JOIN products p2 ON oi2.product_id = p2.product_id
JOIN orders o1 ON oi1.order_id = o1.order_id
WHERE o1.order_status = 'paid'
GROUP BY p1.category, p2.category
ORDER BY overlap_users DESC;

-- Q19: 订单状态分布
SELECT
  order_status,
  COUNT(*) AS order_count,
  SUM(total_amount) AS total_amount,
  ROUND(
    COUNT(*)::numeric / SUM(COUNT(*)) OVER (),
    4
  ) AS ratio
FROM orders
GROUP BY order_status
ORDER BY order_count DESC;

-- Q20: 用户生命周期价值（LTV）估算
WITH user_orders AS (
  SELECT
    user_id,
    MIN(created_at) AS first_order,
    MAX(created_at) AS last_order,
    COUNT(DISTINCT order_id) AS order_count,
    SUM(total_amount) AS total_gmv
  FROM orders
  WHERE order_status = 'paid'
  GROUP BY user_id
)
SELECT
  user_id,
  first_order,
  last_order,
  order_count,
  total_gmv,
  EXTRACT(DAY FROM last_order - first_order) AS lifetime_days,
  CASE
    WHEN order_count > 1 THEN
      ROUND(total_gmv / (EXTRACT(DAY FROM last_order - first_order) + 1) * 30, 2)
    ELSE total_gmv
  AS estimated_monthly_value
FROM user_orders
ORDER BY total_gmv DESC;

-- Q21: 订单时间分布（按小时）
SELECT
  EXTRACT(HOUR FROM created_at) AS order_hour,
  COUNT(*) AS order_count,
  SUM(total_amount) AS gmv
FROM orders
WHERE order_status = 'paid'
GROUP BY EXTRACT(HOUR FROM created_at)
ORDER BY order_hour;

-- Q22: 支付时间 vs 下单时间差
SELECT
  order_id,
  created_at,
  paid_at,
  EXTRACT(EPOCH FROM paid_at - created_at) / 60 AS payment_delay_minutes
FROM orders
WHERE order_status = 'paid' AND paid_at IS NOT NULL
ORDER BY payment_delay_minutes DESC;

-- Q23: 用户行为事件统计
SELECT
  user_id,
  COUNT(*) FILTER (WHERE event_name = 'app_open') AS open_count,
  COUNT(*) FILTER (WHERE event_name = 'view_product') AS view_count,
  COUNT(*) FILTER (WHERE event_name = 'purchase') AS purchase_count,
  COUNT(*) FILTER (WHERE event_name = 'add_to_cart') AS cart_count
FROM events
GROUP BY user_id
ORDER BY purchase_count DESC;

-- Q24: 事件到下单转化率（按用户）
WITH user_events AS (
  SELECT
    user_id,
    COUNT(*) FILTER (WHERE event_name = 'view_product') AS view_count,
    COUNT(*) FILTER (WHERE event_name = 'purchase') AS purchase_count
  FROM events
  GROUP BY user_id
)
SELECT
  user_id,
  view_count,
  purchase_count,
  CASE
    WHEN view_count > 0 THEN ROUND(purchase_count::numeric / view_count, 4)
    ELSE 0
  END AS view_to_purchase_rate
FROM user_events
WHERE view_count > 0
ORDER BY view_to_purchase_rate DESC;
