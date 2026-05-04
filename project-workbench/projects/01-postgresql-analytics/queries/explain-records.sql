-- ============================================================
-- EXPLAIN 记录模板
-- 以下查询的 EXPLAIN ANALYZE 结果需要在真实 PostgreSQL 环境中执行
-- 当前环境未发现 psql/createdb/docker，结果标记为 [待运行时环境验证]
-- ============================================================

-- ============================================================
-- EXPLAIN 1：用户订单查询（测试 idx_orders_user_created 索引）
-- ============================================================

EXPLAIN ANALYZE
SELECT * FROM orders WHERE user_id = 1 ORDER BY created_at DESC LIMIT 10;

-- 预期执行计划：
--   Index Scan using idx_orders_user_created on orders
--     Index Cond: (user_id = 1)
--     -> 索引扫描，按 (user_id, created_at DESC) 定位
--     -> 直接返回前 10 行，无需排序
--
-- [待运行时环境验证]

-- ============================================================
-- EXPLAIN 2：每日 GMV 聚合（测试全表扫描 + GROUP BY）
-- ============================================================

EXPLAIN ANALYZE
SELECT
  date(created_at) AS dt,
  COUNT(DISTINCT order_id) AS order_count,
  SUM(total_amount) AS gmv
FROM orders
WHERE order_status = 'paid'
GROUP BY date(created_at)
ORDER BY dt;

-- 预期执行计划：
--   HashAggregate (或 GroupAggregate)
--     Group Key: date(created_at)
--     -> Seq Scan on orders
--         Filter: (order_status = 'paid')
--     -> Sort
--         Sort Key: date(created_at)
--
-- 小数据量下可能是 Seq Scan + HashAggregate
-- 大数据量下建议创建物化视图或汇总表
--
-- [待运行时环境验证]

-- ============================================================
-- EXPLAIN 3：转化漏斗 CTE 查询（测试多 CTE + JOIN）
-- ============================================================

EXPLAIN ANALYZE
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

-- 预期执行计划：
--   -> Sort
--       Sort Key: a.dt
--       -> Hash Left Join
--           Hash Cond: (a.dt = p.dt)
--           -> CTE Scan on daily_active a
--           -> Hash
--               -> CTE Scan on daily_purchase p
--
-- 两个 CTE 各自独立计算，然后 Hash Join 合并
-- 如果数据量大，可以在 event_time 上创建复合索引 (event_name, event_time)
--
-- [待运行时环境验证]
