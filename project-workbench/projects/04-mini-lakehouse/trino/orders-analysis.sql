SELECT
  date_trunc('day', created_at) AS stat_date,
  order_status,
  count(*) AS orders,
  sum(total_amount) AS total_amount
FROM lakehouse.orders
WHERE created_at >= TIMESTAMP '2026-05-01 00:00:00'
GROUP BY 1, 2
ORDER BY 1, 2;

SELECT
  category,
  count(DISTINCT order_id) AS orders,
  sum(item_amount) AS gmv,
  sum(quantity) AS quantity
FROM lakehouse.order_items_wide
WHERE created_at >= TIMESTAMP '2026-05-01 00:00:00'
  AND order_status IN ('paid', 'completed')
GROUP BY category
ORDER BY gmv DESC;
