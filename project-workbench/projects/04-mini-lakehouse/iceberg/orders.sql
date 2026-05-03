CREATE TABLE IF NOT EXISTS lakehouse.orders (
  order_id BIGINT,
  user_id BIGINT,
  order_status STRING,
  total_amount DECIMAL(18, 2),
  created_at TIMESTAMP,
  paid_at TIMESTAMP,
  source_system STRING,
  sync_version STRING,
  ingested_at TIMESTAMP
)
USING iceberg
PARTITIONED BY (days(created_at))
TBLPROPERTIES (
  'format-version' = '2',
  'write.format.default' = 'parquet'
);

CREATE TABLE IF NOT EXISTS lakehouse.order_items_wide (
  order_item_id BIGINT,
  order_id BIGINT,
  user_id BIGINT,
  product_id BIGINT,
  category STRING,
  quantity INT,
  item_amount DECIMAL(18, 2),
  order_status STRING,
  created_at TIMESTAMP,
  paid_at TIMESTAMP,
  sync_version STRING,
  transformed_at TIMESTAMP
)
USING iceberg
PARTITIONED BY (days(created_at), category)
TBLPROPERTIES (
  'format-version' = '2',
  'write.format.default' = 'parquet'
);
