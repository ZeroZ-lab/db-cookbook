# Kafka 消费样例

## Topic 结构

- Topic: `db.public.orders`
- Key: `order_id` (整数)
- Value: Debezium JSON 格式

## 消息格式

```json
{
  "before": {
    "order_id": 1001,
    "user_id": 1,
    "order_status": "created",
    "total_amount": 487.00,
    "created_at": "2026-04-03 10:00:00",
    "paid_at": null
  },
  "after": {
    "order_id": 1001,
    "user_id": 1,
    "order_status": "paid",
    "total_amount": 487.00,
    "created_at": "2026-04-03 10:00:00",
    "paid_at": "2026-04-03 10:02:00"
  },
  "op": "u",
  "ts_ms": 1744000920000,
  "source": {
    "version": "2.5.0",
    "connector": "postgresql",
    "name": "db",
    "ts_ms": 1744000920000,
    "db": "db_cookbook_lab",
    "schema": "public",
    "table": "orders"
  }
}
```

## 消费命令

```bash
# 使用 kafka-console-consumer 消费
kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic db.public.orders \
  --from-beginning \
  --max-messages 10

# 使用 kafka-console-consumer 消费（带 key）
kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic db.public.orders \
  --from-beginning \
  --property print.key=true \
  --property key.separator=": "
```

## Flink SQL 消费

```sql
-- 从 Kafka 读取 CDC 事件
CREATE TABLE orders_cdc (
  before ROW<order_id INT, user_id INT, order_status STRING, total_amount DECIMAL(12,2), created_at TIMESTAMP(3), paid_at TIMESTAMP(3)>,
  after ROW<order_id INT, user_id INT, order_status STRING, total_amount DECIMAL(12,2), created_at TIMESTAMP(3), paid_at TIMESTAMP(3)>,
  op STRING,
  ts_ms BIGINT,
  source ROW<db STRING, `table` STRING>
) WITH (
  'connector' = 'kafka',
  'topic' = 'db.public.orders',
  'properties.bootstrap.servers' = 'kafka:9092',
  'properties.group.id' = 'flink-realtime-gmv',
  'format' = 'json',
  'scan.startup.mode' = 'latest-offset'
);
```

## 验证消费

```bash
# 检查 Topic 是否有消息
kafka-run-class.sh kafka.tools.GetOffsetShell \
  --broker-list localhost:9092 \
  --topic db.public.orders

# 检查 Consumer Group 消费进度
kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group flink-realtime-gmv \
  --describe
```

**注意**：以上命令为伪运行流程，当前环境未安装 Kafka 运行时。
