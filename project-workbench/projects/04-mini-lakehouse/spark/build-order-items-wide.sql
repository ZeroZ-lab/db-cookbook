INSERT OVERWRITE lakehouse.order_items_wide
SELECT
  oi.order_item_id,
  o.order_id,
  o.user_id,
  oi.product_id,
  p.category,
  oi.quantity,
  oi.item_amount,
  o.order_status,
  o.created_at,
  o.paid_at,
  o.sync_version,
  current_timestamp() AS transformed_at
FROM lakehouse.orders o
JOIN lakehouse.raw_order_items oi
  ON o.order_id = oi.order_id
JOIN lakehouse.raw_products p
  ON oi.product_id = p.product_id
WHERE o.created_at >= date_sub(current_date(), 7);
