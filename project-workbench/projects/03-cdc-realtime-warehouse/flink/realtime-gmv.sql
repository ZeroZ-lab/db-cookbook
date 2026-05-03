CREATE TABLE orders_cdc (
  order_id BIGINT,
  user_id BIGINT,
  order_status STRING,
  total_amount DECIMAL(18, 2),
  created_at TIMESTAMP(3),
  paid_at TIMESTAMP(3),
  event_time TIMESTAMP(3),
  WATERMARK FOR event_time AS event_time - INTERVAL '30' SECOND,
  PRIMARY KEY (order_id) NOT ENFORCED
) WITH (
  'connector' = 'kafka',
  'topic' = 'db.public.orders',
  'properties.bootstrap.servers' = 'localhost:9092',
  'properties.group.id' = 'flink-realtime-gmv',
  'format' = 'json',
  'scan.startup.mode' = 'earliest-offset'
);

CREATE TABLE realtime_gmv_1m (
  window_start TIMESTAMP(3),
  window_end TIMESTAMP(3),
  paid_orders BIGINT,
  paid_users BIGINT,
  paid_gmv DECIMAL(18, 2),
  updated_at TIMESTAMP(3),
  PRIMARY KEY (window_start, window_end) NOT ENFORCED
) WITH (
  'connector' = 'upsert-kafka',
  'topic' = 'warehouse.realtime.order_gmv_1m',
  'properties.bootstrap.servers' = 'localhost:9092',
  'key.format' = 'json',
  'value.format' = 'json'
);

INSERT INTO realtime_gmv_1m
SELECT
  window_start,
  window_end,
  COUNT(DISTINCT order_id) AS paid_orders,
  COUNT(DISTINCT user_id) AS paid_users,
  SUM(total_amount) AS paid_gmv,
  CURRENT_TIMESTAMP AS updated_at
FROM TABLE(
  TUMBLE(TABLE orders_cdc, DESCRIPTOR(event_time), INTERVAL '1' MINUTE)
)
WHERE order_status IN ('paid', 'completed')
GROUP BY window_start, window_end;
