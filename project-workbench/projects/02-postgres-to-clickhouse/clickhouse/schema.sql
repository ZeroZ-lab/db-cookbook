CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.order_items_wide
(
  order_item_id UInt64,
  order_id UInt64,
  user_id UInt64,
  channel LowCardinality(String),
  user_level LowCardinality(String),
  product_id UInt64,
  product_name String,
  category LowCardinality(String),
  quantity UInt32,
  item_amount Decimal(18, 2),
  order_status LowCardinality(String),
  payment_status LowCardinality(String),
  payment_method LowCardinality(String),
  created_at DateTime,
  paid_at Nullable(DateTime),
  sync_version String
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(created_at)
ORDER BY (created_at, category, user_id, order_id)
SETTINGS index_granularity = 8192;

CREATE TABLE IF NOT EXISTS analytics.daily_gmv
(
  stat_date Date,
  category LowCardinality(String),
  channel LowCardinality(String),
  paid_gmv Decimal(18, 2),
  paid_orders UInt64,
  paid_users UInt64,
  item_quantity UInt64,
  sync_version String,
  updated_at DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(stat_date)
ORDER BY (stat_date, category, channel);
