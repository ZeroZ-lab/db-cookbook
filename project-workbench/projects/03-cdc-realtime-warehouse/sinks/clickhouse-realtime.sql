CREATE DATABASE IF NOT EXISTS realtime;

CREATE TABLE IF NOT EXISTS realtime.order_gmv_1m
(
  window_start DateTime,
  window_end DateTime,
  paid_orders UInt64,
  paid_users UInt64,
  paid_gmv Decimal(18, 2),
  updated_at DateTime
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMMDD(window_start)
ORDER BY (window_start, window_end);
