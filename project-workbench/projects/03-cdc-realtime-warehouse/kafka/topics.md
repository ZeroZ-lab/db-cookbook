# Kafka Topic 规划

| Topic | Key | Value | Retention | Consumer Group | 说明 |
| --- | --- | --- | --- | --- | --- |
| `db.public.orders` | `order_id` | Debezium order change event | 7 days | `flink-realtime-gmv` | 订单状态和金额变化 |
| `db.public.payments` | `order_id` | Debezium payment change event | 7 days | `flink-realtime-gmv` | 支付状态和支付时间变化 |
| `warehouse.realtime.order_gmv_1m` | `window_start + category` | Flink 1 minute aggregate | 30 days | `clickhouse-realtime-sink` | 1 分钟 GMV 结果 |
| `warehouse.realtime.order_gmv_5m` | `window_start + category` | Flink 5 minute aggregate | 30 days | `clickhouse-realtime-sink` | 5 分钟 GMV 结果 |

## 分区策略

- 订单和支付 Topic 使用 `order_id` 作为 Key，保证同一订单的变更进入同一分区。
- 分区数根据写入吞吐和 Flink 并行度调整，初始建议 3 到 6 个分区。
- Retention 保留至少覆盖重放窗口和故障恢复窗口。

## 边界

- Kafka 保存的是变更日志，不负责最终指标口径。
- Offset 提交只能说明 Consumer 处理进度，不等于 Sink 写入已经端到端一致。
- Exactly Once 需要 Source、Checkpoint、状态、Sink 写入语义共同成立。
