INSERT INTO analytics.daily_gmv
SELECT
  toDate(coalesce(paid_at, created_at)) AS stat_date,
  category,
  channel,
  sumIf(item_amount, payment_status = 'paid' AND order_status IN ('paid', 'completed')) AS paid_gmv,
  uniqExactIf(order_id, payment_status = 'paid' AND order_status IN ('paid', 'completed')) AS paid_orders,
  uniqExactIf(user_id, payment_status = 'paid' AND order_status IN ('paid', 'completed')) AS paid_users,
  sumIf(quantity, payment_status = 'paid' AND order_status IN ('paid', 'completed')) AS item_quantity,
  max(sync_version) AS sync_version,
  now() AS updated_at
FROM analytics.order_items_wide
GROUP BY
  stat_date,
  category,
  channel;

SELECT
  stat_date,
  category,
  channel,
  paid_gmv,
  paid_orders,
  paid_users,
  item_quantity
FROM analytics.daily_gmv
ORDER BY stat_date, category, channel;
